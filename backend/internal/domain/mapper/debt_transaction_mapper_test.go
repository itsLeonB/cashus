package mapper

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/debts"
	"github.com/itsLeonB/go-crud"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// These tests cover the CASH-3 transactionDate wiring: the new field must
// reach both response surfaces named in the API contract - DebtTransactionResponse
// (POST/GET /api/v1/debts*) and FriendTransactionItem
// (GET /api/v1/friendships/{friendshipID} -> balance.transactionHistory[]) -
// formatted as "YYYY-MM-DD", independent of createdAt.

func TestDebtTransactionToResponse_SetsTransactionDate(t *testing.T) {
	lenderID := uuid.New()
	borrowerID := uuid.New()
	transactionDate := time.Date(2026, time.August, 27, 0, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, time.September, 3, 10, 0, 0, 0, time.UTC)

	transaction := debts.DebtTransaction{
		BaseEntity:        crud.BaseEntity{ID: uuid.New(), CreatedAt: createdAt},
		LenderProfileID:   lenderID,
		BorrowerProfileID: borrowerID,
		Amount:            decimal.NewFromInt(100),
		Currency:          "IDR",
		TransactionDate:   transactionDate,
	}

	res := DebtTransactionToResponse(lenderID, transaction, map[uuid.UUID]dto.ProfileResponse{})

	assert.Equal(t, "2026-08-27", res.TransactionDate)
	// createdAt (the actual record-creation timestamp) must stay independent of
	// the backdated transactionDate.
	assert.Equal(t, createdAt, res.CreatedAt)
}

func TestCalculateBalances_SetsTransactionDateOnHistoryItems(t *testing.T) {
	lenderID := uuid.New()
	borrowerID := uuid.New()
	transactionDate := time.Date(2026, time.August, 27, 0, 0, 0, 0, time.UTC)

	transactions := []debts.DebtTransaction{
		{
			BaseEntity:        crud.BaseEntity{ID: uuid.New()},
			LenderProfileID:   lenderID,
			BorrowerProfileID: borrowerID,
			Amount:            decimal.NewFromInt(100),
			Currency:          "IDR",
			TransactionDate:   transactionDate,
		},
	}

	balance := MapToFriendBalanceSummary(transactions, []uuid.UUID{lenderID})

	assert.Len(t, balance.TransactionHistory, 1)
	assert.Equal(t, "2026-08-27", balance.TransactionHistory[0].TransactionDate)
}
