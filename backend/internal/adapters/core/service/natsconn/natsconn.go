// Package natsconn is the seam between the API's per-call NATS adapters and
// the real NATS client. The API process must not hold idle outbound sockets
// (an idle socket keeps the Railway service from sleeping), so adapters open
// a connection per call through a ConnectFunc and close it before returning.
package natsconn

import (
	"context"
	"net"
	"time"

	"github.com/itsLeonB/ungerr"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// connectTimeout bounds the dial and the initial NATS handshake when NATS is
// unreachable.
const connectTimeout = 2 * time.Second

// ConnectFunc opens one connection and returns its JetStream context plus a
// func that closes it. The caller must call closeConn exactly once when done.
// closeConn is nil when err is non-nil (nothing was opened).
type ConnectFunc func(ctx context.Context) (js jetstream.JetStream, closeConn func(), err error)

// New returns a ConnectFunc that dials url and closes the connection with
// Close (not Drain: nothing is subscribed, and publishes are already acked by
// the time the adapters return). The dial honours ctx cancellation; the
// handshake after dialing is bounded by connectTimeout only, since nats.go
// takes no ctx there. There is no retry.
func New(url string) ConnectFunc {
	return func(ctx context.Context) (jetstream.JetStream, func(), error) {
		nc, err := nats.Connect(url,
			nats.Timeout(connectTimeout),
			nats.SetCustomDialer(ctxDialer{ctx: ctx}),
		)
		if err != nil {
			return nil, nil, ungerr.Wrap(err, "error connecting to NATS")
		}

		js, err := jetstream.New(nc)
		if err != nil {
			nc.Close()
			return nil, nil, ungerr.Wrap(err, "error creating JetStream context")
		}

		return js, nc.Close, nil
	}
}

// ctxDialer lets nats.Connect, which takes no context, abort its dial when
// the caller's ctx is cancelled.
type ctxDialer struct{ ctx context.Context }

func (d ctxDialer) Dial(network, address string) (net.Conn, error) {
	return (&net.Dialer{Timeout: connectTimeout}).DialContext(d.ctx, network, address)
}
