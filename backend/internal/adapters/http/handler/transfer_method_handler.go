package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/debts"
	"github.com/itsLeonB/cashback/internal/domain/service"
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

type GetAllTransferMethodsOutput struct {
	Body []dto.TransferMethodResponse
}

// RegisterGetAll registers GET /api/v1/transfer-methods on the Huma API.
func (tmh *TransferMethodHandler) RegisterGetAll(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-transfer-methods",
		Method:        http.MethodGet,
		Path:          "/api/v1/transfer-methods",
		Summary:       "Get all transfer methods",
		Tags:          []string{"transfer-methods"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllTransferMethodsInput) (*GetAllTransferMethodsOutput, error) {
		res, err := tmh.transferMethodService.GetAll(ctx, debts.ParentFilter(in.Status), in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetAllTransferMethodsOutput{Body: res}, nil
	})
}
