package mapper

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// These tests cover CASH-8: confirming a group expense must stamp every
// resulting debt transaction with a real transactionDate, not the Go zero
// value (0001-01-01) that reached the DB before this fix - see
// ProcessConfirmedGroupExpense's call to this mapper for the caller side of
// the same fix.

func TestGroupExpenseToDebtTransactions_SetsTransactionDateOnEveryRow(t *testing.T) {
	payerID := uuid.New()
	participantID := uuid.New()
	transferMethodID := uuid.New()
	transactionDate := time.Date(2026, time.September, 6, 0, 0, 0, 0, time.UTC)

	groupExpense := expenses.GroupExpense{
		PayerProfileID: uuid.NullUUID{UUID: payerID, Valid: true},
		Currency:       "USD",
		Description:    "Dinner",
		Participants: []expenses.ExpenseParticipant{
			{
				ParticipantProfileID: participantID,
				ShareAmount:          decimal.NewFromInt(50),
			},
		},
	}

	debtTransactions := GroupExpenseToDebtTransactions(groupExpense, transferMethodID, transactionDate)

	assert.Len(t, debtTransactions, 1)
	for _, tx := range debtTransactions {
		assert.True(t, tx.TransactionDate.Equal(transactionDate), "expected %s, got %s", transactionDate, tx.TransactionDate)
		assert.False(t, tx.TransactionDate.IsZero())
	}
}

func TestGroupExpenseToDebtTransactions_ProxyParticipant_SetsTransactionDateOnBothRows(t *testing.T) {
	payerID := uuid.New()
	proxyID := uuid.New()
	participantID := uuid.New()
	transferMethodID := uuid.New()
	transactionDate := time.Date(2026, time.September, 6, 0, 0, 0, 0, time.UTC)

	groupExpense := expenses.GroupExpense{
		PayerProfileID: uuid.NullUUID{UUID: payerID, Valid: true},
		Currency:       "USD",
		Description:    "Groceries",
		Participants: []expenses.ExpenseParticipant{
			{
				ParticipantProfileID: participantID,
				ProxyProfileID:       uuid.NullUUID{UUID: proxyID, Valid: true},
				ShareAmount:          decimal.NewFromInt(20),
			},
		},
	}

	debtTransactions := GroupExpenseToDebtTransactions(groupExpense, transferMethodID, transactionDate)

	// A proxied participant produces 2 rows (proxy<->participant, payer<->proxy)
	// - both must carry the same transactionDate.
	assert.Len(t, debtTransactions, 2)
	for _, tx := range debtTransactions {
		assert.True(t, tx.TransactionDate.Equal(transactionDate), "expected %s, got %s", transactionDate, tx.TransactionDate)
	}
}
