package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/adapters/http/middlewares"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/itsLeonB/go-authkit"
	"github.com/itsLeonB/go-authkit/authgin"
	"github.com/itsLeonB/ungerr"
)

// AuthHandler exposes /api/v1/auth/* as Huma operations, calling AuthKit
// directly instead of delegating to authgin.Handler (a gin-only wrapper with
// zero business logic of its own — see each method below for the equivalent
// authgin.Handler method it replaces).
type AuthHandler struct {
	kit       *authkit.AuthKit
	transport *authgin.CookieTransport
	captcha   service.CaptchaService
	limiter   *middlewares.ValueLimiter
}

func NewAuthHandler(kit *authkit.AuthKit, transport *authgin.CookieTransport, captcha service.CaptchaService, limiter *middlewares.ValueLimiter) *AuthHandler {
	return &AuthHandler{kit: kit, transport: transport, captcha: captcha, limiter: limiter}
}

// setTokenCookies writes access/refresh/fingerprint cookies plus a fresh
// CSRF cookie, mirroring authgin.Handler.setTokenCookies/setCSRFCookie.
func (ah *AuthHandler) setTokenCookies(w http.ResponseWriter, tokens authkit.TokenSet) string {
	ah.transport.SetTokens(w, tokens.AccessToken, tokens.RefreshToken, tokens.Fingerprint)

	b := make([]byte, 16)
	rand.Read(b) //nolint:errcheck

	token := hex.EncodeToString(b)
	ah.transport.SetCSRFCookie(w, token)

	return token
}

// authMessageBody is the shared Res type for every auth operation that only
// ever returns a status message (and, for the ones that establish a
// session, a CSRF token) — matching the {"message": ..., "csrfToken": ...}
// body authgin.Handler used to return. Wrapped in httpapi.Envelope
// automatically by endpoint.Endpoint.
type authMessageBody struct {
	Message   string `json:"message"`
	CsrfToken string `json:"csrfToken,omitempty"`
}

type RegisterAuthInput struct {
	Body struct {
		Email                string `json:"email" format:"email"`
		Password             string `json:"password"`
		PasswordConfirmation string `json:"passwordConfirmation"`
		Slug                 string `json:"slug,omitempty"`
	}
}

// Resolve implements huma.Resolver.
func (i *RegisterAuthInput) Resolve(ctx huma.Context) []error {
	return httpapi.CheckPasswordMatch(i.Body.Password, i.Body.PasswordConfirmation)
}

// register handles POST /api/v1/auth/register, replacing
// authgin.Handler.Register.
func (ah *AuthHandler) register(ctx context.Context, in RegisterAuthInput) (authMessageBody, error) {
	verified, err := ah.kit.Register(ctx, in.Body.Email, in.Body.Password, in.Body.Slug)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	msg := "check your email to confirm your registration"
	if verified {
		msg = "success registering, please login"
	}

	return authMessageBody{Message: msg}, nil
}

type LoginAuthInput struct {
	httpapi.GinContextInput
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password"`
	}
}

// login handles POST /api/v1/auth/login, replacing authgin.Handler.Login.
func (ah *AuthHandler) login(ctx context.Context, in LoginAuthInput) (authMessageBody, error) {
	tokens, err := ah.kit.Login(ctx, in.Body.Email, in.Body.Password)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

	return authMessageBody{Message: "ok", CsrfToken: csrf}, nil
}

type OAuthLoginInput struct {
	Provider string `path:"provider"`
}

// oauthLogin handles GET /api/v1/auth/{provider}, replacing
// authgin.Handler.OAuthLogin.
func (ah *AuthHandler) oauthLogin(ctx context.Context, in OAuthLoginInput) (string, error) {
	url, err := ah.kit.GetOAuthURL(ctx, in.Provider)
	if err != nil {
		return "", httpapi.MapAuthErr(err)
	}

	return url, nil
}

type OAuthCallbackInput struct {
	httpapi.GinContextInput
	Provider string `path:"provider"`
	Code     string `query:"code"`
	State    string `query:"state"`
}

// oauthCallback handles GET /api/v1/auth/{provider}/callback, replacing
// authgin.Handler.OAuthCallback.
func (ah *AuthHandler) oauthCallback(ctx context.Context, in OAuthCallbackInput) (authMessageBody, error) {
	tokens, err := ah.kit.HandleOAuthCallback(ctx, in.Provider, in.Code, in.State)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

	return authMessageBody{Message: "ok", CsrfToken: csrf}, nil
}

