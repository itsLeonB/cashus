package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type PaymentHandler struct {
	svc service.PaymentService
}

type HandleMidtransNotificationInput struct {
	Body struct {
		OrderID       string `json:"order_id"`
		StatusCode    string `json:"status_code"`
		GrossAmount   string `json:"gross_amount"`
		SignatureKey  string `json:"signature_key"`
		StatusMessage string `json:"status_message,omitempty"`
	}
}

type HandleMidtransNotificationOutput struct{}

// RegisterNotification registers POST /api/v1/payments/midtrans/notifications
// on the Huma API. Left as endpoint.NoBodyEndpoint-shaped but hand-written
// (not migrated) on purpose: Midtrans's webhook-ack contract isn't
// documented anywhere in this repo, and this codebase can't reach Midtrans's
// docs to confirm it tolerates 204 in place of the 200 it gets today.
// Converting would only change the status code (Output has no Body field
// either way), but until that's verified, changing the status Midtrans sees
// is not a risk worth taking silently — flagged for a human decision.
func (ph *PaymentHandler) RegisterNotification(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "handle-midtrans-notification",
		Method:        http.MethodPost,
		Path:          "/api/v1/payments/midtrans/notifications",
		Summary:       "Handle Midtrans payment notification",
		Tags:          []string{"payments"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *HandleMidtransNotificationInput) (*HandleMidtransNotificationOutput, error) {
		req := dto.MidtransNotificationPayload{
			OrderID:       in.Body.OrderID,
			StatusCode:    in.Body.StatusCode,
			GrossAmount:   in.Body.GrossAmount,
			SignatureKey:  in.Body.SignatureKey,
			StatusMessage: in.Body.StatusMessage,
		}

		if err := ph.svc.HandleNotification(ctx, req); err != nil {
			return nil, err
		}

		return &HandleMidtransNotificationOutput{}, nil
	})
}

type MakePaymentInput struct {
	httpapi.AuthInput
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

// Routes returns every route PaymentHandler exposes via endpoint.Endpoint,
// for registration via endpoint.RegisterAll. RegisterNotification is
// registered separately (hand-written) because it's an unauthenticated
// webhook with a bodyless response.
func (ph *PaymentHandler) makePayment(ctx context.Context, in MakePaymentInput) (dto.PaymentResponse, error) {
	return ph.svc.MakePayment(ctx, in.ProfileID, in.SubscriptionID)
}

func (ph *PaymentHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[MakePaymentInput, dto.PaymentResponse]{
			OperationID: "make-payment",
			Method:      http.MethodPost,
			Path:        "/api/v1/subscriptions/{subscriptionID}",
			Summary:     "Make a payment for a subscription",
			Tags:        []string{"payments"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: ph.makePayment,
		}),
	}
}
