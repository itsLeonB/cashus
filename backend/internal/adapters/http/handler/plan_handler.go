package handler

import (
	"context"
	"net/http"

	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type PlanHandler struct {
	svc service.PlanVersionService
}

type GetActivePlansInput struct{}

// Routes returns every route PlanHandler exposes, for registration via
// endpoint.RegisterAll.
func (ph *PlanHandler) getActivePlans(ctx context.Context, in GetActivePlansInput) ([]dto.PlanVersionResponse, error) {
	return ph.svc.GetActive(ctx)
}

func (ph *PlanHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetActivePlansInput, []dto.PlanVersionResponse]{
			OperationID: "get-active-plans",
			Method:      http.MethodGet,
			Path:        "/api/v1/plans",
			Summary:     "Get active subscription plans",
			Tags:        []string{"plans"},
			SuccessCode: http.StatusOK,
			HandlerFunc: ph.getActivePlans,
		}),
	}
}
