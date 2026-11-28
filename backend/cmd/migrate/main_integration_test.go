//go:build integration

package main

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/require"
)

// These tests own their database. No application or production configuration is read.
type testDatabase struct {
	t         *testing.T
	container string
	env       []string
}

func newTestDatabase(t *testing.T) *testDatabase {
	t.Helper()
	d := &testDatabase{t: t}
	d.container = strings.TrimSpace(d.command("docker", "run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=disposable", "-p", "127.0.0.1::5432", "postgres:18"))
	t.Cleanup(func() { d.command("docker", "rm", "-f", d.container) })
	deadline := time.Now().Add(30 * time.Second)
	// The image bootstrap server accepts Unix sockets before the final TCP server starts.
	for {
		if exec.Command("docker", "exec", d.container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres").Run() == nil {
			break
		}
		require.True(t, time.Now().Before(deadline), "PostgreSQL startup timeout")
		time.Sleep(100 * time.Millisecond)
	}
	d.command("docker", "exec", "-u", "postgres", d.container, "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "/tmp/migrate.key", "-out", "/tmp/migrate.crt", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1")
	d.sql("ALTER SYSTEM SET ssl = on")
	d.sql("ALTER SYSTEM SET ssl_cert_file = '/tmp/migrate.crt'")
	d.sql("ALTER SYSTEM SET ssl_key_file = '/tmp/migrate.key'")
	d.sql("SELECT pg_reload_conf()")
	cert := filepath.Join(t.TempDir(), "root.crt")
	d.command("docker", "cp", d.container+":/tmp/migrate.crt", cert)
	port := strings.TrimSpace(d.command("docker", "port", d.container, "5432/tcp"))
	port = strings.TrimPrefix(port, "127.0.0.1:")
	d.env = []string{"DB_HOST=127.0.0.1", "DB_PORT=" + port, "DB_USER=postgres", "DB_PASSWORD=disposable", "DB_NAME=postgres", "DB_SSL_ROOT_CERT=" + cert}
	require.NoError(t, waitForVerifiedTLS(d.env, 10*time.Second))
	return d
}

func waitForVerifiedTLS(env []string, timeout time.Duration) error {
	port, err := strconv.Atoi(envValue(env, "DB_PORT"))
	if err != nil {
		return fmt.Errorf("invalid PostgreSQL test port")
	}
	dsn := url.URL{Scheme: "postgres", Host: net.JoinHostPort(envValue(env, "DB_HOST"), strconv.Itoa(port)), User: url.UserPassword(envValue(env, "DB_USER"), envValue(env, "DB_PASSWORD")), Path: "/" + envValue(env, "DB_NAME")}
	dsn.RawQuery = url.Values{"sslmode": {"verify-full"}, "sslrootcert": {envValue(env, "DB_SSL_ROOT_CERT")}, "connect_timeout": {"2"}}.Encode()
	config, err := pgx.ParseConfig(dsn.String())
	if err != nil {
		return fmt.Errorf("invalid verified TLS test connection settings")
	}
	deadline := time.Now().Add(timeout)
	for {
		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		db := stdlib.OpenDB(*config)
		err = db.PingContext(ctx)
		cancel()
		closeErr := db.Close()
		if closeErr != nil {
			return fmt.Errorf("close TLS readiness connection")
		}
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("verified TLS connection timeout")
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func (d *testDatabase) command(name string, args ...string) string {
	d.t.Helper()
	out, err := exec.Command(name, args...).CombinedOutput()
	require.NoError(d.t, err, "%s: %s", name, out)
	return string(out)
}

func (d *testDatabase) sql(query string) string {
	d.t.Helper()
	return strings.TrimSpace(d.command("docker", "exec", d.container, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", query))
}

func (d *testDatabase) cli(overrides ...string) *exec.Cmd {
	d.t.Helper()
	binary, err := filepath.Abs("../../bin/migrate")
	require.NoError(d.t, err)
	cmd := exec.Command(binary)
	cmd.Dir = d.t.TempDir() // An unrelated .env must not configure the migrator.
	cmd.Env = append(append([]string{"PATH=" + os.Getenv("PATH")}, d.env...), overrides...)
	return cmd
}

func TestFailedMigrationCanRetry(t *testing.T) {
	d := newTestDatabase(t)
	d.sql("CREATE TABLE split_reminders (conflict boolean)")
	output, err := d.cli().CombinedOutput()
	require.Error(t, err)
	require.Contains(t, string(output), "stage=migration")
	require.NotContains(t, string(output), "disposable")
	require.Equal(t, "0", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id=20260905090000 AND is_applied"))
	d.sql("DROP TABLE split_reminders")
	output, err = d.cli().CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Equal(t, "42", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
}

func TestFreshHistoryAndNoOp(t *testing.T) {
	d := newTestDatabase(t)
	output, err := d.cli().CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "version=20260905090000")
	require.Contains(t, string(output), "exit_status=0")
	require.NotContains(t, string(output), "disposable")
	count := d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied")
	require.Equal(t, "42", count)
	require.Equal(t, "split_reminders", d.sql("SELECT to_regclass('split_reminders')"))
	output, err = d.cli().CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "applied=0")
	require.Equal(t, count, d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
	fmt.Fprint(os.Stdout, string(output))
}
