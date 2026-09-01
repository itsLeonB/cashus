//go:build wireinject

package provider

import (
	"github.com/google/wire"
	adminConfig "github.com/itsLeonB/cashback/internal/core/config/admin"
	"github.com/itsLeonB/cashback/internal/provider/admin"
)

// ProviderSet composes every provider set in this package plus the admin
// sub-package's, and assembles the top-level Providers struct from them.
var ProviderSet = wire.NewSet(
	DataSourceSet,
	TransactorSet,
	RepositorySet,
	CoreServiceSet,
	ServiceSet,
	admin.ProviderSet,
	wire.Value(adminConfig.Global),
	wire.FieldsOf(new(*DataSources), "Gorm"),
	wire.Struct(new(Providers), "*"),
)

func InitializeProviders() (*Providers, func(), error) {
	wire.Build(ProviderSet)
	return nil, nil, nil
}
