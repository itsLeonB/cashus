package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	mapset "github.com/deckarep/golang-set/v2"
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/core/otel"
	"github.com/itsLeonB/cashback/internal/core/service/queue"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity"
	"github.com/itsLeonB/cashback/internal/domain/entity/debts"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/itsLeonB/cashback/internal/domain/mapper"
	"github.com/itsLeonB/cashback/internal/domain/message"
	"github.com/itsLeonB/cashback/internal/domain/repository"
	"github.com/itsLeonB/ezutil/v2"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
)

type debtServiceImpl struct {
	debtTransactionRepository repository.DebtTransactionRepository
	transferMethodService     TransferMethodService
	friendshipService         FriendshipService
	profileService            ProfileService
	expenseService            GroupExpenseService
	taskQueue                 queue.TaskQueue
	transactor                crud.Transactor
	friendshipBalanceService  FriendshipBalanceService
}

func NewDebtService(
	debtTransactionRepository repository.DebtTransactionRepository,
	transferMethodService TransferMethodService,
	friendshipService FriendshipService,
	profileService ProfileService,
	expenseService GroupExpenseService,
	taskQueue queue.TaskQueue,
	transactor crud.Transactor,
	friendshipBalanceService FriendshipBalanceService,
) DebtService {
	return &debtServiceImpl{
		debtTransactionRepository,
		transferMethodService,
		friendshipService,
		profileService,
		expenseService,
		taskQueue,
		transactor,
		friendshipBalanceService,
	}
}

func (ds *debtServiceImpl) RecordNewTransaction(ctx context.Context, req dto.NewDebtTransactionRequest) (dto.DebtTransactionResponse, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.RecordNewTransaction")
	defer span.End()

	if !req.Amount.IsPositive() {
		return dto.DebtTransactionResponse{}, ungerr.ValidationError("amount must be greater than 0")
	}
	if err := validateDirection(req.Direction); err != nil {
		return dto.DebtTransactionResponse{}, err
	}

	return ds.recordTransaction(
		ctx, req.UserProfileID, req.FriendProfileID, req.Currency, req.TransferMethodID, req.TransactionDate, false,
		func(context.Context, string) (dto.DebtTransactionDirection, decimal.Decimal, string, error) {
			return req.Direction, req.Amount, req.Description, nil
		},
	)
}

// RecordRepayment records a balance-settling repayment: direction and amount are
// always computed from the current net balance (see resolveRepayment), never
// supplied by the caller.
func (ds *debtServiceImpl) RecordRepayment(ctx context.Context, req dto.NewRepaymentRequest) (dto.DebtTransactionResponse, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.RecordRepayment")
	defer span.End()

	return ds.recordTransaction(
		ctx, req.UserProfileID, req.FriendProfileID, req.Currency, req.TransferMethodID, req.TransactionDate, true,
		func(ctx context.Context, currency string) (dto.DebtTransactionDirection, decimal.Decimal, string, error) {
			direction, amount, err := ds.resolveRepayment(ctx, req.UserProfileID, req.FriendProfileID, currency)
			return direction, amount, "", err
		},
	)
}

