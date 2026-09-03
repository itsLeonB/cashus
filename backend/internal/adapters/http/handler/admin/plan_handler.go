package admin

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type GetPlanListInput struct {
	httpapi.AdminAuthInput
}

type GetPlanInput struct {
	httpapi.AdminAuthInput
	PlanID uuid.UUID `path:"planID"`
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

type DeletePlanInput struct {
	httpapi.AdminAuthInput
	PlanID uuid.UUID `path:"planID"`
}

// Routes returns every route PlanHandler exposes via endpoint.Endpoint, for
// registration via endpoint.RegisterAll.
func (ph *PlanHandler) getAdminPlans(ctx context.Context, in GetPlanListInput) ([]dto.PlanResponse, error) {
	return ph.svc.GetList(ctx)
}

func (ph *PlanHandler) createAdminPlan(ctx context.Context, in CreatePlanInput) (dto.PlanResponse, error) {
	request := dto.NewPlanRequest{
		Name:     in.Body.Name,
		Priority: in.Body.Priority,
	}

	return ph.svc.Create(ctx, request)
}

func (ph *PlanHandler) getAdminPlan(ctx context.Context, in GetPlanInput) (dto.PlanResponse, error) {
	return ph.svc.GetOne(ctx, in.PlanID)
}

func (ph *PlanHandler) updateAdminPlan(ctx context.Context, in UpdatePlanInput) (dto.PlanResponse, error) {
	request := dto.UpdatePlanRequest{
		ID:       in.PlanID,
		Name:     in.Body.Name,
		IsActive: in.Body.IsActive,
		Priority: in.Body.Priority,
	}

	return ph.svc.Update(ctx, request)
}

func (ph *PlanHandler) deleteAdminPlan(ctx context.Context, in DeletePlanInput) (dto.PlanResponse, error) {
	return ph.svc.Delete(ctx, in.PlanID)
}

func (ph *PlanHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewList(endpoint.ListEndpoint[GetPlanListInput, dto.PlanResponse]{
			OperationID: "get-admin-plans",
			Method:      http.MethodGet,
			Path:        "/admin/v1/plans",
			Summary:     "Get all plans",
			Tags:        []string{"admin-plans"},
			Secured:     true,
			HandlerFunc: ph.getAdminPlans,
		}),
		endpoint.New(endpoint.Endpoint[CreatePlanInput, dto.PlanResponse]{
			OperationID: "create-admin-plan",
			Method:      http.MethodPost,
			Path:        "/admin/v1/plans",
			Summary:     "Create a plan",
			Tags:        []string{"admin-plans"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: ph.createAdminPlan,
		}),
		endpoint.New(endpoint.Endpoint[GetPlanInput, dto.PlanResponse]{
			OperationID: "get-admin-plan",
			Method:      http.MethodGet,
			Path:        "/admin/v1/plans/{planID}",
			Summary:     "Get a plan by ID",
			Tags:        []string{"admin-plans"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.getAdminPlan,
		}),
		endpoint.New(endpoint.Endpoint[UpdatePlanInput, dto.PlanResponse]{
			OperationID: "update-admin-plan",
			Method:      http.MethodPut,
			Path:        "/admin/v1/plans/{planID}",
			Summary:     "Update a plan",
			Tags:        []string{"admin-plans"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.updateAdminPlan,
		}),
		endpoint.New(endpoint.Endpoint[DeletePlanInput, dto.PlanResponse]{
			OperationID: "delete-admin-plan",
			Method:      http.MethodDelete,
			Path:        "/admin/v1/plans/{planID}",
			Summary:     "Delete a plan",
			Tags:        []string{"admin-plans"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.deleteAdminPlan,
		}),
	}
}