type VerifyRegistrationInput struct {
	httpapi.GinContextInput
	Token string `query:"token"`
}

// verifyRegistration handles GET /api/v1/auth/verify-registration,
// replacing authgin.Handler.VerifyRegistration.
func (ah *AuthHandler) verifyRegistration(ctx context.Context, in VerifyRegistrationInput) (authMessageBody, error) {
	tokens, err := ah.kit.VerifyRegistration(ctx, in.Token)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

	return authMessageBody{Message: "ok", CsrfToken: csrf}, nil
}

type SendPasswordResetInput struct {
	Body struct {
		Email        string `json:"email" format:"email"`
		CaptchaToken string `json:"captchaToken,omitempty"`
	}
}

// sendPasswordReset handles POST /api/v1/auth/password-reset, replacing
// authgin.Handler.SendPasswordReset. Returns authMessageBody (not an empty
// body): the frontend's forgotPassword call isn't on the client's
// 204-special-cased path, so it always calls response.json() — a truly
// empty body there throws a JSON parse error and breaks the success flow.
func (ah *AuthHandler) sendPasswordReset(ctx context.Context, in SendPasswordResetInput) (authMessageBody, error) {
	if ah.limiter != nil && !ah.limiter.Allow(in.Body.Email) {
		return authMessageBody{}, httpapi.MapAuthErr(authkit.ErrTooManyRequests)
	}
	if ah.captcha != nil {
		if err := ah.captcha.Verify(ctx, in.Body.CaptchaToken); err != nil {
			return authMessageBody{}, err
		}
	}

	if err := ah.kit.SendPasswordReset(ctx, in.Body.Email); err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	return authMessageBody{Message: "check your email for a password reset link"}, nil
}

type ResetPasswordInput struct {
	httpapi.GinContextInput
	Body struct {
		Token                string `json:"token"`
		Password             string `json:"password"`
		PasswordConfirmation string `json:"passwordConfirmation"`
	}
}

// Resolve implements huma.Resolver. Defined directly on ResetPasswordInput
// rather than relying on the embedded GinContextInput's promoted Resolve:
// Huma's resolver-dispatch (findResolvers/_findInType in huma.go) stops
// recursing into anonymous/embedded fields once the outer struct itself
// already satisfies huma.Resolver, so a directly-defined Resolve here would
// otherwise shadow GinContextInput.Resolve and silently stop it from ever
// running, leaving in.Gin nil. Calling it explicitly keeps in.Gin populated
// for the cookie writes in resetPassword.
func (i *ResetPasswordInput) Resolve(ctx huma.Context) []error {
	errs := i.GinContextInput.Resolve(ctx)
	return append(errs, httpapi.CheckPasswordMatch(i.Body.Password, i.Body.PasswordConfirmation)...)
}

// resetPassword handles PATCH /api/v1/auth/reset-password, replacing
// authgin.Handler.ResetPassword.
func (ah *AuthHandler) resetPassword(ctx context.Context, in ResetPasswordInput) (authMessageBody, error) {
	tokens, err := ah.kit.ResetPassword(ctx, in.Body.Token, in.Body.Password)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

	return authMessageBody{Message: "ok", CsrfToken: csrf}, nil
}

type RefreshTokenInput struct {
	httpapi.GinContextInput
}

// refreshToken handles PUT /api/v1/auth/refresh, replacing
// authgin.Handler.RefreshToken.
func (ah *AuthHandler) refreshToken(ctx context.Context, in RefreshTokenInput) (authMessageBody, error) {
	refreshToken, err := ah.transport.ReadRefreshToken(in.Gin.Request)
	if err != nil {
		return authMessageBody{}, ungerr.UnauthorizedError(err.Error())
	}

	tokens, err := ah.kit.RefreshToken(ctx, refreshToken)
	if err != nil {
		return authMessageBody{}, httpapi.MapAuthErr(err)
	}

	csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

	return authMessageBody{Message: "ok", CsrfToken: csrf}, nil
}

type LogoutInput struct {
	httpapi.GinContextInput
	httpapi.SessionInput
}

// logout handles DELETE /api/v1/auth/logout, replacing
// authgin.Handler.Logout. Unlike the other auth operations, this one is
// authenticated (bridged auth+CSRF middleware, like every other protected
// route), so the session id comes from httpapi.SessionInput instead of a
// request field.
func (ah *AuthHandler) logout(ctx context.Context, in LogoutInput) error {
	if err := ah.kit.Logout(ctx, in.SessionID.String()); err != nil {
		return httpapi.MapAuthErr(err)
	}

	ah.transport.ClearTokens(in.Gin.Writer)

	return nil
}

