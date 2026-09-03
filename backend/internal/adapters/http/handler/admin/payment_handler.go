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

type PaymentHandler struct {
	svc service.PaymentService
}

// Routes returns every route PaymentHandler exposes via endpoint.Endpoint,
// for registration via endpoint.RegisterAll.
func (ph *PaymentHandler) getAdminPayments(ctx context.Context, in GetPaymentListInput) ([]dto.PaymentResponse, error) {
	return ph.svc.GetList(ctx)
}

func (ph *PaymentHandler) getAdminPayment(ctx context.Context, in GetPaymentInput) (dto.PaymentResponse, error) {
	return ph.svc.GetOne(ctx, in.PaymentID)
}

func (ph *PaymentHandler) updateAdminPayment(ctx context.Context, in UpdatePaymentInput) (dto.PaymentResponse, error) {
	request := dto.UpdatePaymentRequest{
		ID:       in.PaymentID,
		Status:   in.Body.Status,
		Amount:   in.Body.Amount.Decimal,
		Currency: in.Body.Currency,
		StartsAt: in.Body.StartsAt,
		EndsAt:   in.Body.EndsAt,
		PaidAt:   in.Body.PaidAt,
	}

	return ph.svc.Update(ctx, request)
}

func (ph *PaymentHandler) deleteAdminPayment(ctx context.Context, in DeletePaymentInput) (dto.PaymentResponse, error) {
	return ph.svc.Delete(ctx, in.PaymentID)
}

func (ph *PaymentHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewList(endpoint.ListEndpoint[GetPaymentListInput, dto.PaymentResponse]{
			OperationID: "get-admin-payments",
			Method:      http.MethodGet,
			Path:        "/admin/v1/payments",
			Summary:     "Get all payments",
			Tags:        []string{"admin-payments"},
			Secured:     true,
			HandlerFunc: ph.getAdminPayments,
		}),
		endpoint.New(endpoint.Endpoint[GetPaymentInput, dto.PaymentResponse]{
			OperationID: "get-admin-payment",
			Method:      http.MethodGet,
			Path:        "/admin/v1/payments/{paymentID}",
			Summary:     "Get a payment by ID",
			Tags:        []string{"admin-payments"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.getAdminPayment,
		}),
		endpoint.New(endpoint.Endpoint[UpdatePaymentInput, dto.PaymentResponse]{
			OperationID: "update-admin-payment",
			Method:      http.MethodPut,
			Path:        "/admin/v1/payments/{paymentID}",
			Summary:     "Update a payment",
			Tags:        []string{"admin-payments"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.updateAdminPayment,
		}),
		endpoint.New(endpoint.Endpoint[DeletePaymentInput, dto.PaymentResponse]{
			OperationID: "delete-admin-payment",
			Method:      http.MethodDelete,
			Path:        "/admin/v1/payments/{paymentID}",
			Summary:     "Delete a payment",
			Tags:        []string{"admin-payments"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.deleteAdminPayment,
		}),
	}
}

type GetPaymentListInput struct {
	httpapi.AdminAuthInput
}

type GetPaymentInput struct {
	httpapi.AdminAuthInput
	PaymentID uuid.UUID `path:"paymentID"`
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

type DeletePaymentInput struct {
	httpapi.AdminAuthInput
	PaymentID uuid.UUID `path:"paymentID"`
}
