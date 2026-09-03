package handler

import (
	"context"
	"net/http"

	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/debts"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type TransferMethodHandler struct {
	transferMethodService service.TransferMethodService
}

func NewTransferMethodHandler(transferMethodService service.TransferMethodService) *TransferMethodHandler {
	return &TransferMethodHandler{transferMethodService}
}

type GetAllTransferMethodsInput struct {
	httpapi.AuthInput
	Status string `query:"status"`
}

// Routes returns every route TransferMethodHandler exposes, for registration
// via endpoint.RegisterAll.
func (tmh *TransferMethodHandler) getTransferMethods(ctx context.Context, in GetAllTransferMethodsInput) ([]dto.TransferMethodResponse, error) {
	return tmh.transferMethodService.GetAll(ctx, debts.ParentFilter(in.Status), in.ProfileID)
}

func (tmh *TransferMethodHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetAllTransferMethodsInput, []dto.TransferMethodResponse]{
			OperationID: "get-transfer-methods",
			Method:      http.MethodGet,
			Path:        "/api/v1/transfer-methods",
			Summary:     "Get all transfer methods",
			Tags:        []string{"transfer-methods"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: tmh.getTransferMethods,
		}),
	}
}
