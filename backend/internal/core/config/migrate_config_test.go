package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLoadMigrate(t *testing.T) {
	for key, value := range map[string]string{
		"DB_HOST":     "db.example",
		"DB_PORT":     "5432",
		"DB_USER":     "user",
		"DB_PASSWORD": "secret-password",
		"DB_NAME":     "cashus",
	} {
		t.Setenv(key, value)
	}

	for _, key := range []string{
		"DB_SSL_MODE",
		"DB_SSL_ROOT_CERT",
		"MIGRATE_CONNECT_TIMEOUT",
		"MIGRATE_LOCK_TIMEOUT",
		"MIGRATE_STATEMENT_TIMEOUT",
		"MIGRATE_TIMEOUT",
	} {
		t.Setenv(key, "")
		require.NoError(t, os.Unsetenv(key))
	}

	cfg, err := LoadMigrate()
	require.NoError(t, err)
	require.Equal(t, "verify-full", cfg.DB.SSLMode)
	require.Equal(t, uint16(5432), cfg.DB.Port)
	require.Equal(t, 10*time.Second, cfg.Wait.ConnectTimeout)
	require.Equal(t, time.Minute, cfg.Wait.LockTimeout)
	require.Equal(t, 5*time.Minute, cfg.Wait.StatementTimeout)
	require.Equal(t, 15*time.Minute, cfg.Wait.Timeout)

	tests := []struct {
		name  string
		key   string
		value string
		stage string
	}{
		{name: "pooled host", key: "DB_HOST", value: "db-pooler.example", stage: "DB configuration"},
		{name: "non-verify TLS", key: "DB_SSL_MODE", value: "require", stage: "DB configuration"},
		{name: "short timeout", key: "MIGRATE_TIMEOUT", value: "999ms", stage: "MIGRATE configuration"},
		{name: "long timeout", key: "MIGRATE_TIMEOUT", value: "24h1s", stage: "MIGRATE configuration"},
		{name: "invalid duration", key: "MIGRATE_TIMEOUT", value: "secret-duration", stage: "MIGRATE configuration"},
		{name: "missing password", key: "DB_PASSWORD", value: "", stage: "DB configuration"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(tt.key, tt.value)

			_, err := LoadMigrate()
			var configError *MigrateConfigError
			require.ErrorAs(t, err, &configError)
			require.Equal(t, tt.stage, configError.Stage)
			require.NotContains(t, err.Error(), "secret")
		})
	}
}
