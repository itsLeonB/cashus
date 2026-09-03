package admin

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type SubscriptionHandler struct {
	svc service.SubscriptionService
}

type CreateSubscriptionInput struct {
	httpapi.AdminAuthInput
	Body struct {
		ProfileID     uuid.UUID `json:"profileId"`
		PlanVersionID uuid.UUID `json:"planVersionId"`
		EndsAt        time.Time `json:"endsAt,omitempty"`
		CanceledAt    time.Time `json:"canceledAt,omitempty"`
		AutoRenew     bool      `json:"autoRenew,omitempty"`
	}
}

type GetSubscriptionListInput struct {
	httpapi.AdminAuthInput
}

type GetSubscriptionInput struct {
	httpapi.AdminAuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

type UpdateSubscriptionInput struct {
	httpapi.AdminAuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
	Body           struct {
		ProfileID          uuid.UUID `json:"profileId"`
		PlanVersionID      uuid.UUID `json:"planVersionId"`
		EndsAt             time.Time `json:"endsAt,omitempty"`
		CanceledAt         time.Time `json:"canceledAt,omitempty"`
		AutoRenew          bool      `json:"autoRenew,omitempty"`
		Status             string    `json:"status" enum:"incomplete_payment,active,past_due_payment,canceled"`
		CurrentPeriodStart time.Time `json:"currentPeriodStart,omitempty"`
		CurrentPeriodEnd   time.Time `json:"currentPeriodEnd,omitempty"`
	}
}

type DeleteSubscriptionInput struct {
	httpapi.AdminAuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

// Routes returns every route SubscriptionHandler exposes via
// endpoint.Endpoint, for registration via endpoint.RegisterAll.
func (sh *SubscriptionHandler) getAdminSubscriptions(ctx context.Context, in GetSubscriptionListInput) ([]dto.SubscriptionResponse, error) {
	return sh.svc.GetList(ctx)
}

func (sh *SubscriptionHandler) createAdminSubscription(ctx context.Context, in CreateSubscriptionInput) (dto.SubscriptionResponse, error) {
	request := dto.NewSubscriptionRequest{
		ProfileID:     in.Body.ProfileID,
		PlanVersionID: in.Body.PlanVersionID,
		EndsAt:        in.Body.EndsAt,
		CanceledAt:    in.Body.CanceledAt,
		AutoRenew:     in.Body.AutoRenew,
	}

	return sh.svc.Create(ctx, request)
}

func (sh *SubscriptionHandler) getAdminSubscription(ctx context.Context, in GetSubscriptionInput) (dto.SubscriptionResponse, error) {
	return sh.svc.GetOne(ctx, in.SubscriptionID)
}

func (sh *SubscriptionHandler) updateAdminSubscription(ctx context.Context, in UpdateSubscriptionInput) (dto.SubscriptionResponse, error) {
	request := dto.UpdateSubscriptionRequest{
		ID:                 in.SubscriptionID,
		ProfileID:          in.Body.ProfileID,
		PlanVersionID:      in.Body.PlanVersionID,
		EndsAt:             in.Body.EndsAt,
		CanceledAt:         in.Body.CanceledAt,
		AutoRenew:          in.Body.AutoRenew,
		Status:             in.Body.Status,
		CurrentPeriodStart: in.Body.CurrentPeriodStart,
		CurrentPeriodEnd:   in.Body.CurrentPeriodEnd,
	}

	return sh.svc.Update(ctx, request)
}

func (sh *SubscriptionHandler) deleteAdminSubscription(ctx context.Context, in DeleteSubscriptionInput) (dto.SubscriptionResponse, error) {
	return sh.svc.Delete(ctx, in.SubscriptionID)
}

func (sh *SubscriptionHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewList(endpoint.ListEndpoint[GetSubscriptionListInput, dto.SubscriptionResponse]{
			OperationID: "get-admin-subscriptions",
			Method:      http.MethodGet,
			Path:        "/admin/v1/subscriptions",
			Summary:     "Get all subscriptions",
			Tags:        []string{"admin-subscriptions"},
			Secured:     true,
			HandlerFunc: sh.getAdminSubscriptions,
		}),
		endpoint.New(endpoint.Endpoint[CreateSubscriptionInput, dto.SubscriptionResponse]{
			OperationID: "create-admin-subscription",
			Method:      http.MethodPost,
			Path:        "/admin/v1/subscriptions",
			Summary:     "Create a subscription",
			Tags:        []string{"admin-subscriptions"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: sh.createAdminSubscription,
		}),
		endpoint.New(endpoint.Endpoint[GetSubscriptionInput, dto.SubscriptionResponse]{
			OperationID: "get-admin-subscription",
			Method:      http.MethodGet,
			Path:        "/admin/v1/subscriptions/{subscriptionID}",
			Summary:     "Get a subscription by ID",
			Tags:        []string{"admin-subscriptions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: sh.getAdminSubscription,
		}),
		endpoint.New(endpoint.Endpoint[UpdateSubscriptionInput, dto.SubscriptionResponse]{
			OperationID: "update-admin-subscription",
			Method:      http.MethodPut,
			Path:        "/admin/v1/subscriptions/{subscriptionID}",
			Summary:     "Update a subscription",
			Tags:        []string{"admin-subscriptions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: sh.updateAdminSubscription,
		}),
		endpoint.New(endpoint.Endpoint[DeleteSubscriptionInput, dto.SubscriptionResponse]{
			OperationID: "delete-admin-subscription",
			Method:      http.MethodDelete,
			Path:        "/admin/v1/subscriptions/{subscriptionID}",
			Summary:     "Delete a subscription",
			Tags:        []string{"admin-subscriptions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: sh.deleteAdminSubscription,
		}),
	}
}
