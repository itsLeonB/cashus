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

type authMessageBody struct {
	Message   string `json:"message"`
	CsrfToken string `json:"csrfToken,omitempty"`
}

// AuthMessageOutput is the shared Output type for every auth operation that
// only ever returns a status message (and, for the ones that establish a
// session, a CSRF token) — matching the {"message": ..., "csrfToken": ...}
// body authgin.Handler used to return.
type AuthMessageOutput struct {
	Body httpapi.Envelope[authMessageBody]
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

// RegisterRegister registers POST /api/v1/auth/register on the Huma API,
// replacing authgin.Handler.Register.
func (ah *AuthHandler) RegisterRegister(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-register",
		Method:        http.MethodPost,
		Path:          "/api/v1/auth/register",
		Summary:       "Register a new user account",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusCreated,
		Middlewares:   mw,
	}, func(ctx context.Context, in *RegisterAuthInput) (*AuthMessageOutput, error) {
		verified, err := ah.kit.Register(ctx, in.Body.Email, in.Body.Password, in.Body.Slug)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		msg := "check your email to confirm your registration"
		if verified {
			msg = "success registering, please login"
		}

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: msg})}, nil
	})
}

type LoginAuthInput struct {
	httpapi.GinContextInput
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password"`
	}
}

// RegisterLogin registers POST /api/v1/auth/login on the Huma API,
// replacing authgin.Handler.Login.
func (ah *AuthHandler) RegisterLogin(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-login",
		Method:        http.MethodPost,
		Path:          "/api/v1/auth/login",
		Summary:       "Login with email and password",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *LoginAuthInput) (*AuthMessageOutput, error) {
		tokens, err := ah.kit.Login(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "ok", CsrfToken: csrf})}, nil
	})
}

type OAuthLoginInput struct {
	Provider string `path:"provider"`
}

type OAuthLoginOutput struct {
	Status   int
	Location string `header:"Location"`
}

// RegisterOAuthLogin registers GET /api/v1/auth/{provider} on the Huma API,
// replacing authgin.Handler.OAuthLogin. Unlike every other auth operation,
// this one is a redirect with no JSON body, so it sets Status/Location
// output fields directly rather than going through authMessageBody.
func (ah *AuthHandler) RegisterOAuthLogin(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID: "auth-oauth-login",
		Method:      http.MethodGet,
		Path:        "/api/v1/auth/{provider}",
		Summary:     "Redirect to the OAuth provider's login page",
		Tags:        []string{"auth"},
		Middlewares: mw,
	}, func(ctx context.Context, in *OAuthLoginInput) (*OAuthLoginOutput, error) {
		url, err := ah.kit.GetOAuthURL(ctx, in.Provider)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		return &OAuthLoginOutput{Status: http.StatusTemporaryRedirect, Location: url}, nil
	})
}

type OAuthCallbackInput struct {
	httpapi.GinContextInput
	Provider string `path:"provider"`
	Code     string `query:"code"`
	State    string `query:"state"`
}

// RegisterOAuthCallback registers GET /api/v1/auth/{provider}/callback on
// the Huma API, replacing authgin.Handler.OAuthCallback.
func (ah *AuthHandler) RegisterOAuthCallback(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-oauth-callback",
		Method:        http.MethodGet,
		Path:          "/api/v1/auth/{provider}/callback",
		Summary:       "Handle the OAuth provider's callback",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *OAuthCallbackInput) (*AuthMessageOutput, error) {
		tokens, err := ah.kit.HandleOAuthCallback(ctx, in.Provider, in.Code, in.State)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "ok", CsrfToken: csrf})}, nil
	})
}

type VerifyRegistrationInput struct {
	httpapi.GinContextInput
	Token string `query:"token"`
}

// RegisterVerifyRegistration registers GET /api/v1/auth/verify-registration
// on the Huma API, replacing authgin.Handler.VerifyRegistration.
func (ah *AuthHandler) RegisterVerifyRegistration(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-verify-registration",
		Method:        http.MethodGet,
		Path:          "/api/v1/auth/verify-registration",
		Summary:       "Verify a registration email token",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *VerifyRegistrationInput) (*AuthMessageOutput, error) {
		tokens, err := ah.kit.VerifyRegistration(ctx, in.Token)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "ok", CsrfToken: csrf})}, nil
	})
}

