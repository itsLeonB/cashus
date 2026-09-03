package provider

import (
	"github.com/google/wire"
	adapters "github.com/itsLeonB/cashback/internal/adapters/repository"
	monetizationAdapter "github.com/itsLeonB/cashback/internal/adapters/repository/monetization"
	"github.com/itsLeonB/cashback/internal/domain/entity/monetization"
	"github.com/itsLeonB/cashback/internal/domain/entity/users"
	"github.com/itsLeonB/cashback/internal/domain/repository"
	monetizationRepo "github.com/itsLeonB/cashback/internal/domain/repository/monetization"
	"github.com/itsLeonB/go-crud"
	"gorm.io/gorm"
)

// TransactorSet provides the single crud.Transactor instance shared by the
// top-level Repositories and admin.Repositories, so both wrap the same
// underlying *gorm.DB transaction manager instead of each constructing their
// own.
var TransactorSet = wire.NewSet(ProvideTransactor)

// RepositorySet is the wire provider set for the top-level Repositories.
var RepositorySet = wire.NewSet(ProvideRepositories)

// ProvideTransactor builds the single crud.Transactor shared across the
// top-level and admin repositories.
func ProvideTransactor(db *gorm.DB) crud.Transactor {
	return crud.NewTransactor(db)
}

type Repositories struct {
	Transactor crud.Transactor

	// Users
	User               repository.UserRepository
	Profile            repository.ProfileRepository
	Friendship         repository.FriendshipRepository
	FriendshipBalance  repository.FriendshipBalanceRepository
	PasswordResetToken crud.Repository[users.PasswordResetToken]
	OAuthAccount       crud.Repository[users.OAuthAccount]
	FriendshipRequest  repository.FriendshipRequestRepository
	Session            crud.Repository[users.Session]
	RefreshToken       crud.Repository[users.RefreshToken]

	// Debts
	DebtTransaction       repository.DebtTransactionRepository
	TransferMethod        repository.TransferMethodRepository
	ProfileTransferMethod repository.ProfileTransferMethodRepository

	// Expenses
	GroupExpense repository.GroupExpenseRepository
	ExpenseItem  repository.ExpenseItemRepository
	OtherFee     repository.OtherFeeRepository
	ExpenseBill  repository.ExpenseBillRepository

	// Monetization
	Plan         crud.Repository[monetization.Plan]
	PlanVersion  monetizationRepo.PlanVersionRepository
	Subscription monetizationRepo.SubscriptionRepository
	Payment      crud.Repository[monetization.Payment]

	// Infra
	Notification     repository.NotificationRepository
	PushSubscription repository.PushSubscriptionRepository
}

func ProvideRepositories(db *gorm.DB, transactor crud.Transactor) *Repositories {
	return &Repositories{
		Transactor: transactor,

		User:               adapters.NewUserRepository(db),
		Profile:            adapters.NewProfileRepository(db),
		Friendship:         adapters.NewFriendshipRepository(db),
		FriendshipBalance:  adapters.NewFriendshipBalanceRepository(db),
		PasswordResetToken: crud.NewRepository[users.PasswordResetToken](db),
		OAuthAccount:       crud.NewRepository[users.OAuthAccount](db),
		FriendshipRequest:  adapters.NewFriendshipRequestRepository(db),
		Session:            crud.NewRepository[users.Session](db),
		RefreshToken:       crud.NewRepository[users.RefreshToken](db),

		DebtTransaction:       adapters.NewDebtTransactionRepository(db),
		TransferMethod:        adapters.NewTransferMethodRepository(db),
		ProfileTransferMethod: adapters.NewProfileTransferMethodRepository(db),

		GroupExpense: adapters.NewGroupExpenseRepository(db),
		ExpenseItem:  adapters.NewExpenseItemRepository(db),
		OtherFee:     adapters.NewOtherFeeRepository(db),
		ExpenseBill:  adapters.NewExpenseBillRepository(db),

		Plan:         crud.NewRepository[monetization.Plan](db),
		PlanVersion:  monetizationAdapter.NewPlanVersionRepository(db),
		Subscription: monetizationAdapter.NewSubscriptionRepository(db),
		Payment:      crud.NewRepository[monetization.Payment](db),

		Notification:     adapters.NewNotificationRepository(db),
		PushSubscription: adapters.NewPushSubscriptionRepository(db),
	}
}
