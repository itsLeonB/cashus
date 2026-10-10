// Package natsconntest provides a fake natsconn.ConnectFunc for tests of the
// per-call NATS adapters.
package natsconntest

import (
	"context"

	"github.com/nats-io/nats.go/jetstream"
)

// Fake counts connects and closes so tests can assert that every opened
// connection is closed. Set Err to make Connect fail (nothing is opened then).
type Fake struct {
	JS       jetstream.JetStream
	Err      error
	Connects int
	Closes   int
}

// Connect implements natsconn.ConnectFunc.
func (f *Fake) Connect(context.Context) (jetstream.JetStream, func(), error) {
	f.Connects++
	if f.Err != nil {
		return nil, nil, f.Err
	}
	return f.JS, func() { f.Closes++ }, nil
}
