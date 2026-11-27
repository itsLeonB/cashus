package migrate

import (
	"context"
	"database/sql"
	"io/fs"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/db/postgres"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

type Migrate struct {
	provider *goose.Provider
}

func Setup(db *sql.DB, lockTimeout time.Duration) (*Migrate, error) {
	locker, err := lock.NewPostgresSessionLocker(
		lock.WithLockTimeout(1, uint64(lockTimeout/time.Second)),
		lock.WithUnlockTimeout(1, 5),
	)
	if err != nil {
		return nil, err
	}
	migrations, err := fs.Sub(postgres.Migrations, "migrations")
	if err != nil {
		return nil, err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations,
		goose.WithSessionLocker(locker), goose.WithLogger(goose.NopLogger()))
	if err != nil {
		return nil, err
	}
	return &Migrate{provider: provider}, nil
}

func (m *Migrate) Run(ctx context.Context) (int64, int, error) {
	results, err := m.provider.Up(ctx)
	if err != nil {
		return 0, 0, err
	}
	version, err := m.provider.GetDBVersion(ctx)
	if err != nil {
		return 0, 0, err
	}
	return version, len(results), nil
}
