package admin

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
)

type PlanHandler struct {
	svc service.PlanService
}

type CreatePlanInput struct {
	httpapi.AdminAuthInput
	Body struct {
		Name     string `json:"name" minLength:"3"`
		Priority int    `json:"priority"`
	}
}

type CreatePlanOutput struct {
	Body httpapi.Envelope[dto.PlanResponse]
}

// RegisterCreate registers POST /admin/v1/plans on the Huma API.
func (ph *PlanHandler) RegisterCreate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-admin-plan",
		Method:        http.MethodPost,
		Path:          "/admin/v1/plans",
		Summary:       "Create a plan",
		Tags:          []string{"admin-plans"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreatePlanInput) (*CreatePlanOutput, error) {
		request := dto.NewPlanRequest{
			Name:     in.Body.Name,
			Priority: in.Body.Priority,
		}

		res, err := ph.svc.Create(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreatePlanOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetPlanListInput struct {
	httpapi.AdminAuthInput
}

type GetPlanListOutput struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        httpapi.Envelope[[]dto.PlanResponse]
}

// RegisterGetList registers GET /admin/v1/plans on the Huma API.
func (ph *PlanHandler) RegisterGetList(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-plans",
		Method:        http.MethodGet,
		Path:          "/admin/v1/plans",
		Summary:       "Get all plans",
		Tags:          []string{"admin-plans"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPlanListInput) (*GetPlanListOutput, error) {
		res, err := ph.svc.GetList(ctx)
		if err != nil {
			return nil, err
		}

		return &GetPlanListOutput{XTotalCount: len(res), Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetPlanInput struct {
	httpapi.AdminAuthInput
	PlanID uuid.UUID `path:"planID"`
}

type GetPlanOutput struct {
	Body httpapi.Envelope[dto.PlanResponse]
}

// RegisterGetOne registers GET /admin/v1/plans/{planID} on the Huma API.
func (ph *PlanHandler) RegisterGetOne(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-plan",
		Method:        http.MethodGet,
		Path:          "/admin/v1/plans/{planID}",
		Summary:       "Get a plan by ID",
		Tags:          []string{"admin-plans"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPlanInput) (*GetPlanOutput, error) {
		res, err := ph.svc.GetOne(ctx, in.PlanID)
		if err != nil {
			return nil, err
		}

		return &GetPlanOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type UpdatePlanInput struct {
	httpapi.AdminAuthInput
	PlanID uuid.UUID `path:"planID"`
	Body   struct {
		Name     string `json:"name" minLength:"3"`
		IsActive bool   `json:"isActive"`
		Priority int    `json:"priority"`
	}
}

type UpdatePlanOutput struct {
	Body httpapi.Envelope[dto.PlanResponse]
}

// RegisterUpdate registers PUT /admin/v1/plans/{planID} on the Huma API.
func (ph *PlanHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-admin-plan",
		Method:        http.MethodPut,
		Path:          "/admin/v1/plans/{planID}",
		Summary:       "Update a plan",
		Tags:          []string{"admin-plans"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdatePlanInput) (*UpdatePlanOutput, error) {
		request := dto.UpdatePlanRequest{
			ID:       in.PlanID,
			Name:     in.Body.Name,
			IsActive: in.Body.IsActive,
			Priority: in.Body.Priority,
		}

		res, err := ph.svc.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdatePlanOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type DeletePlanInput struct {
	httpapi.AdminAuthInput
	PlanID uuid.UUID `path:"planID"`
}

type DeletePlanOutput struct {
	Body httpapi.Envelope[dto.PlanResponse]
}

// RegisterDelete registers DELETE /admin/v1/plans/{planID} on the Huma API.
func (ph *PlanHandler) RegisterDelete(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "delete-admin-plan",
		Method:        http.MethodDelete,
		Path:          "/admin/v1/plans/{planID}",
		Summary:       "Delete a plan",
		Tags:          []string{"admin-plans"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *DeletePlanInput) (*DeletePlanOutput, error) {
		res, err := ph.svc.Delete(ctx, in.PlanID)
		if err != nil {
			return nil, err
		}

		return &DeletePlanOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
