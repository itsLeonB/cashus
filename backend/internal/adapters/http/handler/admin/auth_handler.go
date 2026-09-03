package admin

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/core/util"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	adminEntity "github.com/itsLeonB/cashback/internal/domain/entity/admin"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/itsLeonB/go-authkit"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
)

type AuthHandler struct {
	kit      *authkit.AuthKit
	userRepo crud.Repository[adminEntity.User]
}

type AdminRegisterInput struct {
	Body struct {
		Email                string `json:"email" format:"email"`
		Password             string `json:"password"`
		PasswordConfirmation string `json:"passwordConfirmation"`
	}
}

// Resolve implements huma.Resolver.
func (i *AdminRegisterInput) Resolve(ctx huma.Context) []error {
	return httpapi.CheckPasswordMatch(i.Body.Password, i.Body.PasswordConfirmation)
}

type adminVerifiedBody struct {
	Verified bool `json:"verified"`
}

// register handles POST /admin/v1/auth/register, replacing
// authgin.StatelessHandler.Register.
func (ah *AuthHandler) register(ctx context.Context, in AdminRegisterInput) (adminVerifiedBody, error) {
	verified, err := ah.kit.Register(ctx, in.Body.Email, in.Body.Password, "")
	if err != nil {
		return adminVerifiedBody{}, httpapi.MapAuthErr(err)
	}

	return adminVerifiedBody{Verified: verified}, nil
}

type AdminLoginInput struct {
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password"`
	}
}

type adminBearerTokenBody struct {
	Type  string `json:"type"`
	Token string `json:"token"`
}

// login handles POST /admin/v1/auth/login, replacing
// authgin.StatelessHandler.Login. Unlike the main API, admin auth is
// stateless: the access token is returned in the JSON body rather than set
// as a cookie.
func (ah *AuthHandler) login(ctx context.Context, in AdminLoginInput) (adminBearerTokenBody, error) {
	tokens, err := ah.kit.Login(ctx, in.Body.Email, in.Body.Password)
	if err != nil {
		return adminBearerTokenBody{}, httpapi.MapAuthErr(err)
	}

	return adminBearerTokenBody{Type: "Bearer", Token: tokens.AccessToken}, nil
}

type GetAdminMeInput struct {
	httpapi.AdminAuthInput
}

// getMe loads the authenticated admin user and maps it to dto.AdminMe. This
// used to live inline in RegisterMe's handler closure, with the handler
// itself checking user.IsZero() and building ungerr.UnauthorizedError; it's
// pulled out here (rather than into a dedicated admin-auth service, which
// doesn't otherwise exist — this handler talks to userRepo directly, same as
// ProfileHandler talks to service.ProfileService) so RegisterMe's
// replacement in Routes() can be a plain call-and-pass-through-error,
// matching the shape endpoint.Endpoint expects.
func (ah *AuthHandler) getMe(ctx context.Context, userID uuid.UUID) (dto.AdminMe, error) {
	spec := crud.Specification[adminEntity.User]{}
	spec.Model.ID = userID

	user, err := ah.userRepo.FindFirst(ctx, spec)
	if err != nil {
		return dto.AdminMe{}, err
	}
	if user.IsZero() {
		return dto.AdminMe{}, ungerr.UnauthorizedError("user not found")
	}

	return dto.AdminMe{ID: user.ID, FullName: util.GetNameFromEmail(user.Email)}, nil
}

// Routes returns every route AuthHandler exposes via endpoint.Endpoint that
// shares the admin-auth-bridge middleware group. Register and Login are
// returned separately (RegisterRoutes/LoginRoutes): they're unauthenticated
// with different per-route middleware (bootstrap-only / login rate
// limiting), so they can't share this Secured-true group's middleware.
// getAdminMe delegates to ah.getMe.
func (ah *AuthHandler) getAdminMe(ctx context.Context, in GetAdminMeInput) (dto.AdminMe, error) {
	return ah.getMe(ctx, in.UserID)
}

func (ah *AuthHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetAdminMeInput, dto.AdminMe]{
			OperationID: "get-admin-me",
			Method:      http.MethodGet,
			Path:        "/admin/v1/auth/me",
			Summary:     "Get the authenticated admin user",
			Tags:        []string{"admin-auth"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ah.getAdminMe,
		}),
	}
}

// RegisterRoutes returns admin-auth-register on its own, so
// routes/admin_routes.go can register it with no middleware at all: it's the
// one-time admin-bootstrap endpoint, self-limiting via the authkit
// BeforeRegister hook (see internal/provider/admin) which forbids
// registration once any admin user exists.
func (ah *AuthHandler) RegisterRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[AdminRegisterInput, adminVerifiedBody]{
			OperationID: "admin-auth-register",
			Method:      http.MethodPost,
			Path:        "/admin/v1/auth/register",
			Summary:     "Register a new admin user",
			Tags:        []string{"admin-auth"},
			SuccessCode: http.StatusCreated,
			HandlerFunc: ah.register,
		}),
	}
}

// LoginRoutes returns admin-auth-login on its own, so routes/admin_routes.go
// can register it with only a per-IP rate limit: there's no session yet to
// bridge auth middleware onto.
func (ah *AuthHandler) LoginRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[AdminLoginInput, adminBearerTokenBody]{
			OperationID: "admin-auth-login",
			Method:      http.MethodPost,
			Path:        "/admin/v1/auth/login",
			Summary:     "Login as an admin user",
			Tags:        []string{"admin-auth"},
			SuccessCode: http.StatusOK,
			HandlerFunc: ah.login,
		}),
	}
}
