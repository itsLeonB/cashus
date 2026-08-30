package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
)

type PlanHandler struct {
	svc service.PlanVersionService
}

type GetActivePlansInput struct{}

type GetActivePlansOutput struct {
	Body httpapi.Envelope[[]dto.PlanVersionResponse]
}

// RegisterGetActive registers GET /api/v1/plans on the Huma API.
func (ph *PlanHandler) RegisterGetActive(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-active-plans",
		Method:        http.MethodGet,
		Path:          "/api/v1/plans",
		Summary:       "Get active subscription plans",
		Tags:          []string{"plans"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetActivePlansInput) (*GetActivePlansOutput, error) {
		res, err := ph.svc.GetActive(ctx)
		if err != nil {
			return nil, err
		}

		return &GetActivePlansOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
