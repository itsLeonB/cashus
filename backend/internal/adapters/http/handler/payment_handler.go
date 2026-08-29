package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
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

// RegisterNotification registers POST /api/v1/payments/midtrans/notifications on the Huma API.
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
	SubscriptionID uuid.UUID `path:"subscriptionID"`
}

type MakePaymentOutput struct {
	Body dto.PaymentResponse
}

// RegisterMakePayment registers POST /api/v1/subscriptions/{subscriptionID} on the Huma API.
func (ph *PaymentHandler) RegisterMakePayment(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "make-payment",
		Method:        http.MethodPost,
		Path:          "/api/v1/subscriptions/{subscriptionID}",
		Summary:       "Make a payment for a subscription",
		Tags:          []string{"payments"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *MakePaymentInput) (*MakePaymentOutput, error) {
		res, err := ph.svc.MakePayment(ctx, in.SubscriptionID)
		if err != nil {
			return nil, err
		}

		return &MakePaymentOutput{Body: res}, nil
	})
}
