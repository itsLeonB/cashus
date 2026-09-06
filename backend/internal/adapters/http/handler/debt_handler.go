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
		// TransactionDate is an optional "YYYY-MM-DD" date. Omitted or empty ->
		// defaults to today's date (server date). Deliberately untagged with
		// format:"date": huma's format validator runs time.Parse unconditionally,
		// even on an empty string, which would reject "" before it reaches
		// resolveTransactionDate's omitted-or-empty -> today branch below.
		// DebtService.RecordNewTransaction is the single source of truth for
		// parsing/defaulting/future-date validation.
		TransactionDate string `json:"transactionDate,omitempty"`
	}
}

// CreateRepaymentInput is the request for POST /api/v1/debts/repayment: unlike
// CreateDebtInput, direction/amount/description are never supplied by the
// caller - they're always computed server-side from the current net balance
// (see DebtService.RecordRepayment).
type CreateRepaymentInput struct {
	httpapi.AuthInput
	Body struct {
		FriendProfileID  uuid.UUID `json:"friendProfileId"`
		Currency         string    `json:"currency" minLength:"3" maxLength:"3"`
		TransferMethodID uuid.UUID `json:"transferMethodId"`
		// TransactionDate is an optional "YYYY-MM-DD" date - see CreateDebtInput's
		// field of the same name for why it's untagged with format:"date".
		TransactionDate string `json:"transactionDate,omitempty"`
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
		TransactionDate:  in.Body.TransactionDate,
	}

	return dh.debtService.RecordNewTransaction(ctx, request)
}

func (dh *DebtHandler) createDebtRepayment(ctx context.Context, in CreateRepaymentInput) (dto.DebtTransactionResponse, error) {
	request := dto.NewRepaymentRequest{
		UserProfileID:    in.ProfileID,
		FriendProfileID:  in.Body.FriendProfileID,
		Currency:         in.Body.Currency,
		TransferMethodID: in.Body.TransferMethodID,
		TransactionDate:  in.Body.TransactionDate,
	}

	return dh.debtService.RecordRepayment(ctx, request)
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
		endpoint.New(endpoint.Endpoint[CreateRepaymentInput, dto.DebtTransactionResponse]{
			OperationID: "create-debt-repayment",
			Method:      http.MethodPost,
			Path:        "/api/v1/debts/repayment",
			Summary:     "Record a new debt repayment",
			Tags:        []string{"debts"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: dh.createDebtRepayment,
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
