package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type GetAllDebtsInput struct {
	httpapi.AuthInput
}

type GetDebtsSummaryInput struct {
	httpapi.AuthInput
}

type GetRecentDebtsInput struct {
	httpapi.AuthInput
}

// Routes returns every route DebtHandler exposes, for registration via
// endpoint.RegisterAll.
func (dh *DebtHandler) createDebt(ctx context.Context, in CreateDebtInput) (dto.DebtTransactionResponse, error) {
	request := dto.NewDebtTransactionRequest{
		UserProfileID:    in.ProfileID,
		FriendProfileID:  in.Body.FriendProfileID,
		Direction:        in.Body.Direction,
		Currency:         in.Body.Currency,
		Amount:           in.Body.Amount.Decimal,
		TransferMethodID: in.Body.TransferMethodID,
		Description:      in.Body.Description,
	}

	return dh.debtService.RecordNewTransaction(ctx, request)
}

func (dh *DebtHandler) getDebts(ctx context.Context, in GetAllDebtsInput) ([]dto.DebtTransactionResponse, error) {
	return dh.debtService.GetTransactions(ctx, in.ProfileID)
}

func (dh *DebtHandler) getDebtsSummary(ctx context.Context, in GetDebtsSummaryInput) (map[string]dto.FriendBalance, error) {
	return dh.debtService.GetTransactionSummary(ctx, in.ProfileID)
}

func (dh *DebtHandler) getRecentDebts(ctx context.Context, in GetRecentDebtsInput) ([]dto.DebtTransactionResponse, error) {
	return dh.debtService.GetRecent(ctx, in.ProfileID)
}

func (dh *DebtHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[CreateDebtInput, dto.DebtTransactionResponse]{
			OperationID: "create-debt",
			Method:      http.MethodPost,
			Path:        "/api/v1/debts",
			Summary:     "Record a new debt transaction",
			Tags:        []string{"debts"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: dh.createDebt,
		}),
		endpoint.New(endpoint.Endpoint[GetAllDebtsInput, []dto.DebtTransactionResponse]{
			OperationID: "get-debts",
			Method:      http.MethodGet,
			Path:        "/api/v1/debts",
			Summary:     "Get all debt transactions",
			Tags:        []string{"debts"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: dh.getDebts,
		}),
		endpoint.New(endpoint.Endpoint[GetDebtsSummaryInput, map[string]dto.FriendBalance]{
			OperationID: "get-debts-summary",
			Method:      http.MethodGet,
			Path:        "/api/v1/debts/summary",
			Summary:     "Get debt transaction summary",
			Tags:        []string{"debts"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: dh.getDebtsSummary,
		}),
		endpoint.New(endpoint.Endpoint[GetRecentDebtsInput, []dto.DebtTransactionResponse]{
			OperationID: "get-recent-debts",
			Method:      http.MethodGet,
			Path:        "/api/v1/debts/recent",
			Summary:     "Get recent debt transactions",
			Tags:        []string{"debts"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: dh.getRecentDebts,
		}),
	}
}
