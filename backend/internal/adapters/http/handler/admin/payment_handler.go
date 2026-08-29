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

type PaymentHandler struct {
	svc service.PaymentService
}

type GetPaymentListInput struct {
	httpapi.AdminAuthInput
}

type GetPaymentListOutput struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        []dto.PaymentResponse
}

// RegisterGetList registers GET /admin/v1/payments on the Huma API.
func (ph *PaymentHandler) RegisterGetList(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-payments",
		Method:        http.MethodGet,
		Path:          "/admin/v1/payments",
		Summary:       "Get all payments",
		Tags:          []string{"admin-payments"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPaymentListInput) (*GetPaymentListOutput, error) {
		res, err := ph.svc.GetList(ctx)
		if err != nil {
			return nil, err
		}

		return &GetPaymentListOutput{XTotalCount: len(res), Body: res}, nil
	})
}

type GetPaymentInput struct {
	httpapi.AdminAuthInput
	PaymentID uuid.UUID `path:"paymentID"`
}

type GetPaymentOutput struct {
	Body dto.PaymentResponse
}

// RegisterGetOne registers GET /admin/v1/payments/{paymentID} on the Huma API.
func (ph *PaymentHandler) RegisterGetOne(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-payment",
		Method:        http.MethodGet,
		Path:          "/admin/v1/payments/{paymentID}",
		Summary:       "Get a payment by ID",
		Tags:          []string{"admin-payments"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPaymentInput) (*GetPaymentOutput, error) {
		res, err := ph.svc.GetOne(ctx, in.PaymentID)
		if err != nil {
			return nil, err
		}

		return &GetPaymentOutput{Body: res}, nil
	})
}

type UpdatePaymentInput struct {
	httpapi.AdminAuthInput
	PaymentID uuid.UUID `path:"paymentID"`
	Body      struct {
		Status   string          `json:"status" enum:"pending,processing,paid,canceled,error,expired"`
		Amount   httpapi.Decimal `json:"amount"`
		Currency string          `json:"currency"`
		StartsAt time.Time       `json:"startsAt,omitempty"`
		EndsAt   time.Time       `json:"endsAt,omitempty"`
		PaidAt   time.Time       `json:"paidAt,omitempty"`
	}
}

type UpdatePaymentOutput struct {
	Body dto.PaymentResponse
}

// RegisterUpdate registers PUT /admin/v1/payments/{paymentID} on the Huma API.
func (ph *PaymentHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-admin-payment",
		Method:        http.MethodPut,
		Path:          "/admin/v1/payments/{paymentID}",
		Summary:       "Update a payment",
		Tags:          []string{"admin-payments"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdatePaymentInput) (*UpdatePaymentOutput, error) {
		request := dto.UpdatePaymentRequest{
			ID:       in.PaymentID,
			Status:   in.Body.Status,
			Amount:   in.Body.Amount.Decimal,
			Currency: in.Body.Currency,
			StartsAt: in.Body.StartsAt,
			EndsAt:   in.Body.EndsAt,
			PaidAt:   in.Body.PaidAt,
		}

		res, err := ph.svc.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdatePaymentOutput{Body: res}, nil
	})
}

type DeletePaymentInput struct {
	httpapi.AdminAuthInput
	PaymentID uuid.UUID `path:"paymentID"`
}

type DeletePaymentOutput struct {
	Body dto.PaymentResponse
}

// RegisterDelete registers DELETE /admin/v1/payments/{paymentID} on the Huma API.
func (ph *PaymentHandler) RegisterDelete(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "delete-admin-payment",
		Method:        http.MethodDelete,
		Path:          "/admin/v1/payments/{paymentID}",
		Summary:       "Delete a payment",
		Tags:          []string{"admin-payments"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *DeletePaymentInput) (*DeletePaymentOutput, error) {
		res, err := ph.svc.Delete(ctx, in.PaymentID)
		if err != nil {
			return nil, err
		}

		return &DeletePaymentOutput{Body: res}, nil
	})
}
