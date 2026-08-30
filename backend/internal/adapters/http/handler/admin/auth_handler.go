package admin

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/core/util"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	adminEntity "github.com/itsLeonB/cashback/internal/domain/entity/admin"
	"github.com/itsLeonB/go-authkit/authgin"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
)

type AuthHandler struct {
	stateless *authgin.StatelessHandler
	userRepo  crud.Repository[adminEntity.User]
}

// HandleRegister delegates to authgin.StatelessHandler (an external
// library), so it is intentionally left as a native gin route rather than
// migrated to Huma.
func (ah *AuthHandler) HandleRegister() gin.HandlerFunc {
	return ah.stateless.Register()
}

// HandleLogin delegates to authgin.StatelessHandler (an external library),
// so it is intentionally left as a native gin route rather than migrated to
// Huma.
func (ah *AuthHandler) HandleLogin() gin.HandlerFunc {
	return ah.stateless.Login()
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
