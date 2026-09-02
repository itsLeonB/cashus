package service

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/itsLeonB/cashback/internal/domain/message"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestMain initializes the package-level logger so code paths that call
// logger.Errorf/Infof etc. (e.g. ParseFromBillText's error logging) don't
// panic on a nil logger.Global. Same pattern as
// internal/adapters/worker/subscriber and internal/adapters/worker/scheduler.
func TestMain(m *testing.M) {
	logger.Init("test")
	os.Exit(m.Run())
}

func newTestGroupExpenseService(
	t *testing.T,
) (GroupExpenseService, *mocks.MockGroupExpenseRepository, *mocks.MockRepository[expenses.ExpenseBill], *mocks.MockTransactor, *mocks.MockClient) {
	expenseRepo := mocks.NewMockGroupExpenseRepository(t)
	billRepo := mocks.NewMockRepository[expenses.ExpenseBill](t)
	transactor := mocks.NewMockTransactor(t)
	langfuseClient := mocks.NewMockClient(t)

	svc := NewGroupExpenseService(
		nil, // friendshipService (unused)
		expenseRepo,
		transactor,
		nil, // feeCalculatorRegistry (unused)
		nil, // otherFeeRepository (unused)
		billRepo,
		nil, // llmService (unused unless langfuseClient.GetPrompt succeeds)
		nil, // imageSvc (unused)
		nil, // taskQueue (unused)
		langfuseClient,
		nil, // profileSvc (unused)
	)

	return svc, expenseRepo, billRepo, transactor, langfuseClient
}

func TestParseFromBillText_CallsLLMBeforeOpeningTransaction(t *testing.T) {
	svc, _, billRepo, transactor, langfuseClient := newTestGroupExpenseService(t)

	billID := uuid.New()
	pendingBill := expenses.ExpenseBill{
		BaseEntity:    crud.BaseEntity{ID: billID},
		Status:        expenses.ExtractedBill,
		ExtractedText: "total: 10.00",
	}

	// MockRepository[T] (internal/mocks/mock_crud_repository.go) is a hand-written
	// generic mock without the mockery "_Expecter" pattern, so it's driven via the
	// plain testify .On(...) API (see existing usage in profile_service_test.go),
	// unlike langfuseClient/transactor below which are mockery-generated with .EXPECT().
	// Pinned to ForUpdate=false/true respectively so the test fails if the
	// pre-LLM unlocked read or the in-transaction locked re-fetch regresses.
	billRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[expenses.ExpenseBill]) bool {
		return spec.Model.ID == billID && !spec.ForUpdate
	})).Return(pendingBill, nil).Once()

	billRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[expenses.ExpenseBill]) bool {
		return spec.Model.ID == billID && spec.ForUpdate
	})).Return(pendingBill, nil).Once()

	getPromptCall := langfuseClient.EXPECT().
		GetPrompt(mock.Anything, mock.Anything, mock.Anything).
		Return(nil, ungerr.Unknown("langfuse unavailable"))

	withinTxCall := transactor.EXPECT().
		WithinTransaction(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		})

	billRepo.On("Update", mock.Anything, mock.MatchedBy(func(b expenses.ExpenseBill) bool {
		return b.Status == expenses.FailedParsingBill
	})).Return(expenses.ExpenseBill{}, nil)

	mock.InOrder(getPromptCall.Call, withinTxCall.Call)

	err := svc.ParseFromBillText(context.Background(), message.ExpenseBillTextExtracted{ID: billID})

	assert.NoError(t, err)
}

// TestGetAll_DefaultsEmptyOwnershipToOwnedExpense verifies the business-rule
// default ("no ownership filter specified means owned expenses") that used to
// live in the handler now lives here, on GroupExpenseService.GetAll.
func TestGetAll_DefaultsEmptyOwnershipToOwnedExpense(t *testing.T) {
	svc, expenseRepo, _, _, _ := newTestGroupExpenseService(t)

	profileID := uuid.New()

	expenseRepo.EXPECT().
		FindAllByOwnership(mock.Anything, profileID, expenses.OwnedExpense, expenses.ExpenseStatus(""), -1).
		Return([]expenses.GroupExpense{}, nil).
		Once()

	_, err := svc.GetAll(context.Background(), profileID, "", "")

	assert.NoError(t, err)
}
