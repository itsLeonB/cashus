package service

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/ungerr"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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

// TestRecordNewTransaction_NotRepayment_NonPositiveAmount_ReturnsValidationError
// is an end-to-end regression guard for the isRepayment=false path (CASH-6):
// the amount-must-be-positive check is the very first thing RecordNewTransaction
// does, before touching any dependency, so a zero-value debtServiceImpl (every
// collaborator nil) can exercise it directly without mocking the rest of the
// dependency graph.
func TestRecordNewTransaction_NotRepayment_NonPositiveAmount_ReturnsValidationError(t *testing.T) {
	ds := &debtServiceImpl{}
	req := dto.NewDebtTransactionRequest{
		UserProfileID:   uuid.New(),
		FriendProfileID: uuid.New(),
		Direction:       dto.OutgoingDebt,
		Amount:          decimal.Zero,
	}

	_, err := ds.RecordNewTransaction(context.Background(), req)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

// These tests cover resolveRepayment, the helper RecordNewTransaction uses to
// compute direction+amount for an isRepayment=true request (CASH-6), and
// validateDirection, the sibling helper that preserves the pre-CASH-6 "direction
// is required and must be INCOMING/OUTGOING" rule for isRepayment=false requests
// now that binding tags alone can no longer enforce it (Direction became
// omitempty since it's only conditionally required).

// newDebtServiceForRepaymentTest builds a debtServiceImpl with only
// friendshipBalanceService set - the only dependency resolveRepayment touches -
// leaving every other field at its zero value, same as this file's existing
// resolveTransactionDate tests isolate that pure helper from the rest of the
// service's dependency graph.
func newDebtServiceForRepaymentTest(balanceService *mocks.MockFriendshipBalanceService) *debtServiceImpl {
	return &debtServiceImpl{friendshipBalanceService: balanceService}
}

func TestResolveRepayment_FriendOwesUser_ReturnsIncomingDirectionAndAbsoluteAmount(t *testing.T) {
	userID := uuid.New()
	friendID := uuid.New()
	currency := "USD"

	balanceService := mocks.NewMockFriendshipBalanceService(t)
	balanceService.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, userID, friendID, currency).
		Return(decimal.NewFromInt(150), nil)
	ds := newDebtServiceForRepaymentTest(balanceService)

	direction, amount, err := ds.resolveRepayment(context.Background(), userID, friendID, currency)

	assert.NoError(t, err)
	assert.Equal(t, dto.IncomingDebt, direction)
	assert.True(t, decimal.NewFromInt(150).Equal(amount), "expected 150, got %s", amount)
}

func TestResolveRepayment_UserOwesFriend_ReturnsOutgoingDirectionAndAbsoluteAmount(t *testing.T) {
	userID := uuid.New()
	friendID := uuid.New()
	currency := "USD"

	balanceService := mocks.NewMockFriendshipBalanceService(t)
	balanceService.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, userID, friendID, currency).
		Return(decimal.NewFromInt(-75), nil)
	ds := newDebtServiceForRepaymentTest(balanceService)

	direction, amount, err := ds.resolveRepayment(context.Background(), userID, friendID, currency)

	assert.NoError(t, err)
	assert.Equal(t, dto.OutgoingDebt, direction)
	assert.True(t, decimal.NewFromInt(75).Equal(amount), "expected 75, got %s", amount)
}

func TestResolveRepayment_ZeroBalance_ReturnsUnprocessableEntityError(t *testing.T) {
	userID := uuid.New()
	friendID := uuid.New()
	currency := "USD"

	balanceService := mocks.NewMockFriendshipBalanceService(t)
	balanceService.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, userID, friendID, currency).
		Return(decimal.Zero, nil)
	ds := newDebtServiceForRepaymentTest(balanceService)

	_, _, err := ds.resolveRepayment(context.Background(), userID, friendID, currency)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

// No FriendshipBalance row at all (e.g. the pair has never transacted, or the
// currency has no history between them) reads back as a zero balance, same as
// an explicit zero - also rejected as "nothing to repay". GetNetBalanceForPairForUpdate
// itself is what collapses "no row" to decimal.Zero (see its own tests); this test just
// confirms resolveRepayment treats that zero the same as an explicit one.
func TestResolveRepayment_NoCachedBalanceForPair_ReturnsUnprocessableEntityError(t *testing.T) {
	userID := uuid.New()
	friendID := uuid.New()
	currency := "USD"

	balanceService := mocks.NewMockFriendshipBalanceService(t)
	balanceService.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, userID, friendID, currency).
		Return(decimal.Zero, nil)
	ds := newDebtServiceForRepaymentTest(balanceService)

	_, _, err := ds.resolveRepayment(context.Background(), userID, friendID, currency)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

func TestValidateDirection_Incoming_ReturnsNoError(t *testing.T) {
	assert.NoError(t, validateDirection(dto.IncomingDebt))
}

func TestValidateDirection_Outgoing_ReturnsNoError(t *testing.T) {
	assert.NoError(t, validateDirection(dto.OutgoingDebt))
}

// Regression guard for the isRepayment=false path (CASH-6): Direction's binding
// tag was relaxed to omitempty since it's now only conditionally required, so
// this rule - previously enforced by gin binding alone - must still hold when
// it's not a repayment.
func TestValidateDirection_Empty_ReturnsValidationError(t *testing.T) {
	err := validateDirection("")

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

func TestValidateDirection_Invalid_ReturnsValidationError(t *testing.T) {
	err := validateDirection(dto.DebtTransactionDirection("SIDEWAYS"))

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}
