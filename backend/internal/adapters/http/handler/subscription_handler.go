package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type GetSubscribedDetailsInput struct {
	httpapi.AuthInput
}

// Routes returns every route SubscriptionHandler exposes, for registration
// via endpoint.RegisterAll.
func (sh *SubscriptionHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[CreateSubscriptionPurchaseInput, dto.PaymentResponse]{
			OperationID: "create-subscription-purchase",
			Method:      http.MethodPost,
			Path:        "/api/v1/plans/{planID}/versions/{planVersionID}/subscriptions",
			Summary:     "Create a subscription purchase",
			Tags:        []string{"subscriptions"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in CreateSubscriptionPurchaseInput) (dto.PaymentResponse, error) {
				req := dto.PurchaseSubscriptionRequest{
					ProfileID:     in.ProfileID,
					PlanID:        in.PlanID,
					PlanVersionID: in.PlanVersionID,
				}

				return sh.paymentSvc.NewPurchase(ctx, req)
			},
		}),
		endpoint.New(endpoint.Endpoint[GetSubscribedDetailsInput, dto.SubscriptionResponse]{
			OperationID: "get-subscribed-details",
			Method:      http.MethodGet,
			Path:        "/api/v1/profile/subscription",
			Summary:     "Get current subscription details",
			Tags:        []string{"subscriptions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetSubscribedDetailsInput) (dto.SubscriptionResponse, error) {
				return sh.svc.GetSubscribedDetails(ctx, in.ProfileID)
			},
		}),
	}
}
