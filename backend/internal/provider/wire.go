//go:build wireinject

package provider

import (
	"github.com/google/wire"
	"github.com/itsLeonB/cashback/internal/provider/admin"
)

// baseSet composes every provider set in this package plus the admin
// sub-package's, and assembles the top-level Providers struct from them,
// except for the CoreServices sub-resources, which differ between the
// long-lived (ProviderSet) and per-call (HTTPProviderSet) variants.
//
// The admin config is supplied via ProvideAdminConfig, a normal runtime
// provider function, not wire.Value(adminConfig.Global): wire.Value would
// capture admin.Global through a package-level var initializer that runs at
// package-init time, before main() calls config.Load() (which is what
// actually populates admin.Global) — permanently freezing it at nil. See
// ProvideAdminConfig's doc comment for the full explanation.
var baseSet = wire.NewSet(
	DataSourceSet,
	TransactorSet,
	RepositorySet,
	ServiceSet,
	admin.ProviderSet,
	ProvideAdminConfig,
	wire.FieldsOf(new(*DataSources), "Gorm"),
	wire.Struct(new(Providers), "*"),
)

// ProviderSet is the long-lived wiring used by the worker and job.
var ProviderSet = wire.NewSet(
	baseSet,
	CoreServiceSet,
)

// HTTPProviderSet is ProviderSet for the API process, swapping in
// HTTPCoreServiceSet so NATS is connected per call, not held open.
var HTTPProviderSet = wire.NewSet(
	baseSet,
	HTTPCoreServiceSet,
)

func InitializeProviders() (*Providers, func(), error) {
	wire.Build(ProviderSet)
	return nil, nil, nil
}

// InitializeHTTPProviders is InitializeProviders for the API process; see
// HTTPCoreServiceSet.
func InitializeHTTPProviders() (*Providers, func(), error) {
	wire.Build(HTTPProviderSet)
	return nil, nil, nil
}