// recordTransaction holds the logic shared by RecordNewTransaction and
// RecordRepayment: friend validation, transfer-method lookup, currency
// resolution, transaction-date resolution, the insert + RecalculatePair call
// inside WithinTransaction, and the async notification enqueue. The two callers
// differ only in how direction/amount/description get resolved before the
// insert, which resolve encapsulates; it's called inside the transaction (not
// before it) so that a repayment's resolution - which must run under
// GetNetBalanceForPairForUpdate's lock - is covered by the same transaction
// that inserts the settling row and recalculates the pair's balance.
func (ds *debtServiceImpl) recordTransaction(
	ctx context.Context,
	userProfileID, friendProfileID uuid.UUID,
	reqCurrency string,
	transferMethodID uuid.UUID,
	rawTransactionDate string,
	isRepayment bool,
	resolve func(ctx context.Context, currency string) (dto.DebtTransactionDirection, decimal.Decimal, string, error),
) (dto.DebtTransactionResponse, error) {
	if userProfileID == friendProfileID {
		return dto.DebtTransactionResponse{}, ungerr.UnprocessableEntityError("cannot do self transactions")
	}

	transactionDate, err := resolveTransactionDate(rawTransactionDate, time.Now().UTC())
	if err != nil {
		return dto.DebtTransactionResponse{}, err
	}

	isFriends, _, err := ds.friendshipService.IsFriends(ctx, userProfileID, friendProfileID)
	if err != nil {
		return dto.DebtTransactionResponse{}, err
	}
	if !isFriends {
		return dto.DebtTransactionResponse{}, ungerr.UnprocessableEntityError("both profiles are not friends")
	}

	transferMethod, err := ds.transferMethodService.GetByID(ctx, transferMethodID)
	if err != nil {
		return dto.DebtTransactionResponse{}, err
	}

	currency := reqCurrency
	if currency == "" {
		userProfile, err := ds.profileService.GetEntityByID(ctx, userProfileID)
		if err != nil {
			return dto.DebtTransactionResponse{}, err
		}
		currency = userProfile.HomeCurrency
	}

	var insertedDebt debts.DebtTransaction
	err = ds.transactor.WithinTransaction(ctx, func(ctx context.Context) error {
		direction, amount, description, err := resolve(ctx, currency)
		if err != nil {
			return err
		}

		lenderID, borrowerID := userProfileID, friendProfileID
		if direction == dto.IncomingDebt {
			lenderID, borrowerID = friendProfileID, userProfileID
		}

		insertedDebt, err = ds.debtTransactionRepository.Insert(ctx, debts.DebtTransaction{
			LenderProfileID:   lenderID,
			BorrowerProfileID: borrowerID,
			Amount:            amount,
			TransferMethodID:  transferMethodID,
			Description:       description,
			Currency:          currency,
			TransactionDate:   transactionDate,
			IsRepayment:       isRepayment,
		})
		if err != nil {
			return err
		}

		return ds.friendshipBalanceService.RecalculatePair(ctx, lenderID, borrowerID)
	})
	if err != nil {
		return dto.DebtTransactionResponse{}, err
	}

	go ds.taskQueue.AsyncEnqueue(ctx, message.DebtCreated{
		ID:               insertedDebt.ID,
		CreatorProfileID: userProfileID,
	})

	insertedDebt.TransferMethod = transferMethod
	return mapper.DebtTransactionToResponse(userProfileID, insertedDebt, make(map[uuid.UUID]dto.ProfileResponse)), nil
}

// resolveRepayment computes the direction and amount for a RecordRepayment
// request: it nets userProfileID's current balance with friendProfileID in
// currency down to zero, reusing FriendshipBalanceService's cached balance (kept
// current by RecalculatePair on every debt-transaction write) rather than
// re-deriving it from the transaction history.
//
// It must be called from inside the same transactor.WithinTransaction block that goes on to
// insert the settling debt transaction and call RecalculatePair, using
// GetNetBalanceForPairForUpdate rather than the unlocked GetNetBalancesForProfile: that method
// locks the friendship row first, so two concurrent isRepayment requests for the same pair
// serialize instead of both reading the same pre-repayment balance and both inserting a
// settling transaction - the second must instead see the balance already zeroed by the first
// (once its RecalculatePair, sharing the same lock, has committed) and be rejected below. See
// GetNetBalanceForPairForUpdate's doc comment for the locking detail.
//
// GetNetBalanceForPairForUpdate returns the balance signed so that positive means
// userProfileID is the net lender (friendProfileID owes userProfileID); a
// repayment settling that must record friendProfileID paying userProfileID
// back, i.e. userProfileID *receiving* money, so direction is INCOMING with
// amount equal to the (positive) balance. A negative balance means
// userProfileID owes friendProfileID, so the repayment is userProfileID
// *giving* money back: direction OUTGOING, amount the balance's absolute
// value. A zero (or absent) balance means there's nothing to repay.
func (ds *debtServiceImpl) resolveRepayment(
	ctx context.Context,
	userProfileID, friendProfileID uuid.UUID,
	currency string,
) (dto.DebtTransactionDirection, decimal.Decimal, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.resolveRepayment")
	defer span.End()

	netBalance, err := ds.friendshipBalanceService.GetNetBalanceForPairForUpdate(ctx, userProfileID, friendProfileID, currency)
	if err != nil {
		return "", decimal.Decimal{}, err
	}

	if netBalance.IsZero() {
		return "", decimal.Decimal{}, ungerr.UnprocessableEntityError("nothing to repay: balance is already zero")
	}

	if netBalance.IsPositive() {
		return dto.IncomingDebt, netBalance, nil
	}

	return dto.OutgoingDebt, netBalance.Neg(), nil
}

