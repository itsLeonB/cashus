//go:build integration

package main

import (
	"bufio"
	"context"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestConcurrentMigrationsSerialize(t *testing.T) {
	d := newTestDatabase(t)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Goose v3.27.3 uses DefaultLockID 4097083626 in a session-level advisory lock.
	lock := exec.CommandContext(ctx, "docker", "exec", "-i", d.container, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1")
	stdin, err := lock.StdinPipe()
	require.NoError(t, err)
	lockOut, err := lock.StdoutPipe()
	require.NoError(t, err)
	require.NoError(t, lock.Start())
	_, err = stdin.Write([]byte("SELECT pg_advisory_lock(4097083626);\nSELECT 'LOCK_HELD';\n"))
	require.NoError(t, err)
	reader := bufio.NewReader(lockOut)
	_, err = reader.ReadString('\n')
	require.NoError(t, err)
	marker, err := reader.ReadString('\n')
	require.NoError(t, err)
	require.Contains(t, marker, "LOCK_HELD")
	t.Cleanup(func() {
		_, _ = stdin.Write([]byte("SELECT pg_advisory_unlock(4097083626);\\q\n"))
		_ = stdin.Close()
		_ = lock.Process.Kill()
		_ = lock.Wait()
	})

	// A finite timeout must fail while the external session owns the lock.
	out, err := d.cli("MIGRATE_LOCK_TIMEOUT=1s").CombinedOutput()
	require.Error(t, err, "%s", out)
	require.Contains(t, string(out), "stage=migration")
	require.Equal(t, "0", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))

	cliCtx, cancelCLIs := context.WithCancel(ctx)
	t.Cleanup(cancelCLIs)
	newCLI := func() *exec.Cmd {
		base := d.cli()
		cmd := exec.CommandContext(cliCtx, base.Path, base.Args[1:]...)
		cmd.Dir, cmd.Env = base.Dir, base.Env
		return cmd
	}
	first := newCLI()
	second := newCLI()
	type result struct {
		output string
		err    error
	}
	results := make(chan result, 2)
	run := func(cmd *exec.Cmd) {
		b, e := cmd.CombinedOutput()
		results <- result{string(b), e}
	}
	go run(first)
	go run(second)
	t.Cleanup(func() {
		cancelCLIs()
		for i := 0; i < 2; i++ {
			select {
			case <-results:
			case <-time.After(5 * time.Second):
				return
			}
		}
	})

	deadline := time.Now().Add(10 * time.Second)
	for {
		trying := d.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='cashus-migrate' AND query ILIKE '%pg_try_advisory_lock%'")
		if trying == "2" {
			break
		}
		require.Less(t, time.Now(), deadline, "both CLI sessions must be trying the held advisory lock; observed %s", trying)
		time.Sleep(100 * time.Millisecond)
	}
	require.Equal(t, "0", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
	_, err = stdin.Write([]byte("SELECT pg_advisory_unlock(4097083626);\\q\n"))
	require.NoError(t, err)
	_ = stdin.Close()
	for i := 0; i < 2; i++ {
		select {
		case got := <-results:
			require.NoError(t, got.err, "%s", got.output)
			require.Contains(t, got.output, "exit_status=0")
		case <-ctx.Done():
			t.Fatal("migration CLIs did not finish before deadline")
		}
	}
	require.Equal(t, "42", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied"))
	require.Equal(t, "0", d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND (is_applied IS NULL OR is_applied NOT IN (true,false))"))
	out, err = d.cli().CombinedOutput()
	require.NoError(t, err, "%s", out)
	require.Contains(t, string(out), "applied=0")
	require.Equal(t, "42", strings.TrimSpace(d.sql("SELECT count(*) FROM goose_db_version WHERE version_id > 0 AND is_applied")))
}
