package admin

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
)

type ProfileHandler struct {
	svc service.ProfileService
}

type GetAdminProfileListInput struct {
	httpapi.AdminAuthInput
}

type GetAdminProfileListOutput struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        httpapi.Envelope[[]dto.ProfileResponse]
}

// RegisterGetList registers GET /admin/v1/profiles on the Huma API.
func (ph *ProfileHandler) RegisterGetList(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-profiles",
		Method:        http.MethodGet,
		Path:          "/admin/v1/profiles",
		Summary:       "Get all real profiles",
		Tags:          []string{"admin-profiles"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAdminProfileListInput) (*GetAdminProfileListOutput, error) {
		res, err := ph.svc.GetAllReal(ctx)
		if err != nil {
			return nil, err
		}

		return &GetAdminProfileListOutput{XTotalCount: len(res), Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetAdminProfileInput struct {
	httpapi.AdminAuthInput
	ProfileID uuid.UUID `path:"profileID"`
}

type GetAdminProfileOutput struct {
	Body httpapi.Envelope[dto.ProfileResponse]
}

// RegisterGetOne registers GET /admin/v1/profiles/{profileID} on the Huma API.
func (ph *ProfileHandler) RegisterGetOne(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-profile",
		Method:        http.MethodGet,
		Path:          "/admin/v1/profiles/{profileID}",
		Summary:       "Get a profile by ID",
		Tags:          []string{"admin-profiles"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAdminProfileInput) (*GetAdminProfileOutput, error) {
		res, err := ph.svc.GetByID(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetAdminProfileOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
