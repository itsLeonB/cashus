package handler

import (
	"context"
	"net/http"

	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type UnsubscribeFromPushInput struct {
	httpapi.AuthInput
	Body struct {
		Endpoint string `json:"endpoint"`
	}
}

// Routes returns every route PushSubscriptionHandler exposes via
// endpoint.NoBodyEndpoint, for registration via endpoint.RegisterAll.
func (h *PushSubscriptionHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[SubscribeToPushInput]{
			OperationID: "subscribe-to-push",
			Method:      http.MethodPost,
			Path:        "/api/v1/push/subscribe",
			Summary:     "Subscribe to push notifications",
			Tags:        []string{"push"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in SubscribeToPushInput) error {
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

				return h.pushNotificationSvc.Subscribe(ctx, request)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[UnsubscribeFromPushInput]{
			OperationID: "unsubscribe-from-push",
			Method:      http.MethodPost,
			Path:        "/api/v1/push/unsubscribe",
			Summary:     "Unsubscribe from push notifications",
			Tags:        []string{"push"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in UnsubscribeFromPushInput) error {
				request := dto.PushUnsubscribeRequest{
					ProfileID: in.ProfileID,
					Endpoint:  in.Body.Endpoint,
				}

				return h.pushNotificationSvc.Unsubscribe(ctx, request)
			},
		}),
	}
}
