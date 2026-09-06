package service

import (
	"context"
	"testing"

	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/ungerr"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Update's amount validation is checked before the transactor is ever touched,
// so a transactor-only double (no repositories) is enough to exercise it.
func newTestOtherFeeServiceWithTransactor(t *testing.T) (OtherFeeService, *mocks.MockTransactor) {
	transactor := mocks.NewMockTransactor(t)
	svc := NewOtherFeeService(transactor, nil, nil, nil)
	return svc, transactor
}

func TestOtherFeeService_Update_RejectsZeroAmount(t *testing.T) {
	svc, transactor := newTestOtherFeeServiceWithTransactor(t)

	_, err := svc.Update(context.Background(), dto.UpdateOtherFeeRequest{
		Amount: decimal.Zero,
	})

	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, appconstant.ErrAmountZero, appErr.Details())
	transactor.AssertNotCalled(t, "WithinTransaction", mock.Anything, mock.Anything)
}

func TestOtherFeeService_Update_AllowsNegativeAmount(t *testing.T) {
	svc, transactor := newTestOtherFeeServiceWithTransactor(t)

	transactor.EXPECT().
		WithinTransaction(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		Return(nil).
		Once()

	_, err := svc.Update(context.Background(), dto.UpdateOtherFeeRequest{
		Amount: decimal.NewFromInt(-10000),
	})

	assert.NoError(t, err)
}
