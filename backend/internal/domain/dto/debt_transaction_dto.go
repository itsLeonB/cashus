package dto

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type DebtTransactionDirection string

const (
	IncomingDebt DebtTransactionDirection = "INCOMING"
	OutgoingDebt DebtTransactionDirection = "OUTGOING"
)

type NewDebtTransactionRequest struct {
	UserProfileID    uuid.UUID                `json:"-"`
	FriendProfileID  uuid.UUID                `json:"friendProfileId"`
	Direction        DebtTransactionDirection `json:"direction"`
	Currency         string                   `json:"currency"`
	Amount           decimal.Decimal          `json:"amount"`
	TransferMethodID uuid.UUID                `json:"transferMethodId"`
	Description      string                   `json:"description"`
	// TransactionDate is the raw "YYYY-MM-DD" value from the request, or empty
	// if omitted. DebtService.RecordNewTransaction defaults and validates it.
	TransactionDate string `json:"transactionDate"`
}

// NewRepaymentRequest is the request for DebtService.RecordRepayment: a
// repayment's direction, amount and description are always computed
// server-side from the current net balance between UserProfileID and
// FriendProfileID in Currency, so unlike NewDebtTransactionRequest it carries
// none of those fields.
type NewRepaymentRequest struct {
	UserProfileID    uuid.UUID `json:"-"`
	FriendProfileID  uuid.UUID `json:"friendProfileId"`
	Currency         string    `json:"currency"`
	TransferMethodID uuid.UUID `json:"transferMethodId"`
	// TransactionDate is the raw "YYYY-MM-DD" value from the request, or empty
	// if omitted. DebtService.RecordRepayment defaults and validates it.
	TransactionDate string `json:"transactionDate"`
}

type DebtTransactionResponse struct {
	BaseDTO
	Profile        SimpleProfile   `json:"profile"`
	Type           string          `json:"type"` // "LENT" or "BORROWED"
	Currency       string          `json:"currency"`
	Amount         decimal.Decimal `json:"amount"`
	TransferMethod string          `json:"transferMethod"`
	Description    string          `json:"description"`
	GroupExpenseID uuid.UUID       `json:"groupExpenseId"`
	IsFromExpense  bool            `json:"isFromExpense"`
	// TransactionDate is the effective (possibly backdated) transaction date,
	// formatted "YYYY-MM-DD". Independent of BaseDTO.CreatedAt.
	TransactionDate string `json:"transactionDate"`
	// IsRepayment mirrors DebtTransaction.IsRepayment (CASH-6). Description is
	// "" whenever this is true.
	IsRepayment bool `json:"isRepayment"`
}
