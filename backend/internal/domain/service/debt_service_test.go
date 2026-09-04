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

// An explicit "" is indistinguishable from an omitted field once it reaches this
// function (both arrive as raw == ""), so it gets the same today-default - the
// handler layer deliberately doesn't tag transactionDate with format:"date",
// which would otherwise let huma reject "" before it ever reaches here.
func TestResolveTransactionDate_ExplicitEmptyString_DefaultsToToday(t *testing.T) {
	now := time.Date(2026, time.September, 3, 14, 30, 0, 0, time.UTC)

	got, err := resolveTransactionDate("", now)

	assert.NoError(t, err)
	assert.Equal(t, truncateToDate(now), got)
}

// resolveTransactionDate does not itself normalize now's timezone - it reads
// whatever calendar date now already represents and re-anchors it to UTC
// midnight. Passing a non-UTC now therefore yields that zone's calendar date,
// not the UTC calendar date of the same instant - which is exactly why
// RecordNewTransaction must call time.Now().UTC(), not time.Now(), before
// handing it to resolveTransactionDate.
func TestResolveTransactionDate_NonUTCNow_UsesItsOwnCalendarDateAsIs(t *testing.T) {
	wib := time.FixedZone("WIB", 7*60*60) // UTC+7
	// 2026-09-03 01:00 WIB == 2026-09-02 18:00 UTC: the same instant falls on
	// different calendar dates depending on which zone reads it.
	now := time.Date(2026, time.September, 3, 1, 0, 0, 0, wib)

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
	// ungerr.ValidationError (the constructor CASH-3's deliverable list names,
	// matching the sibling "amount must be greater than 0" check two lines above
	// its call site in debt_service.go) maps to 422 in this codebase - confirmed
	// as the intended status during CASH-3 review; CASH-2's contract text has
	// been corrected to say 422.
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
