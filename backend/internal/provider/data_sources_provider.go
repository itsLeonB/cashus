package provider

import (
	"database/sql"

	"github.com/google/wire"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/provider/datasource"
	"github.com/itsLeonB/ungerr"
	"gorm.io/gorm"
)

// DataSourceSet is the wire provider set for the DataSources.
var DataSourceSet = wire.NewSet(ProvideDataSource)

type DataSources struct {
	Gorm *gorm.DB
	SQL  *sql.DB
}

func ProvideDataSource() (*DataSources, func(), error) {
	gormDB, sqlDB, err := datasource.ProvideAndConfigureSQL(config.Global.DB)
	if err != nil {
		return nil, nil, err
	}

	ds := &DataSources{
		Gorm: gormDB,
		SQL:  sqlDB,
	}

	cleanup := func() {
		if err := ds.SQL.Close(); err != nil {
			logger.Error(ungerr.Wrap(err, "error closing SQL db"))
		}
	}

	return ds, cleanup, nil
}
