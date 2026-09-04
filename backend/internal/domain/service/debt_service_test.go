package service

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/core/service/queue"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/debts"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/go-crud"
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

// TestRecordNewTransaction_NonPositiveAmount_ReturnsValidationError is an
// end-to-end regression guard: the amount-must-be-positive check is the very
// first thing RecordNewTransaction does, before touching any dependency, so a
// zero-value debtServiceImpl (every collaborator nil) can exercise it directly
// without mocking the rest of the dependency graph.
func TestRecordNewTransaction_NonPositiveAmount_ReturnsValidationError(t *testing.T) {
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

// These tests cover resolveRepayment, the helper RecordRepayment uses to
// compute direction+amount from the current net balance, and validateDirection,
// the sibling helper RecordNewTransaction uses as a defense-in-depth check that
// direction is INCOMING/OUTGOING, behind huma's enum tag on
// CreateDebtInput.Body.Direction which enforces it over HTTP.

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

// TestRecordRepayment_SelfTransaction_ReturnsUnprocessableEntityError mirrors
// TestRecordNewTransaction_NonPositiveAmount_ReturnsValidationError: the
// self-transaction check is the very first thing recordTransaction does,
// before touching any dependency, so a zero-value debtServiceImpl (every
// collaborator nil) can exercise it directly without mocking the rest of the
// dependency graph.
func TestRecordRepayment_SelfTransaction_ReturnsUnprocessableEntityError(t *testing.T) {
	ds := &debtServiceImpl{}
	profileID := uuid.New()
	req := dto.NewRepaymentRequest{
		UserProfileID:   profileID,
		FriendProfileID: profileID,
	}

	_, err := ds.RecordRepayment(context.Background(), req)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}

// These tests exercise RecordRepayment itself end-to-end (mocking every
// collaborator it reaches through recordTransaction), rather than only its
// resolveRepayment helper: they cover the wiring this diff actually added -
// dto.NewRepaymentRequest's fields reaching the friend-validation/transfer-method
// checks and the inserted row, and isRepayment=true landing on that row -
// which the resolveRepayment-only tests above don't touch. Same three balance
// scenarios as those tests (friend-owes-user/user-owes-friend/zero-balance),
// so the two sets together cover both the pure balance->direction/amount math
// and the full request-to-insert path around it.

// recordRepaymentTestDeps bundles every mock RecordRepayment's dependency graph
// touches, wired into a debtServiceImpl via field names (profileService and
// expenseService are left nil - RecordRepayment never reaches them as long as
// the request's Currency is non-empty).
type recordRepaymentTestDeps struct {
	debtRepo    *mocks.MockDebtTransactionRepository
	transferSvc *mocks.MockTransferMethodService
	friendSvc   *mocks.MockFriendshipService
	transactor  *mocks.MockTransactor
	balanceSvc  *mocks.MockFriendshipBalanceService
	taskQueue   *mocks.MockTaskQueue
}

func newRecordRepaymentTestService(t *testing.T) (*debtServiceImpl, recordRepaymentTestDeps) {
	deps := recordRepaymentTestDeps{
		debtRepo:    mocks.NewMockDebtTransactionRepository(t),
		transferSvc: mocks.NewMockTransferMethodService(t),
		friendSvc:   mocks.NewMockFriendshipService(t),
		transactor:  mocks.NewMockTransactor(t),
		balanceSvc:  mocks.NewMockFriendshipBalanceService(t),
		taskQueue:   mocks.NewMockTaskQueue(t),
	}

	ds := &debtServiceImpl{
		debtTransactionRepository: deps.debtRepo,
		transferMethodService:     deps.transferSvc,
		friendshipService:         deps.friendSvc,
		transactor:                deps.transactor,
		friendshipBalanceService:  deps.balanceSvc,
		taskQueue:                 deps.taskQueue,
	}

	return ds, deps
}

// expectRecordRepaymentPreamble sets up the mock expectations recordTransaction
// runs before it ever calls resolve: friend validation and transfer-method
// lookup, both keyed off req/transferMethodID. WithinTransaction is stubbed to
// just invoke the callback it's given, same pattern as
// friendship_request_service_test.go.
func expectRecordRepaymentPreamble(deps recordRepaymentTestDeps, req dto.NewRepaymentRequest, transferMethod debts.TransferMethod) {
	deps.friendSvc.EXPECT().
		IsFriends(mock.Anything, req.UserProfileID, req.FriendProfileID).
		Return(true, false, nil)

	deps.transferSvc.EXPECT().
		GetByID(mock.Anything, req.TransferMethodID).
		Return(transferMethod, nil)

	deps.transactor.EXPECT().
		WithinTransaction(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		})
}

