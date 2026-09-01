package provider

//go:generate go tool wire

import (
	"github.com/itsLeonB/cashback/internal/provider/admin"
)

type Providers struct {
	*DataSources
	*Repositories
	*CoreServices
	*Services

	// Admin
	AdminRepos    *admin.Repositories
	AdminServices *admin.Services
}
