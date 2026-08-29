package admin

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
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

type CreateSubscriptionOutput struct {
	Body dto.SubscriptionResponse
}

// RegisterCreate registers POST /admin/v1/subscriptions on the Huma API.
func (sh *SubscriptionHandler) RegisterCreate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-admin-subscription",
		Method:        http.MethodPost,
		Path:          "/admin/v1/subscriptions",
		Summary:       "Create a subscription",
		Tags:          []string{"admin-subscriptions"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreateSubscriptionInput) (*CreateSubscriptionOutput, error) {
		request := dto.NewSubscriptionRequest{
			ProfileID:     in.Body.ProfileID,
			PlanVersionID: in.Body.PlanVersionID,
			EndsAt:        in.Body.EndsAt,
			CanceledAt:    in.Body.CanceledAt,
			AutoRenew:     in.Body.AutoRenew,
		}

		res, err := sh.svc.Create(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreateSubscriptionOutput{Body: res}, nil
	})
}

type GetSubscriptionListInput struct {
	httpapi.AdminAuthInput
}

type GetSubscriptionListOutput struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        []dto.SubscriptionResponse
}

// RegisterGetList registers GET /admin/v1/subscriptions on the Huma API.
func (sh *SubscriptionHandler) RegisterGetList(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-subscriptions",
		Method:        http.MethodGet,
		Path:          "/admin/v1/subscriptions",
		Summary:       "Get all subscriptions",
		Tags:          []string{"admin-subscriptions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetSubscriptionListInput) (*GetSubscriptionListOutput, error) {
		res, err := sh.svc.GetList(ctx)
		if err != nil {
			return nil, err
		}

		return &GetSubscriptionListOutput{XTotalCount: len(res), Body: res}, nil
	})
}

type GetSubscriptionInput struct {
	httpapi.AdminAuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

type GetSubscriptionOutput struct {
	Body dto.SubscriptionResponse
}

// RegisterGetOne registers GET /admin/v1/subscriptions/{subscriptionID} on the Huma API.
func (sh *SubscriptionHandler) RegisterGetOne(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-subscription",
		Method:        http.MethodGet,
		Path:          "/admin/v1/subscriptions/{subscriptionID}",
		Summary:       "Get a subscription by ID",
		Tags:          []string{"admin-subscriptions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetSubscriptionInput) (*GetSubscriptionOutput, error) {
		res, err := sh.svc.GetOne(ctx, in.SubscriptionID)
		if err != nil {
			return nil, err
		}

		return &GetSubscriptionOutput{Body: res}, nil
	})
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

type UpdateSubscriptionOutput struct {
	Body dto.SubscriptionResponse
}

// RegisterUpdate registers PUT /admin/v1/subscriptions/{subscriptionID} on the Huma API.
func (sh *SubscriptionHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-admin-subscription",
		Method:        http.MethodPut,
		Path:          "/admin/v1/subscriptions/{subscriptionID}",
		Summary:       "Update a subscription",
		Tags:          []string{"admin-subscriptions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdateSubscriptionInput) (*UpdateSubscriptionOutput, error) {
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

		res, err := sh.svc.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdateSubscriptionOutput{Body: res}, nil
	})
}

type DeleteSubscriptionInput struct {
	httpapi.AdminAuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

type DeleteSubscriptionOutput struct {
	Body dto.SubscriptionResponse
}

// RegisterDelete registers DELETE /admin/v1/subscriptions/{subscriptionID} on the Huma API.
func (sh *SubscriptionHandler) RegisterDelete(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "delete-admin-subscription",
		Method:        http.MethodDelete,
		Path:          "/admin/v1/subscriptions/{subscriptionID}",
		Summary:       "Delete a subscription",
		Tags:          []string{"admin-subscriptions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *DeleteSubscriptionInput) (*DeleteSubscriptionOutput, error) {
		res, err := sh.svc.Delete(ctx, in.SubscriptionID)
		if err != nil {
			return nil, err
		}

		return &DeleteSubscriptionOutput{Body: res}, nil
	})
}
