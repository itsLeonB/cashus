package provider

//go:generate go tool wire

import (
	adminConfig "github.com/itsLeonB/cashback/internal/core/config/admin"
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

// ProvideAdminConfig reads the admin config global at call time, not at
// package-init time. admin.Global is nil until admin.Load() runs inside
// config.Load(), which every cmd/*/main.go calls explicitly inside main() —
// after package init has already finished. A wire.Value binding would have
// captured admin.Global via a package-level var initializer that runs before
// main(), permanently freezing it at nil; this ordinary provider function
// instead reads the global when wire's generated code calls it, which is
// always after config.Load() has populated it.
func ProvideAdminConfig() *adminConfig.Config {
	return adminConfig.Global
}
