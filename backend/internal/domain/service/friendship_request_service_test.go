package service_test

import (
	"context"
	"database/sql"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/entity/users"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// These tests cover FriendshipRequestService.GetAllByType and
// HandleBlockCommand, which pulled the "which value did the caller pass"
// validation switches (and their ungerr.BadRequestError construction) out of
// FriendshipRequestHandler.RegisterGetAll/RegisterBlock and down into the
// service, so the handler is now a plain call-and-pass-through-error.

func newTestFriendshipRequestService(
	t *testing.T,
) (service.FriendshipRequestService, *mocks.MockRepository[users.FriendshipRequest], *mocks.MockTransactor) {
	requestRepo := mocks.NewMockRepository[users.FriendshipRequest](t)
	transactor := mocks.NewMockTransactor(t)

	svc := service.NewFriendshipRequestService(
		transactor,
		nil, // friendshipSvc (unused by GetAllByType/HandleBlockCommand)
		nil, // profileService (unused by GetAllByType/HandleBlockCommand)
		requestRepo,
		nil, // taskQueue (unused by GetAllByType/HandleBlockCommand)
	)

	return svc, requestRepo, transactor
}

func TestGetAllByType_Sent_DispatchesToGetAllSent(t *testing.T) {
	svc, requestRepo, _ := newTestFriendshipRequestService(t)
	userProfileID := uuid.New()

	requestRepo.On("FindAll", mock.Anything, mock.MatchedBy(func(spec crud.Specification[users.FriendshipRequest]) bool {
		return spec.Model.SenderProfileID == userProfileID
	})).Return([]users.FriendshipRequest{}, nil)

	res, err := svc.GetAllByType(context.Background(), userProfileID, appconstant.SentFriendRequest)

	assert.NoError(t, err)
	assert.Empty(t, res)
}

func TestGetAllByType_Received_DispatchesToGetAllReceived(t *testing.T) {
	svc, requestRepo, _ := newTestFriendshipRequestService(t)
	userProfileID := uuid.New()

	requestRepo.On("FindAll", mock.Anything, mock.MatchedBy(func(spec crud.Specification[users.FriendshipRequest]) bool {
		return spec.Model.RecipientProfileID == userProfileID
	})).Return([]users.FriendshipRequest{}, nil)

	res, err := svc.GetAllByType(context.Background(), userProfileID, appconstant.ReceivedFriendRequest)

	assert.NoError(t, err)
	assert.Empty(t, res)
}

func TestGetAllByType_InvalidType_ReturnsBadRequestError(t *testing.T) {
	svc, _, _ := newTestFriendshipRequestService(t)

	_, err := svc.GetAllByType(context.Background(), uuid.New(), "bogus")

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusBadRequest, appErr.HttpStatus())
	assert.Equal(t, "invalid path parameter", appErr.Details())
}

func TestHandleBlockCommand_Block_DispatchesToBlock(t *testing.T) {
	svc, requestRepo, transactor := newTestFriendshipRequestService(t)
	userProfileID := uuid.New()
	reqID := uuid.New()

	existing := users.FriendshipRequest{
		BaseEntity:         crud.BaseEntity{ID: reqID},
		RecipientProfileID: userProfileID,
	}

	transactor.EXPECT().
		WithinTransaction(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		})

	requestRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[users.FriendshipRequest]) bool {
		return spec.Model.ID == reqID && spec.Model.RecipientProfileID == userProfileID && spec.ForUpdate
	})).Return(existing, nil)

	requestRepo.On("Update", mock.Anything, mock.MatchedBy(func(r users.FriendshipRequest) bool {
		return r.BlockedAt.Valid
	})).Return(users.FriendshipRequest{}, nil)

	_, err := svc.HandleBlockCommand(context.Background(), userProfileID, reqID, "block")

	assert.NoError(t, err)
}

func TestHandleBlockCommand_Unblock_DispatchesToUnblock(t *testing.T) {
	svc, requestRepo, transactor := newTestFriendshipRequestService(t)
	userProfileID := uuid.New()
	reqID := uuid.New()

	existing := users.FriendshipRequest{
		BaseEntity:         crud.BaseEntity{ID: reqID},
		RecipientProfileID: userProfileID,
		BlockedAt:          sql.NullTime{Valid: true},
	}

	transactor.EXPECT().
		WithinTransaction(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		})

	requestRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[users.FriendshipRequest]) bool {
		return spec.Model.ID == reqID && spec.Model.RecipientProfileID == userProfileID && spec.ForUpdate
	})).Return(existing, nil)

	requestRepo.On("Update", mock.Anything, mock.MatchedBy(func(r users.FriendshipRequest) bool {
		return !r.BlockedAt.Valid
	})).Return(users.FriendshipRequest{}, nil)

	_, err := svc.HandleBlockCommand(context.Background(), userProfileID, reqID, "unblock")

	assert.NoError(t, err)
}

func TestHandleBlockCommand_InvalidCommand_ReturnsBadRequestError(t *testing.T) {
	svc, _, _ := newTestFriendshipRequestService(t)

	_, err := svc.HandleBlockCommand(context.Background(), uuid.New(), uuid.New(), "bogus")

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusBadRequest, appErr.HttpStatus())
	assert.Equal(t, "unknown command: bogus", appErr.Details())
}
