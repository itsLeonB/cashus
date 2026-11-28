package config

import (
	"strings"
	"time"

	"github.com/kelseyhightower/envconfig"
)

type Migrate struct {
	DB   migrateDB
	Wait migrateWait
}

type migrateDB struct {
	Host        string `required:"true"`
	Port        uint16 `required:"true"`
	User        string `required:"true"`
	Password    string `required:"true"`
	Name        string `required:"true"`
	SSLMode     string `split_words:"true" default:"verify-full"`
	SSLRootCert string `split_words:"true"`
}

type migrateWait struct {
	ConnectTimeout   time.Duration `split_words:"true" default:"10s"`
	LockTimeout      time.Duration `split_words:"true" default:"60s"`
	StatementTimeout time.Duration `split_words:"true" default:"5m"`
	Timeout          time.Duration `default:"15m"`
}

type MigrateConfigError struct {
	Stage   string
	Message string
}

func (err *MigrateConfigError) Error() string { return err.Stage + ": " + err.Message }

func LoadMigrate() (Migrate, error) {
	var cfg Migrate
	if err := envconfig.Process("DB", &cfg.DB); err != nil {
		return cfg, &MigrateConfigError{Stage: "DB configuration", Message: "invalid or missing value"}
	}
	if err := envconfig.Process("MIGRATE", &cfg.Wait); err != nil {
		return cfg, &MigrateConfigError{Stage: "MIGRATE configuration", Message: "invalid value"}
	}
	return cfg, cfg.Validate()
}

func (cfg Migrate) Validate() error {
	db := cfg.DB
	if db.Host == "" || strings.ContainsAny(db.Host, ",/\\\\") ||
		strings.Contains(strings.ToLower(db.Host), "-pooler") || db.Port == 0 ||
		db.User == "" || db.Password == "" || db.Name == "" || db.SSLMode != "verify-full" {
		return &MigrateConfigError{Stage: "DB configuration", Message: "direct TCP, non-pooled endpoint, and verify-full TLS required"}
	}
	for _, wait := range []time.Duration{cfg.Wait.ConnectTimeout, cfg.Wait.LockTimeout, cfg.Wait.StatementTimeout, cfg.Wait.Timeout} {
		if wait < time.Second || wait > 24*time.Hour {
			return &MigrateConfigError{Stage: "MIGRATE configuration", Message: "waits must be 1s..24h"}
		}
	}
	return nil
}
