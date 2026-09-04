package debts

import (
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/go-crud"
	"github.com/shopspring/decimal"
)

const (
	GroupExpenseTransferMethod = "GROUP_EXPENSE"
)

type DebtTransaction struct {
	crud.BaseEntity
	LenderProfileID   uuid.UUID
	BorrowerProfileID uuid.UUID
	Currency          string
	Amount            decimal.Decimal
	TransferMethodID  uuid.UUID
	Description       string
	GroupExpenseID    uuid.NullUUID
	// TransactionDate is the (possibly backdated) effective date of the transaction,
	// independent of BaseEntity.CreatedAt (the actual record-creation timestamp).
	// Stored as a date-only Postgres column; time-of-day is not meaningful here.
	TransactionDate time.Time `gorm:"type:date;not null"`
	// IsRepayment marks a transaction as an auto-computed balance-settling repayment
	// (CASH-6): Amount, LenderProfileID/BorrowerProfileID and Description are derived
	// from the net balance at creation time rather than taken from the request as-is.
	IsRepayment bool `gorm:"not null;default:false"`

	// Relationships
	TransferMethod TransferMethod
}
