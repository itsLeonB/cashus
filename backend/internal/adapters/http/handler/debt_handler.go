package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
)

type DebtHandler struct {
	debtService service.DebtService
}

func NewDebtHandler(debtService service.DebtService) *DebtHandler {
	return &DebtHandler{debtService}
}

type CreateDebtInput struct {
	httpapi.AuthInput
	Body struct {
		FriendProfileID  uuid.UUID                    `json:"friendProfileId"`
		Direction        dto.DebtTransactionDirection `json:"direction" enum:"INCOMING,OUTGOING"`
		Currency         string                       `json:"currency" minLength:"3" maxLength:"3"`
		Amount           httpapi.Decimal              `json:"amount"`
		TransferMethodID uuid.UUID                    `json:"transferMethodId"`
		Description      string                       `json:"description,omitempty"`
	}
}

type CreateDebtOutput struct {
	Body dto.DebtTransactionResponse
}

// RegisterCreate registers POST /api/v1/debts on the Huma API.
func (dh *DebtHandler) RegisterCreate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-debt",
		Method:        http.MethodPost,
		Path:          "/api/v1/debts",
		Summary:       "Record a new debt transaction",
		Tags:          []string{"debts"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreateDebtInput) (*CreateDebtOutput, error) {
		request := dto.NewDebtTransactionRequest{
			UserProfileID:    in.ProfileID,
			FriendProfileID:  in.Body.FriendProfileID,
			Direction:        in.Body.Direction,
			Currency:         in.Body.Currency,
			Amount:           in.Body.Amount.Decimal,
			TransferMethodID: in.Body.TransferMethodID,
			Description:      in.Body.Description,
		}

		res, err := dh.debtService.RecordNewTransaction(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreateDebtOutput{Body: res}, nil
	})
}

type GetAllDebtsInput struct {
	httpapi.AuthInput
}

type GetAllDebtsOutput struct {
	Body []dto.DebtTransactionResponse
}

// RegisterGetAll registers GET /api/v1/debts on the Huma API.
func (dh *DebtHandler) RegisterGetAll(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-debts",
		Method:        http.MethodGet,
		Path:          "/api/v1/debts",
		Summary:       "Get all debt transactions",
		Tags:          []string{"debts"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllDebtsInput) (*GetAllDebtsOutput, error) {
		res, err := dh.debtService.GetTransactions(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetAllDebtsOutput{Body: res}, nil
	})
}

type GetDebtsSummaryInput struct {
	httpapi.AuthInput
}

type GetDebtsSummaryOutput struct {
	Body map[string]dto.FriendBalance
}

// RegisterGetTransactionSummary registers GET /api/v1/debts/summary on the Huma API.
func (dh *DebtHandler) RegisterGetTransactionSummary(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-debts-summary",
		Method:        http.MethodGet,
		Path:          "/api/v1/debts/summary",
		Summary:       "Get debt transaction summary",
		Tags:          []string{"debts"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetDebtsSummaryInput) (*GetDebtsSummaryOutput, error) {
		res, err := dh.debtService.GetTransactionSummary(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetDebtsSummaryOutput{Body: res}, nil
	})
}

type GetRecentDebtsInput struct {
	httpapi.AuthInput
}

type GetRecentDebtsOutput struct {
	Body []dto.DebtTransactionResponse
}

// RegisterGetRecent registers GET /api/v1/debts/recent on the Huma API.
func (dh *DebtHandler) RegisterGetRecent(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-recent-debts",
		Method:        http.MethodGet,
		Path:          "/api/v1/debts/recent",
		Summary:       "Get recent debt transactions",
		Tags:          []string{"debts"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetRecentDebtsInput) (*GetRecentDebtsOutput, error) {
		res, err := dh.debtService.GetRecent(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetRecentDebtsOutput{Body: res}, nil
	})
}
