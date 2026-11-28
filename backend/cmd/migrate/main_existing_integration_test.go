//go:build integration

package main

import (
	"context"
	"io/fs"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/itsLeonB/cashback/internal/adapters/db/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/require"
)

func TestExistingHistoryPreservesData(t *testing.T) {
	d := newTestDatabase(t)
	port, err := strconv.Atoi(envValue(d.env, "DB_PORT"))
	require.NoError(t, err)
	dsn := url.URL{Scheme: "postgres", Host: "127.0.0.1:" + strconv.Itoa(port), User: url.UserPassword("postgres", "disposable"), Path: "/postgres"}
	query := url.Values{"sslmode": {"verify-full"}, "sslrootcert": {envValue(d.env, "DB_SSL_ROOT_CERT")}}
	dsn.RawQuery = query.Encode()
	config, err := pgx.ParseConfig(dsn.String())
	require.NoError(t, err)
	db := stdlib.OpenDB(*config)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	migrations, err := fs.Sub(postgres.Migrations, "migrations")
	require.NoError(t, err)
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations, goose.WithLogger(goose.NopLogger()))
	require.NoError(t, err)
	_, err = provider.UpTo(context.Background(), 20260904090000)
	require.NoError(t, err)

	// Seed a profile row that predates the pending reminder-table migration.
	_, err = db.ExecContext(context.Background(), "INSERT INTO user_profiles (name) VALUES ('Existing peer')")
	require.NoError(t, err)
	before := d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied")
	require.Equal(t, "41", before)
	output, err := d.cli().CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "version=20260905090000 applied=1")
	require.Equal(t, "42", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
	require.Equal(t, "20260905090000", d.sql("SELECT max(version_id) FROM goose_db_version WHERE is_applied"))
	require.Equal(t, "split_reminders", d.sql("SELECT to_regclass('split_reminders')"))
	require.Equal(t, "Existing peer", d.sql("SELECT name FROM user_profiles WHERE name='Existing peer'"))

	output, err = d.cli().CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "applied=0")
	require.Equal(t, "42", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
}

func envValue(env []string, key string) string {
	for _, item := range env {
		name, value, ok := strings.Cut(item, "=")
		if ok && name == key {
			return value
		}
	}
	return ""
}
