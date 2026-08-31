package admin

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/core/util"
	adminEntity "github.com/itsLeonB/cashback/internal/domain/entity/admin"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/go-crud"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// These tests cover AuthHandler.getMe, which used to be the inline handler
// closure body of RegisterMe: it looked up the admin user by ID and, if not
// found, built ungerr.UnauthorizedError("user not found") itself. That
// not-found check is now pulled out here so RegisterMe's replacement in
// Routes() can be a plain call-and-pass-through-error.

func TestGetMe_UserFound_ReturnsMappedAdminMe(t *testing.T) {
	userRepo := mocks.NewMockRepository[adminEntity.User](t)
	ah := &AuthHandler{userRepo: userRepo}

	userID := uuid.New()
	user := adminEntity.User{
		BaseEntity: crud.BaseEntity{ID: userID},
		Email:      "jane.doe@example.com",
	}

	userRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[adminEntity.User]) bool {
		return spec.Model.ID == userID
	})).Return(user, nil)

	me, err := ah.getMe(context.Background(), userID)

	assert.NoError(t, err)
	assert.Equal(t, userID, me.ID)
	assert.Equal(t, util.GetNameFromEmail(user.Email), me.FullName)
}

func TestGetMe_UserNotFound_ReturnsUnauthorizedError(t *testing.T) {
	userRepo := mocks.NewMockRepository[adminEntity.User](t)
	ah := &AuthHandler{userRepo: userRepo}

	userID := uuid.New()

	userRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[adminEntity.User]) bool {
		return spec.Model.ID == userID
	})).Return(adminEntity.User{}, nil)

	_, err := ah.getMe(context.Background(), userID)

	assert.Error(t, err)
	var appErr ungerr.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, http.StatusUnauthorized, appErr.HttpStatus())
	assert.Equal(t, "user not found", appErr.Details())
}

func TestGetMe_RepoError_PassesThrough(t *testing.T) {
	userRepo := mocks.NewMockRepository[adminEntity.User](t)
	ah := &AuthHandler{userRepo: userRepo}

	userID := uuid.New()
	repoErr := ungerr.Unknown("db unavailable")

	userRepo.On("FindFirst", mock.Anything, mock.MatchedBy(func(spec crud.Specification[adminEntity.User]) bool {
		return spec.Model.ID == userID
	})).Return(adminEntity.User{}, repoErr)

	_, err := ah.getMe(context.Background(), userID)

	assert.ErrorIs(t, err, repoErr)
}
