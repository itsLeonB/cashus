package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
)

type SubscriptionHandler struct {
	svc        service.SubscriptionService
	paymentSvc service.PaymentService
}

type CreateSubscriptionPurchaseInput struct {
	httpapi.AuthInput
	PlanID        uuid.UUID `path:"planID"`
	PlanVersionID uuid.UUID `path:"planVersionID"`
}

type CreateSubscriptionPurchaseOutput struct {
	Body dto.PaymentResponse
}

// RegisterCreatePurchase registers POST /api/v1/plans/{planID}/versions/{planVersionID}/subscriptions on the Huma API.
func (sh *SubscriptionHandler) RegisterCreatePurchase(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-subscription-purchase",
		Method:        http.MethodPost,
		Path:          "/api/v1/plans/{planID}/versions/{planVersionID}/subscriptions",
		Summary:       "Create a subscription purchase",
		Tags:          []string{"subscriptions"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreateSubscriptionPurchaseInput) (*CreateSubscriptionPurchaseOutput, error) {
		req := dto.PurchaseSubscriptionRequest{
			ProfileID:     in.ProfileID,
			PlanID:        in.PlanID,
			PlanVersionID: in.PlanVersionID,
		}

		res, err := sh.paymentSvc.NewPurchase(ctx, req)
		if err != nil {
			return nil, err
		}

		return &CreateSubscriptionPurchaseOutput{Body: res}, nil
	})
}

type GetSubscribedDetailsInput struct {
	httpapi.AuthInput
}

type GetSubscribedDetailsOutput struct {
	Body dto.SubscriptionResponse
}

// RegisterGetSubscribedDetails registers GET /api/v1/profile/subscription on the Huma API.
func (sh *SubscriptionHandler) RegisterGetSubscribedDetails(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-subscribed-details",
		Method:        http.MethodGet,
		Path:          "/api/v1/profile/subscription",
		Summary:       "Get current subscription details",
		Tags:          []string{"subscriptions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetSubscribedDetailsInput) (*GetSubscribedDetailsOutput, error) {
		res, err := sh.svc.GetSubscribedDetails(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetSubscribedDetailsOutput{Body: res}, nil
	})
}