// Routes returns the auth operations that share the /api/v1/auth group's
// per-IP rate limit (authRateMW in routes/api_routes.go): register, login,
// oauth-login, oauth-callback, verify-registration, and refresh.
// send-password-reset and reset-password carry an *additional* rate limit on
// top of that one, so they're returned by
// PasswordResetRoutes/ResetPasswordRoutes instead and registered with their
// own extra middleware. logout is returned by LogoutRoutes instead: it needs
// protectedMW (auth+CSRF), not authRateMW, so it can't share this group's
// middleware.
func (ah *AuthHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[RegisterAuthInput, authMessageBody]{
			OperationID: "auth-register",
			Method:      http.MethodPost,
			Path:        "/api/v1/auth/register",
			Summary:     "Register a new user account",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusCreated,
			ServiceFunc: ah.register,
		}),
		endpoint.New(endpoint.Endpoint[LoginAuthInput, authMessageBody]{
			OperationID: "auth-login",
			Method:      http.MethodPost,
			Path:        "/api/v1/auth/login",
			Summary:     "Login with email and password",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusOK,
			ServiceFunc: ah.login,
		}),
		endpoint.NewRedirect(endpoint.RedirectEndpoint[OAuthLoginInput]{
			OperationID: "auth-oauth-login",
			Method:      http.MethodGet,
			Path:        "/api/v1/auth/{provider}",
			Summary:     "Redirect to the OAuth provider's login page",
			Tags:        []string{"auth"},
			ServiceFunc: ah.oauthLogin,
		}),
		endpoint.New(endpoint.Endpoint[OAuthCallbackInput, authMessageBody]{
			OperationID: "auth-oauth-callback",
			Method:      http.MethodGet,
			Path:        "/api/v1/auth/{provider}/callback",
			Summary:     "Handle the OAuth provider's callback",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusOK,
			ServiceFunc: ah.oauthCallback,
		}),
		endpoint.New(endpoint.Endpoint[VerifyRegistrationInput, authMessageBody]{
			OperationID: "auth-verify-registration",
			Method:      http.MethodGet,
			Path:        "/api/v1/auth/verify-registration",
			Summary:     "Verify a registration email token",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusOK,
			ServiceFunc: ah.verifyRegistration,
		}),
		endpoint.New(endpoint.Endpoint[RefreshTokenInput, authMessageBody]{
			OperationID: "auth-refresh",
			Method:      http.MethodPut,
			Path:        "/api/v1/auth/refresh",
			Summary:     "Refresh the access token",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusOK,
			ServiceFunc: ah.refreshToken,
		}),
	}
}

// PasswordResetRoutes returns auth-send-password-reset on its own, so
// routes/api_routes.go can register it with authRateMW plus its own tighter
// rate limit (passwordResetMW), instead of sharing Routes()'s single
// middleware set.
func (ah *AuthHandler) PasswordResetRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[SendPasswordResetInput, authMessageBody]{
			OperationID: "auth-send-password-reset",
			Method:      http.MethodPost,
			Path:        "/api/v1/auth/password-reset",
			Summary:     "Send a password reset email",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusCreated,
			ServiceFunc: ah.sendPasswordReset,
		}),
	}
}

// ResetPasswordRoutes returns auth-reset-password on its own, so
// routes/api_routes.go can register it with authRateMW plus its own tighter
// rate limit (resetPasswordMW), instead of sharing Routes()'s single
// middleware set.
func (ah *AuthHandler) ResetPasswordRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[ResetPasswordInput, authMessageBody]{
			OperationID: "auth-reset-password",
			Method:      http.MethodPatch,
			Path:        "/api/v1/auth/reset-password",
			Summary:     "Reset a password using a reset token",
			Tags:        []string{"auth"},
			SuccessCode: http.StatusOK,
			ServiceFunc: ah.resetPassword,
		}),
	}
}

// LogoutRoutes returns auth-logout on its own, so routes/api_routes.go can
// register it with protectedMW (auth+CSRF) instead of sharing Routes()'s
// authRateMW group — logout is not, and never was, part of the rate-limited
// /auth group.
func (ah *AuthHandler) LogoutRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[LogoutInput]{
			OperationID: "auth-logout",
			Method:      http.MethodDelete,
			Path:        "/api/v1/auth/logout",
			Summary:     "Logout the current session",
			Tags:        []string{"auth"},
			Secured:     true,
			ServiceFunc: ah.logout,
		}),
	}
}
