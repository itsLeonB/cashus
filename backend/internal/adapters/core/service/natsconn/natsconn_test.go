package natsconn

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNew_UnreachableURLFailsFast(t *testing.T) {
	start := time.Now()

	_, closeConn, err := New("nats://127.0.0.1:1")(context.Background())

	assert.Error(t, err)
	assert.Nil(t, closeConn)
	assert.Less(t, time.Since(start), connectTimeout)
}

func TestNew_CancelledContextAbortsDial(t *testing.T) {
	// A listener that accepts but never speaks NATS: without ctx support the
	// connect would wait out the full handshake timeout.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	assert.NoError(t, err)
	defer func() { _ = ln.Close() }()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	start := time.Now()

	_, closeConn, err := New("nats://" + ln.Addr().String())(ctx)

	assert.Error(t, err)
	assert.Nil(t, closeConn)
	assert.Less(t, time.Since(start), connectTimeout/2)
}
