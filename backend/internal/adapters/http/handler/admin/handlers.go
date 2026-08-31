package admin

import (
	"github.com/itsLeonB/cashback/internal/provider"
	adminProvider "github.com/itsLeonB/cashback/internal/provider/admin"
)

type Handlers struct {
	Auth         AuthHandler
	Plan         PlanHandler
	PlanVersion  PlanVersionHandler
	Subscription SubscriptionHandler
	Profile      ProfileHandler
	Payment      PaymentHandler
}

func ProvideHandlers(adminServices *adminProvider.Services, adminRepos *adminProvider.Repositories, domainServices *provider.Services) *Handlers {
	return &Handlers{
		AuthHandler{kit: adminServices.Kit, userRepo: adminRepos.User},
		PlanHandler{domainServices.Plan},
		PlanVersionHandler{domainServices.PlanVersion},
		SubscriptionHandler{domainServices.Subscription},
		ProfileHandler{domainServices.Profile},
		PaymentHandler{domainServices.Payment},
	}
}
