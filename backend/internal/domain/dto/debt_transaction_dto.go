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
	UserProfileID   uuid.UUID `json:"-"`
	FriendProfileID uuid.UUID `json:"friendProfileId" binding:"required"`
	// Direction is required unless IsRepayment is true, in which case it is
	// computed from the net balance instead - enforced in the service layer,
	// since gin binding tags can't express a condition on a sibling field.
	Direction DebtTransactionDirection `json:"direction" binding:"omitempty,oneof=INCOMING OUTGOING"`
	Currency  string                   `json:"currency" binding:"len=3"`
	// Amount is required unless IsRepayment is true, in which case it is
	// computed from the net balance instead - see Direction's comment.
	Amount           decimal.Decimal `json:"amount" binding:"omitempty"`
	TransferMethodID uuid.UUID       `json:"transferMethodId" binding:"required"`
	Description      string          `json:"description"`
	// TransactionDate is the raw "YYYY-MM-DD" value from the request, or empty
	// if omitted. DebtService.RecordNewTransaction defaults and validates it.
	TransactionDate string `json:"transactionDate"`
	// IsRepayment marks this transaction as an auto-computed balance-settling
	// repayment (CASH-6): when true, Amount, Direction and Description are
	// ignored from the request and instead derived from the current net
	// balance between UserProfileID and FriendProfileID in Currency.
	IsRepayment bool `json:"isRepayment"`
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
