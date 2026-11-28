// migrate applies pending migrations once. It never rolls back or repairs history.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	migrationjob "github.com/itsLeonB/cashback/internal/adapters/job/migrate"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/provider"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pressly/goose/v3"
)

func main() { os.Exit(run()) }

func run() int {
	logger.Init("Migrate")

	if len(os.Args) != 1 {
		return failure("arguments", nil)
	}

	cfg, err := config.LoadMigrate()
	if err != nil {
		stage := "configuration"
		var configError *config.MigrateConfigError
		if errors.As(err, &configError) {
			stage = configError.Error()
		}
		return failure(stage, err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, cfg.Wait.Timeout)
	defer cancel()

	migration, cleanup, err := provider.ProvideMigration(ctx, cfg)
	if err != nil {
		stage := "startup"
		var startup *provider.MigrationStartupError
		if errors.As(err, &startup) {
			stage = startup.Stage
		}
		return failure(stage, err)
	}
	defer cleanup()

	version, applied, err := migration.Runner.Run(ctx)
	if err != nil {
		stage := "migration"
		var runError *migrationjob.RunError
		if errors.As(err, &runError) {
			switch runError.Stage {
			case migrationjob.StageVersion:
				stage = string(migrationjob.StageVersion)
			case migrationjob.StageExecution:
				stage = string(migrationjob.StageExecution)
			}
		}
		return failure(stage, err)
	}
	fmt.Printf("migration succeeded version=%d applied=%d exit_status=0\n", version, applied)
	return 0
}

// Driver and SQL error text can contain credentials or row data. Log only safe identifiers.
func failure(stage string, err error) int {
	var migration *goose.PartialError
	var pgError *pgconn.PgError
	var version int64
	code := "unknown"
	if errors.As(err, &migration) {
		version = migration.Failed.Source.Version
	}
	if errors.As(err, &pgError) {
		code = pgError.Code
	}
	fmt.Fprintf(os.Stderr, "migration failed stage=%s version=%d sqlstate=%s exit_status=1\n", stage, version, code)
	return 1
}
