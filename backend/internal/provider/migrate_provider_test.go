package provider

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/stretchr/testify/require"
)

type closeErrorDriver struct{}
type closeErrorConn struct{}

func (closeErrorDriver) Open(string) (driver.Conn, error)             { return closeErrorConn{}, nil }
func (closeErrorDriver) Connect(context.Context) (driver.Conn, error) { return closeErrorConn{}, nil }
func (closeErrorDriver) Driver() driver.Driver                        { return closeErrorDriver{} }
func (closeErrorConn) Prepare(string) (driver.Stmt, error)            { return nil, errors.New("unused") }
func (closeErrorConn) Begin() (driver.Tx, error)                      { return nil, errors.New("unused") }
func (closeErrorConn) Close() error                                   { return errors.New("secret-bearing driver error") }

func TestMigrationCleanupLogsErrorWithoutFailingProcess(t *testing.T) {
	if os.Getenv("CASHUS_TEST_MIGRATION_CLOSE") == "1" {
		logger.Init("Migrate")

		db := sql.OpenDB(closeErrorDriver{})
		conn, err := db.Conn(context.Background())
		require.NoError(t, err)
		require.NoError(t, conn.Close())

		migration := &Migration{DB: db}
		exitCode := func() int {
			defer migration.Close()
			return 0
		}()

		fmt.Printf("migration exit_status=%d\n", exitCode)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestMigrationCleanupLogsErrorWithoutFailingProcess$")
	cmd.Env = append(os.Environ(), "CASHUS_TEST_MIGRATION_CLOSE=1")
	output, err := cmd.CombinedOutput()

	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "migration cleanup failed stage=database_close")
	require.Contains(t, string(output), "migration exit_status=0")
	require.NotContains(t, string(output), "secret-bearing")
}
