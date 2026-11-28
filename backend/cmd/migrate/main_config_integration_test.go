//go:build integration

package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCLIRejectsInvalidConfiguration(t *testing.T) {
	binary, err := filepath.Abs("../../bin/migrate")
	require.NoError(t, err)

	tests := []struct {
		name     string
		env      []string
		wantText string
	}{
		{name: "missing database config", wantText: "DB configuration"},
		{name: "TLS downgrade", env: []string{"DB_HOST=localhost", "DB_PORT=5432", "DB_USER=user", "DB_PASSWORD=secret", "DB_NAME=db", "DB_SSL_MODE=require"}, wantText: "verify-full TLS required"},
		{name: "invalid duration", env: []string{"DB_HOST=localhost", "DB_PORT=5432", "DB_USER=user", "DB_PASSWORD=secret", "DB_NAME=db", "MIGRATE_TIMEOUT=not-a-duration"}, wantText: "MIGRATE configuration"},
		{name: "Neon pooled endpoint", env: []string{"DB_HOST=ep-test-pooler.us-east-2.aws.neon.tech", "DB_PORT=5432", "DB_USER=user", "DB_PASSWORD=secret", "DB_NAME=db"}, wantText: "pooled endpoint"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := exec.Command(binary)
			cmd.Dir = t.TempDir()
			cmd.Env = append([]string{"PATH=" + os.Getenv("PATH")}, tt.env...)
			var output bytes.Buffer
			cmd.Stdout, cmd.Stderr = &output, &output
			err := cmd.Run()
			require.Error(t, err)
			require.Contains(t, output.String(), tt.wantText)
			require.NotContains(t, output.String(), "secret")
		})
	}
}

func TestCLIRedactsConnectionSecrets(t *testing.T) {
	binary, err := filepath.Abs("../../bin/migrate")
	require.NoError(t, err)
	cmd := exec.Command(binary)
	cmd.Dir = t.TempDir()
	cmd.Env = append([]string{"PATH=" + os.Getenv("PATH")},
		"DB_HOST=127.0.0.1", "DB_PORT=1", "DB_USER=user", "DB_PASSWORD=do-not-print", "DB_NAME=db",
		"MIGRATE_CONNECT_TIMEOUT=1s", "MIGRATE_TIMEOUT=2s")
	var output bytes.Buffer
	cmd.Stdout, cmd.Stderr = &output, &output
	err = cmd.Run()
	require.Error(t, err)
	require.Contains(t, output.String(), "stage=connect")
	require.True(t, strings.Contains(output.String(), "exit_status=1"))
	require.NotContains(t, output.String(), "do-not-print")
}