type SendPasswordResetInput struct {
	Body struct {
		Email        string `json:"email" format:"email"`
		CaptchaToken string `json:"captchaToken,omitempty"`
	}
}

// RegisterSendPasswordReset registers POST /api/v1/auth/password-reset on
// the Huma API, replacing authgin.Handler.SendPasswordReset. Returns
// AuthMessageOutput (not an empty body): the frontend's forgotPassword call
// isn't on the client's 204-special-cased path, so it always calls
// response.json() — a truly empty body there throws a JSON parse error and
// breaks the success flow.
func (ah *AuthHandler) RegisterSendPasswordReset(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-send-password-reset",
		Method:        http.MethodPost,
		Path:          "/api/v1/auth/password-reset",
		Summary:       "Send a password reset email",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusCreated,
		Middlewares:   mw,
	}, func(ctx context.Context, in *SendPasswordResetInput) (*AuthMessageOutput, error) {
		if ah.limiter != nil && !ah.limiter.Allow(in.Body.Email) {
			return nil, httpapi.MapAuthErr(authkit.ErrTooManyRequests)
		}
		if ah.captcha != nil {
			if err := ah.captcha.Verify(ctx, in.Body.CaptchaToken); err != nil {
				return nil, err
			}
		}

		if err := ah.kit.SendPasswordReset(ctx, in.Body.Email); err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "check your email for a password reset link"})}, nil
	})
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
// for the cookie writes in RegisterResetPassword.
func (i *ResetPasswordInput) Resolve(ctx huma.Context) []error {
	errs := i.GinContextInput.Resolve(ctx)
	return append(errs, httpapi.CheckPasswordMatch(i.Body.Password, i.Body.PasswordConfirmation)...)
}

// RegisterResetPassword registers PATCH /api/v1/auth/reset-password on the
// Huma API, replacing authgin.Handler.ResetPassword.
func (ah *AuthHandler) RegisterResetPassword(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-reset-password",
		Method:        http.MethodPatch,
		Path:          "/api/v1/auth/reset-password",
		Summary:       "Reset a password using a reset token",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *ResetPasswordInput) (*AuthMessageOutput, error) {
		tokens, err := ah.kit.ResetPassword(ctx, in.Body.Token, in.Body.Password)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "ok", CsrfToken: csrf})}, nil
	})
}

type RefreshTokenInput struct {
	httpapi.GinContextInput
}

// RegisterRefreshToken registers PUT /api/v1/auth/refresh on the Huma API,
// replacing authgin.Handler.RefreshToken.
func (ah *AuthHandler) RegisterRefreshToken(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-refresh",
		Method:        http.MethodPut,
		Path:          "/api/v1/auth/refresh",
		Summary:       "Refresh the access token",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *RefreshTokenInput) (*AuthMessageOutput, error) {
		refreshToken, err := ah.transport.ReadRefreshToken(in.Gin.Request)
		if err != nil {
			return nil, ungerr.UnauthorizedError(err.Error())
		}

		tokens, err := ah.kit.RefreshToken(ctx, refreshToken)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		csrf := ah.setTokenCookies(in.Gin.Writer, tokens)

		return &AuthMessageOutput{Body: httpapi.NewEnvelope(authMessageBody{Message: "ok", CsrfToken: csrf})}, nil
	})
}

type LogoutInput struct {
	httpapi.GinContextInput
	httpapi.SessionInput
}

type LogoutOutput struct{}

// RegisterLogout registers DELETE /api/v1/auth/logout on the Huma API,
// replacing authgin.Handler.Logout. Unlike the other auth operations, this
// one is authenticated (bridged auth+CSRF middleware, like every other
// protected route), so the session id comes from httpapi.SessionInput
// instead of a request field.
func (ah *AuthHandler) RegisterLogout(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "auth-logout",
		Method:        http.MethodDelete,
		Path:          "/api/v1/auth/logout",
		Summary:       "Logout the current session",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *LogoutInput) (*LogoutOutput, error) {
		if err := ah.kit.Logout(ctx, in.SessionID.String()); err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		ah.transport.ClearTokens(in.Gin.Writer)

		return &LogoutOutput{}, nil
	})
}
