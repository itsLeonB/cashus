package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

// These tests cover resolveTransactionDate, the pure helper RecordNewTransaction
// uses to default and validate the new transactionDate field (CASH-3), in
// isolation from the rest of the service's dependency graph.

func TestResolveTransactionDate_Omitted_DefaultsToToday(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	got, err := resolveTransactionDate("", now)

	assert.NoError(t, err)
	assert.Equal(t, time.Date(2026, time.September, 3, 0, 0, 0, 0, time.UTC), got)
}

func TestResolveTransactionDate_ValidPastDate_IsAccepted(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	got, err := resolveTransactionDate("2026-08-27", now)

	assert.NoError(t, err)
	assert.Equal(t, time.Date(2026, time.August, 27, 0, 0, 0, 0, time.UTC), got)
}

func TestResolveTransactionDate_Today_IsAccepted(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	got, err := resolveTransactionDate("2026-09-03", now)

	assert.NoError(t, err)
	assert.Equal(t, time.Date(2026, time.September, 3, 0, 0, 0, 0, time.UTC), got)
}

func TestResolveTransactionDate_FutureDate_ReturnsValidationError(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	_, err := resolveTransactionDate("2026-09-04", now)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	// ungerr.ValidationError (the constructor CASH-3 specifies) maps to 422, not
	// the 400 the API contract text names - see the same repeated pattern two
	// lines above resolveTransactionDate's call site in debt_service.go
	// (ungerr.ValidationError("amount must be greater than 0")). Flagged as a
	// contract/implementation discrepancy in this task's final report.
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

func TestResolveTransactionDate_InvalidFormat_ReturnsValidationError(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	_, err := resolveTransactionDate("03-09-2026", now)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}