func TestRecordRepayment_FriendOwesUser_InsertsIncomingSettlingTransactionAsRepayment(t *testing.T) {
	ds, deps := newRecordRepaymentTestService(t)

	req := dto.NewRepaymentRequest{
		UserProfileID:    uuid.New(),
		FriendProfileID:  uuid.New(),
		Currency:         "USD",
		TransferMethodID: uuid.New(),
	}
	transferMethod := debts.TransferMethod{
		BaseEntity: crud.BaseEntity{ID: req.TransferMethodID},
		Display:    "Cash",
	}
	expectRecordRepaymentPreamble(deps, req, transferMethod)

	// Friend owes user (positive balance) -> resolveRepayment settles it with
	// an INCOMING transaction for the request's currency specifically.
	deps.balanceSvc.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, req.UserProfileID, req.FriendProfileID, req.Currency).
		Return(decimal.NewFromInt(150), nil)

	insertedID := uuid.New()
	deps.debtRepo.EXPECT().
		Insert(mock.Anything, mock.MatchedBy(func(tx debts.DebtTransaction) bool {
			// direction=INCOMING flips lender/borrower relative to the request:
			// the friend (who owed the balance) becomes the settling transaction's
			// lender, the user its borrower - see recordTransaction's direction
			// handling and resolveRepayment's doc comment.
			return tx.LenderProfileID == req.FriendProfileID &&
				tx.BorrowerProfileID == req.UserProfileID &&
				tx.Amount.Equal(decimal.NewFromInt(150)) &&
				tx.Currency == req.Currency &&
				tx.TransferMethodID == req.TransferMethodID &&
				tx.Description == "" &&
				tx.IsRepayment
		})).
		Return(debts.DebtTransaction{
			BaseEntity:        crud.BaseEntity{ID: insertedID},
			LenderProfileID:   req.FriendProfileID,
			BorrowerProfileID: req.UserProfileID,
			Amount:            decimal.NewFromInt(150),
			Currency:          req.Currency,
			TransferMethodID:  req.TransferMethodID,
			TransactionDate:   time.Now().UTC(),
			IsRepayment:       true,
		}, nil)

	deps.balanceSvc.EXPECT().
		RecalculatePair(mock.Anything, req.FriendProfileID, req.UserProfileID).
		Return(nil)

	asyncDone := make(chan struct{})
	deps.taskQueue.EXPECT().
		AsyncEnqueue(mock.Anything, mock.Anything).
		Run(func(context.Context, queue.TaskMessage) { close(asyncDone) })

	res, err := ds.RecordRepayment(context.Background(), req)

	assert.NoError(t, err)
	assert.True(t, res.IsRepayment)
	assert.True(t, decimal.NewFromInt(150).Equal(res.Amount), "expected 150, got %s", res.Amount)
	assert.Equal(t, req.Currency, res.Currency)

	// AsyncEnqueue runs in its own goroutine (see recordTransaction) - wait for
	// it instead of letting the mock's expectation-check-on-cleanup race it.
	select {
	case <-asyncDone:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for AsyncEnqueue")
	}
}

