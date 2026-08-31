package admin

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/core/util"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	adminEntity "github.com/itsLeonB/cashback/internal/domain/entity/admin"
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

type AdminRegisterOutput struct {
	Body httpapi.Envelope[adminVerifiedBody]
}

// RegisterRegister registers POST /admin/v1/auth/register on the Huma API,
// replacing authgin.StatelessHandler.Register.
func (ah *AuthHandler) RegisterRegister(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "admin-auth-register",
		Method:        http.MethodPost,
		Path:          "/admin/v1/auth/register",
		Summary:       "Register a new admin user",
		Tags:          []string{"admin-auth"},
		DefaultStatus: http.StatusCreated,
		Middlewares:   mw,
	}, func(ctx context.Context, in *AdminRegisterInput) (*AdminRegisterOutput, error) {
		verified, err := ah.kit.Register(ctx, in.Body.Email, in.Body.Password, "")
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		return &AdminRegisterOutput{Body: httpapi.NewEnvelope(adminVerifiedBody{Verified: verified})}, nil
	})
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

type AdminLoginOutput struct {
	Body httpapi.Envelope[adminBearerTokenBody]
}

// RegisterLogin registers POST /admin/v1/auth/login on the Huma API,
// replacing authgin.StatelessHandler.Login. Unlike the main API, admin auth
// is stateless: the access token is returned in the JSON body rather than
// set as a cookie.
func (ah *AuthHandler) RegisterLogin(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "admin-auth-login",
		Method:        http.MethodPost,
		Path:          "/admin/v1/auth/login",
		Summary:       "Login as an admin user",
		Tags:          []string{"admin-auth"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *AdminLoginInput) (*AdminLoginOutput, error) {
		tokens, err := ah.kit.Login(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, httpapi.MapAuthErr(err)
		}

		return &AdminLoginOutput{Body: httpapi.NewEnvelope(adminBearerTokenBody{Type: "Bearer", Token: tokens.AccessToken})}, nil
	})
}

type GetAdminMeInput struct {
	httpapi.AdminAuthInput
}

type GetAdminMeOutput struct {
	Body httpapi.Envelope[dto.AdminMe]
}

// RegisterMe registers GET /admin/v1/auth/me on the Huma API.
func (ah *AuthHandler) RegisterMe(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-me",
		Method:        http.MethodGet,
		Path:          "/admin/v1/auth/me",
		Summary:       "Get the authenticated admin user",
		Tags:          []string{"admin-auth"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAdminMeInput) (*GetAdminMeOutput, error) {
		spec := crud.Specification[adminEntity.User]{}
		spec.Model.ID = in.UserID

		user, err := ah.userRepo.FindFirst(ctx, spec)
		if err != nil {
			return nil, err
		}
		if user.IsZero() {
			return nil, ungerr.UnauthorizedError("user not found")
		}

		return &GetAdminMeOutput{
			Body: httpapi.NewEnvelope(dto.AdminMe{ID: user.ID, FullName: util.GetNameFromEmail(user.Email)}),
		}, nil
	})
}
