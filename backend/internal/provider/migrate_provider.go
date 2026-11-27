package provider

import (
	"context"
	"database/sql"
	"net"
	"net/url"
	"strconv"

	jobmigrate "github.com/itsLeonB/cashback/internal/adapters/job/migrate"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

type MigrationStartupError struct {
	Stage string
	Err   error
}

func (migration *Migration) Close() {
	if err := migration.DB.Close(); err != nil {
		// Driver errors can contain credentials; log the cleanup stage, not raw text.
		logger.Error("migration cleanup failed stage=database_close")
	}
}

func (err *MigrationStartupError) Error() string { return err.Stage }
func (err *MigrationStartupError) Unwrap() error { return err.Err }

type Migration struct {
	DB     *sql.DB
	Runner *jobmigrate.Migrate
}

func postgresConfig(cfg config.Migrate) (*pgx.ConnConfig, error) {
	db, waits := cfg.DB, cfg.Wait
	dsn := url.URL{
		Scheme: "postgres",
		Host:   net.JoinHostPort(db.Host, strconv.Itoa(int(db.Port))),
		User:   url.UserPassword(db.User, db.Password),
		Path:   "/" + db.Name,
	}
	query := url.Values{"sslmode": {"verify-full"}}
	if db.SSLRootCert != "" {
		query.Set("sslrootcert", db.SSLRootCert)
	}
	dsn.RawQuery = query.Encode()
	connection, err := pgx.ParseConfig(dsn.String())
	if err != nil {
		return nil, err
	}
	connection.ConnectTimeout = waits.ConnectTimeout
	connection.RuntimeParams = map[string]string{
		"application_name":  "cashus-migrate",
		"search_path":       "public",
		"lock_timeout":      strconv.FormatInt(waits.LockTimeout.Milliseconds(), 10),
		"statement_timeout": strconv.FormatInt(waits.StatementTimeout.Milliseconds(), 10),
	}
	return connection, nil
}

func ProvideMigration(ctx context.Context, cfg config.Migrate) (*Migration, func(), error) {
	connection, err := postgresConfig(cfg)
	if err != nil {
		return nil, nil, &MigrationStartupError{Stage: "DB TLS configuration", Err: err}
	}

	migration := &Migration{DB: stdlib.OpenDB(*connection)}
	migration.DB.SetMaxOpenConns(1)
	migration.DB.SetMaxIdleConns(1)
	cleanup := migration.Close

	pingCtx, cancel := context.WithTimeout(ctx, cfg.Wait.ConnectTimeout)
	defer cancel()

	if err := migration.DB.PingContext(pingCtx); err != nil {
		cleanup()
		return nil, nil, &MigrationStartupError{Stage: "connect", Err: err}
	}

	migration.Runner, err = jobmigrate.Setup(migration.DB, cfg.Wait.LockTimeout)
	if err != nil {
		cleanup()
		return nil, nil, &MigrationStartupError{Stage: "migration provider", Err: err}
	}

	return migration, cleanup, nil
}