func (ds *debtServiceImpl) GetTransactions(ctx context.Context, profileID uuid.UUID) ([]dto.DebtTransactionResponse, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.GetTransactions")
	defer span.End()

	transactions, err := ds.debtTransactionRepository.FindAllByProfileIDs(ctx, []uuid.UUID{profileID}, -1, false)
	if err != nil {
		return nil, err
	}

	trxProfileIDs := mapset.NewSet[uuid.UUID]()
	for _, transaction := range transactions {
		trxProfileIDs.Add(transaction.LenderProfileID)
		trxProfileIDs.Add(transaction.BorrowerProfileID)
	}

	profilesByID, err := ds.profileService.GetByIDs(ctx, trxProfileIDs.ToSlice())
	if err != nil {
		return nil, err
	}

	return ezutil.MapSlice(transactions, mapper.DebtTransactionSimpleMapper(profileID, profilesByID)), nil
}

func (ds *debtServiceImpl) GetTransactionSummary(ctx context.Context, profileID uuid.UUID) (map[string]dto.FriendBalance, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.GetTransactionSummary")
	defer span.End()

	transactions, err := ds.debtTransactionRepository.FindAllByProfileIDs(ctx, []uuid.UUID{profileID}, -1, false)
	if err != nil {
		return nil, err
	}

	return mapper.SummarizePerCurrency(transactions, []uuid.UUID{profileID}), nil
}

func (ds *debtServiceImpl) ProcessConfirmedGroupExpense(ctx context.Context, groupExpense expenses.GroupExpense) error {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.ProcessConfirmedGroupExpense")
	defer span.End()

	transferMethod, err := ds.transferMethodService.GetByName(ctx, debts.GroupExpenseTransferMethod)
	if err != nil {
		return err
	}

	debtTransactions := mapper.GroupExpenseToDebtTransactions(groupExpense, transferMethod.ID)

	if _, err = ds.debtTransactionRepository.InsertMany(ctx, debtTransactions); err != nil {
		return err
	}

	// A proxy-profile chain can touch 2 distinct pairs (payer<->proxy, proxy<->participant) in
	// one call - dedupe before recalculating so a pair isn't recomputed twice.
	type pair struct{ a, b uuid.UUID }
	seen := make(map[pair]struct{}, len(debtTransactions))
	for _, tx := range debtTransactions {
		p := pair{tx.LenderProfileID, tx.BorrowerProfileID}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}

		if err := ds.friendshipBalanceService.RecalculatePair(ctx, tx.LenderProfileID, tx.BorrowerProfileID); err != nil {
			return err
		}
	}

	return nil
}

func (ds *debtServiceImpl) GetAllByProfileIDs(ctx context.Context, userProfileID, friendProfileID uuid.UUID) ([]debts.DebtTransaction, []uuid.UUID, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.GetAllByProfileIDs")
	defer span.End()

	userIDs := []uuid.UUID{userProfileID}
	transactions, err := ds.debtTransactionRepository.FindAllByMultipleProfileIDs(ctx, userIDs, []uuid.UUID{friendProfileID})
	return transactions, userIDs, err
}

