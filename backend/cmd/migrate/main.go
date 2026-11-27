// migrate applies pending migrations once. It never rolls back or repairs history.
package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	jobmigrate "github.com/itsLeonB/cashback/internal/adapters/job/migrate"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/kelseyhightower/envconfig"
	"github.com/pressly/goose/v3"
)

type databaseConfig struct {
	Host        string `required:"true"`
	Port        uint16 `required:"true"`
	User        string `required:"true"`
	Password    string `required:"true"`
	Name        string `required:"true"`
	SSLMode     string `split_words:"true" default:"verify-full"`
	SSLRootCert string `split_words:"true"`
}

type waitConfig struct {
	ConnectTimeout   time.Duration `split_words:"true" default:"10s"`
	LockTimeout      time.Duration `split_words:"true" default:"60s"`
	StatementTimeout time.Duration `split_words:"true" default:"5m"`
	Timeout          time.Duration `default:"15m"`
}

func main() { os.Exit(run()) }

func run() int {
	if len(os.Args) != 1 {
		return failure("arguments: no arguments supported", nil)
	}
	var cfg databaseConfig
	var waits waitConfig
	if err := envconfig.Process("DB", &cfg); err != nil {
		return failure("DB configuration", err)
	}
	if err := envconfig.Process("MIGRATE", &waits); err != nil {
		return failure("MIGRATE configuration", err)
	}
	if cfg.Host == "" || strings.ContainsAny(cfg.Host, ",/\\\\") || strings.Contains(strings.ToLower(cfg.Host), "-pooler") || cfg.Port == 0 || cfg.User == "" || cfg.Password == "" || cfg.Name == "" || cfg.SSLMode != "verify-full" {
		return failure("DB configuration: direct TCP, non-pooled endpoint, and verify-full TLS required", nil)
	}
	for _, wait := range []time.Duration{waits.ConnectTimeout, waits.LockTimeout, waits.StatementTimeout, waits.Timeout} {
		if wait < time.Second || wait > 24*time.Hour {
			return failure("MIGRATE configuration: waits must be 1s..24h", nil)
		}
	}
	dsn := url.URL{Scheme: "postgres", Host: net.JoinHostPort(cfg.Host, strconv.Itoa(int(cfg.Port))), User: url.UserPassword(cfg.User, cfg.Password), Path: "/" + cfg.Name}
	query := url.Values{"sslmode": {"verify-full"}}
	if cfg.SSLRootCert != "" {
		query.Set("sslrootcert", cfg.SSLRootCert)
	}
	dsn.RawQuery = query.Encode()
	connection, err := pgx.ParseConfig(dsn.String())
	if err != nil {
		return failure("DB TLS configuration", err)
	}
	connection.ConnectTimeout = waits.ConnectTimeout
	connection.RuntimeParams = map[string]string{
		"application_name":  "cashus-migrate",
		"search_path":       "public",
		"lock_timeout":      strconv.FormatInt(waits.LockTimeout.Milliseconds(), 10),
		"statement_timeout": strconv.FormatInt(waits.StatementTimeout.Milliseconds(), 10),
	}
	db := stdlib.OpenDB(*connection)
	defer func() { _ = db.Close() }()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, waits.Timeout)
	defer cancel()
	pingCtx, cancelPing := context.WithTimeout(ctx, waits.ConnectTimeout)
	err = db.PingContext(pingCtx)
	cancelPing()
	if err != nil {
		return failure("connect", err)
	}
	migrator, err := jobmigrate.Setup(db, waits.LockTimeout)
	if err != nil {
		return failure("migration provider", err)
	}
	version, applied, err := migrator.Run(ctx)
	if err != nil {
		return failure("migration", err)
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
