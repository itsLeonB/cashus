package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
)

type PushSubscriptionHandler struct {
	pushNotificationSvc service.PushNotificationService
}

func NewPushSubscriptionHandler(pushSubscriptionService service.PushNotificationService) *PushSubscriptionHandler {
	return &PushSubscriptionHandler{pushSubscriptionService}
}

type SubscribeToPushInput struct {
	httpapi.AuthInput
	httpapi.SessionInput
	Body struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
		UserAgent string `json:"userAgent,omitempty"`
	}
}

type SubscribeToPushOutput struct{}

// RegisterSubscribe registers POST /api/v1/push/subscribe on the Huma API.
func (h *PushSubscriptionHandler) RegisterSubscribe(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "subscribe-to-push",
		Method:        http.MethodPost,
		Path:          "/api/v1/push/subscribe",
		Summary:       "Subscribe to push notifications",
		Tags:          []string{"push"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *SubscribeToPushInput) (*SubscribeToPushOutput, error) {
		request := dto.PushSubscriptionRequest{
			ProfileID: in.ProfileID,
			SessionID: in.SessionID,
			Endpoint:  in.Body.Endpoint,
			Keys: dto.PushSubscriptionKeys{
				P256dh: in.Body.Keys.P256dh,
				Auth:   in.Body.Keys.Auth,
			},
			UserAgent: in.Body.UserAgent,
		}

		if err := h.pushNotificationSvc.Subscribe(ctx, request); err != nil {
			return nil, err
		}

		return &SubscribeToPushOutput{}, nil
	})
}

type UnsubscribeFromPushInput struct {
	httpapi.AuthInput
	Body struct {
		Endpoint string `json:"endpoint"`
	}
}

type UnsubscribeFromPushOutput struct{}

// RegisterUnsubscribe registers POST /api/v1/push/unsubscribe on the Huma API.
func (h *PushSubscriptionHandler) RegisterUnsubscribe(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "unsubscribe-from-push",
		Method:        http.MethodPost,
		Path:          "/api/v1/push/unsubscribe",
		Summary:       "Unsubscribe from push notifications",
		Tags:          []string{"push"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UnsubscribeFromPushInput) (*UnsubscribeFromPushOutput, error) {
		request := dto.PushUnsubscribeRequest{
			ProfileID: in.ProfileID,
			Endpoint:  in.Body.Endpoint,
		}

		if err := h.pushNotificationSvc.Unsubscribe(ctx, request); err != nil {
			return nil, err
		}

		return &UnsubscribeFromPushOutput{}, nil
	})
}
