//go:build wireinject

package provider

import (
	"github.com/google/wire"
	"github.com/itsLeonB/cashback/internal/provider/admin"
)

// ProviderSet composes every provider set in this package plus the admin
// sub-package's, and assembles the top-level Providers struct from them.
//
// The admin config is supplied via ProvideAdminConfig, a normal runtime
// provider function, not wire.Value(adminConfig.Global): wire.Value would
// capture admin.Global through a package-level var initializer that runs at
// package-init time, before main() calls config.Load() (which is what
// actually populates admin.Global) — permanently freezing it at nil. See
// ProvideAdminConfig's doc comment for the full explanation.
var ProviderSet = wire.NewSet(
	DataSourceSet,
	TransactorSet,
	RepositorySet,
	CoreServiceSet,
	ServiceSet,
	admin.ProviderSet,
	ProvideAdminConfig,
	wire.FieldsOf(new(*DataSources), "Gorm"),
	wire.Struct(new(Providers), "*"),
)

func InitializeProviders() (*Providers, func(), error) {
	wire.Build(ProviderSet)
	return nil, nil, nil
}
