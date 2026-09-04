package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/entity/users"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// These tests cover GetNetBalanceForPairForUpdate, the locked single-pair balance read
// resolveRepayment uses to close the repayment TOCTOU race (security fix): unlike
// GetNetBalancesForProfile, it locks the friendship row before reading, so it takes
// profileID1/profileID2 (not a single profileID keying a full map) and must resolve its own
// sign relative to the profileID1 argument, independent of how the friendship row itself
// happens to be oriented. A true concurrency/race scenario isn't practical to simulate at the
// unit level - the locking guarantee itself comes from FindByProfileIDsForUpdate's
// SELECT ... FOR UPDATE, already exercised by RecalculatePair's existing usage - so these focus
// on the sign/zero computation only.

func newFriendshipBalanceServiceForTest(
	friendshipRepository *mocks.MockFriendshipRepository,
	balanceRepository *mocks.MockFriendshipBalanceRepository,
) *friendshipBalanceServiceImpl {
	return &friendshipBalanceServiceImpl{
		friendshipRepository: friendshipRepository,
		balanceRepository:    balanceRepository,
	}
}

func TestGetNetBalanceForPairForUpdate_FriendshipOrientedAsArgs_ReturnsBalanceAsIs(t *testing.T) {
	profileID1 := uuid.New()
	profileID2 := uuid.New()
	currency := "USD"
	friendshipID := uuid.New()

	friendship := users.Friendship{ProfileID1: profileID1, ProfileID2: profileID2}
	friendship.ID = friendshipID

	friendshipRepository := mocks.NewMockFriendshipRepository(t)
	friendshipRepository.EXPECT().
		FindByProfileIDsForUpdate(mock.Anything, profileID1, profileID2).
		Return(friendship, nil)

	balanceRepository := mocks.NewMockFriendshipBalanceRepository(t)
	balanceRepository.EXPECT().
		FindAllByFriendshipID(mock.Anything, friendshipID).
		Return([]users.FriendshipBalance{
			{FriendshipID: friendshipID, Currency: currency, NetBalance: decimal.NewFromInt(150)},
		}, nil)

	fbs := newFriendshipBalanceServiceForTest(friendshipRepository, balanceRepository)

	got, err := fbs.GetNetBalanceForPairForUpdate(context.Background(), profileID1, profileID2, currency)

	assert.NoError(t, err)
	assert.True(t, decimal.NewFromInt(150).Equal(got), "expected 150, got %s", got)
}

// The friendship row's own ProfileID1/ProfileID2 can land in either order relative to the
// caller's profileID1/profileID2 arguments (FindByProfileIDsForUpdate matches the pair
// regardless of order) - the stored NetBalance is signed relative to the friendship's
// ProfileID1, so when that differs from the profileID1 argument, the sign must flip.
func TestGetNetBalanceForPairForUpdate_FriendshipOrientedOppositeOfArgs_FlipsSign(t *testing.T) {
	profileID1 := uuid.New()
	profileID2 := uuid.New()
	currency := "USD"
	friendshipID := uuid.New()

	// Friendship row stores the pair in the opposite order from the call's profileID1/profileID2.
	friendship := users.Friendship{ProfileID1: profileID2, ProfileID2: profileID1}
	friendship.ID = friendshipID

	friendshipRepository := mocks.NewMockFriendshipRepository(t)
	friendshipRepository.EXPECT().
		FindByProfileIDsForUpdate(mock.Anything, profileID1, profileID2).
		Return(friendship, nil)

	balanceRepository := mocks.NewMockFriendshipBalanceRepository(t)
	balanceRepository.EXPECT().
		FindAllByFriendshipID(mock.Anything, friendshipID).
		Return([]users.FriendshipBalance{
			// Stored relative to friendship.ProfileID1 (== profileID2): profileID2 is the net
			// lender, so relative to the profileID1 argument this must come back negative.
			{FriendshipID: friendshipID, Currency: currency, NetBalance: decimal.NewFromInt(150)},
		}, nil)

	fbs := newFriendshipBalanceServiceForTest(friendshipRepository, balanceRepository)

	got, err := fbs.GetNetBalanceForPairForUpdate(context.Background(), profileID1, profileID2, currency)

	assert.NoError(t, err)
	assert.True(t, decimal.NewFromInt(-150).Equal(got), "expected -150, got %s", got)
}

func TestGetNetBalanceForPairForUpdate_NoBalanceRowForCurrency_ReturnsZero(t *testing.T) {
	profileID1 := uuid.New()
	profileID2 := uuid.New()
	currency := "USD"
	friendshipID := uuid.New()

	friendship := users.Friendship{ProfileID1: profileID1, ProfileID2: profileID2}
	friendship.ID = friendshipID

	friendshipRepository := mocks.NewMockFriendshipRepository(t)
	friendshipRepository.EXPECT().
		FindByProfileIDsForUpdate(mock.Anything, profileID1, profileID2).
		Return(friendship, nil)

	balanceRepository := mocks.NewMockFriendshipBalanceRepository(t)
	balanceRepository.EXPECT().
		FindAllByFriendshipID(mock.Anything, friendshipID).
		Return([]users.FriendshipBalance{
			// A different currency exists for the pair, but not the one being asked about.
			{FriendshipID: friendshipID, Currency: "EUR", NetBalance: decimal.NewFromInt(50)},
		}, nil)

	fbs := newFriendshipBalanceServiceForTest(friendshipRepository, balanceRepository)

	got, err := fbs.GetNetBalanceForPairForUpdate(context.Background(), profileID1, profileID2, currency)

	assert.NoError(t, err)
	assert.True(t, decimal.Zero.Equal(got), "expected 0, got %s", got)
}

// No Friendship row for the pair at all - defensive case, since resolveRepayment's only real
// caller already confirmed friendship via IsFriends before reaching here - still resolves to a
// zero balance rather than an error, same as RecalculatePair's handling of the same case.
func TestGetNetBalanceForPairForUpdate_NoFriendshipRow_ReturnsZero(t *testing.T) {
	profileID1 := uuid.New()
	profileID2 := uuid.New()
	currency := "USD"

	friendshipRepository := mocks.NewMockFriendshipRepository(t)
	friendshipRepository.EXPECT().
		FindByProfileIDsForUpdate(mock.Anything, profileID1, profileID2).
		Return(users.Friendship{}, nil)

	balanceRepository := mocks.NewMockFriendshipBalanceRepository(t)

	fbs := newFriendshipBalanceServiceForTest(friendshipRepository, balanceRepository)

	got, err := fbs.GetNetBalanceForPairForUpdate(context.Background(), profileID1, profileID2, currency)

	assert.NoError(t, err)
	assert.True(t, decimal.Zero.Equal(got), "expected 0, got %s", got)
	balanceRepository.AssertNotCalled(t, "FindAllByFriendshipID", mock.Anything, mock.Anything)
}