func (ds *debtServiceImpl) GetRecent(ctx context.Context, profileID uuid.UUID) ([]dto.DebtTransactionResponse, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.GetRecent")
	defer span.End()

	transactions, err := ds.debtTransactionRepository.FindAllByProfileIDs(ctx, []uuid.UUID{profileID}, 5, true)
	if err != nil {
		return nil, err
	}

	trxProfileIDs := mapset.NewSet[uuid.UUID]()
	for _, transaction := range transactions {
		trxProfileIDs.Add(transaction.LenderProfileID)
		trxProfileIDs.Add(transaction.BorrowerProfileID)
	}

	profilesByID, err := ds.profileService.GetByIDs(ctx, trxProfileIDs.ToSlice())
	if err != nil {
		return nil, err
	}

	return ezutil.MapSlice(transactions, mapper.DebtTransactionSimpleMapper(profileID, profilesByID)), nil
}

func (ds *debtServiceImpl) ConstructNotification(ctx context.Context, msg message.DebtCreated) (entity.Notification, error) {
	ctx, span := otel.Tracer.Start(ctx, "DebtService.ConstructNotification")
	defer span.End()

	spec := crud.Specification[debts.DebtTransaction]{}
	spec.Model.ID = msg.ID
	trx, err := ds.debtTransactionRepository.FindFirst(ctx, spec)
	if err != nil {
		return entity.Notification{}, err
	}
	if trx.IsZero() {
		return entity.Notification{}, ungerr.NotFoundError(fmt.Sprintf("debt transaction with ID: %s is not found", msg.ID))
	}

	toNotifyProfileID := trx.LenderProfileID
	if trx.LenderProfileID == msg.CreatorProfileID {
		toNotifyProfileID = trx.BorrowerProfileID
	}

	friendship, err := ds.friendshipService.GetByProfileIDs(ctx, trx.LenderProfileID, trx.BorrowerProfileID)
	if err != nil {
		return entity.Notification{}, err
	}

	otherParty := friendship.Profile2
	if toNotifyProfileID == friendship.ProfileID2 {
		otherParty = friendship.Profile1
	}

	msgMeta := message.DebtCreatedMetadata{
		FriendshipID: friendship.ID,
		FriendName:   otherParty.Name,
	}

	metadata, err := json.Marshal(msgMeta)
	if err != nil {
		return entity.Notification{}, err
	}

	return entity.Notification{
		ProfileID:  toNotifyProfileID,
		Type:       msg.Type(),
		EntityType: "debt-transaction",
		EntityID:   msg.ID,
		Metadata:   datatypes.JSON(metadata),
	}, nil
}

// validateDirection returns a 422 ungerr error unless direction is INCOMING or
// OUTGOING. Only called by RecordNewTransaction - a repayment computes its own
// direction from the balance instead, via resolveRepayment - as a defense-in-depth
// check behind huma's enum:"INCOMING,OUTGOING" tag on CreateDebtInput.Body.Direction,
// which is what actually enforces this over HTTP.
func validateDirection(direction dto.DebtTransactionDirection) error {
	if direction != dto.IncomingDebt && direction != dto.OutgoingDebt {
		return ungerr.ValidationError("direction must be either INCOMING or OUTGOING")
	}
	return nil
}

// transactionDateLayout is the wire format for a debt transaction's date: date-only,
// no time-of-day or timezone component (matches mapper.transactionDateLayout).
const transactionDateLayout = "2006-01-02"

// resolveTransactionDate defaults and validates the transactionDate field of a new
// debt transaction request. An empty raw value - whether the field was omitted or
// sent as an explicit "" - defaults to now's date (server date). A non-empty value
// must parse as YYYY-MM-DD and must not be later than now's date. Callers should
// pass now already normalized to the desired timezone convention (this codebase
// uses UTC throughout); resolveTransactionDate does not convert it itself.
func resolveTransactionDate(raw string, now time.Time) (time.Time, error) {
	today := truncateToDate(now)

	if raw == "" {
		return today, nil
	}

	parsed, err := time.Parse(transactionDateLayout, raw)
	if err != nil {
		return time.Time{}, ungerr.ValidationError("transactionDate must be a valid date in YYYY-MM-DD format")
	}

	if parsed.After(today) {
		return time.Time{}, ungerr.ValidationError("transactionDate cannot be later than today")
	}

	return parsed, nil
}

// truncateToDate strips the time-of-day and timezone from t, keeping only the
// calendar date (as UTC midnight).
func truncateToDate(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