func TestRecordRepayment_UserOwesFriend_InsertsOutgoingSettlingTransactionAsRepayment(t *testing.T) {
	ds, deps := newRecordRepaymentTestService(t)

	req := dto.NewRepaymentRequest{
		UserProfileID:    uuid.New(),
		FriendProfileID:  uuid.New(),
		Currency:         "USD",
		TransferMethodID: uuid.New(),
	}
	transferMethod := debts.TransferMethod{
		BaseEntity: crud.BaseEntity{ID: req.TransferMethodID},
		Display:    "Cash",
	}
	expectRecordRepaymentPreamble(deps, req, transferMethod)

	// User owes friend (negative balance) -> resolveRepayment settles it with
	// an OUTGOING transaction, absolute-valued.
	deps.balanceSvc.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, req.UserProfileID, req.FriendProfileID, req.Currency).
		Return(decimal.NewFromInt(-75), nil)

	insertedID := uuid.New()
	deps.debtRepo.EXPECT().
		Insert(mock.Anything, mock.MatchedBy(func(tx debts.DebtTransaction) bool {
			// direction=OUTGOING keeps the request's lender/borrower ordering as-is.
			return tx.LenderProfileID == req.UserProfileID &&
				tx.BorrowerProfileID == req.FriendProfileID &&
				tx.Amount.Equal(decimal.NewFromInt(75)) &&
				tx.Currency == req.Currency &&
				tx.TransferMethodID == req.TransferMethodID &&
				tx.Description == "" &&
				tx.IsRepayment
		})).
		Return(debts.DebtTransaction{
			BaseEntity:        crud.BaseEntity{ID: insertedID},
			LenderProfileID:   req.UserProfileID,
			BorrowerProfileID: req.FriendProfileID,
			Amount:            decimal.NewFromInt(75),
			Currency:          req.Currency,
			TransferMethodID:  req.TransferMethodID,
			TransactionDate:   time.Now().UTC(),
			IsRepayment:       true,
		}, nil)

	deps.balanceSvc.EXPECT().
		RecalculatePair(mock.Anything, req.UserProfileID, req.FriendProfileID).
		Return(nil)

	asyncDone := make(chan struct{})
	deps.taskQueue.EXPECT().
		AsyncEnqueue(mock.Anything, mock.Anything).
		Run(func(context.Context, queue.TaskMessage) { close(asyncDone) })

	res, err := ds.RecordRepayment(context.Background(), req)

	assert.NoError(t, err)
	assert.True(t, res.IsRepayment)
	assert.True(t, decimal.NewFromInt(75).Equal(res.Amount), "expected 75, got %s", res.Amount)

	select {
	case <-asyncDone:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for AsyncEnqueue")
	}
}

// TestRecordRepayment_ZeroBalance_ReturnsUnprocessableEntityError confirms the
// "nothing to repay" error surfaces through the full RecordRepayment path -
// friend/transfer-method checks still ran, but resolveRepayment's rejection
// (inside WithinTransaction) stops the insert, RecalculatePair and the async
// enqueue from ever happening.
func TestRecordRepayment_ZeroBalance_ReturnsUnprocessableEntityError(t *testing.T) {
	ds, deps := newRecordRepaymentTestService(t)

	req := dto.NewRepaymentRequest{
		UserProfileID:    uuid.New(),
		FriendProfileID:  uuid.New(),
		Currency:         "USD",
		TransferMethodID: uuid.New(),
	}
	transferMethod := debts.TransferMethod{
		BaseEntity: crud.BaseEntity{ID: req.TransferMethodID},
		Display:    "Cash",
	}
	expectRecordRepaymentPreamble(deps, req, transferMethod)

	deps.balanceSvc.EXPECT().
		GetNetBalanceForPairForUpdate(mock.Anything, req.UserProfileID, req.FriendProfileID, req.Currency).
		Return(decimal.Zero, nil)

	_, err := ds.RecordRepayment(context.Background(), req)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnprocessableEntity, appErr.HttpStatus())
}
