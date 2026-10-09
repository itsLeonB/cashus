package store

import (
	"context"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/core/service/natsconn"
	"github.com/itsLeonB/cashback/internal/adapters/core/service/store"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/ungerr"
	"github.com/nats-io/nats.go/jetstream"
)

type StateStore interface {
	Store(ctx context.Context, state string, value string, expiry time.Duration) error
	VerifyAndDelete(ctx context.Context, state string) (string, error)
	Shutdown() error
}

func NewStateStore(js jetstream.JetStream) (StateStore, error) {
	return newStateStore(func() (StateStore, error) {
		kv, err := js.CreateOrUpdateKeyValue(context.Background(), store.KVConfig(config.Global.StateStoreBucket))
		if err != nil {
			return nil, ungerr.Wrap(err, "error creating NATS KV state store bucket")
		}
		return store.NewNATSKVStateStore(kv), nil
	})
}

// NewPerCallStateStore is NewStateStore for the API process: the "nats" store
// opens and closes its own connection per call via connect instead of holding
// one. The "inmemory" store opens no sockets and is unchanged.
func NewPerCallStateStore(connect natsconn.ConnectFunc) (StateStore, error) {
	return newStateStore(func() (StateStore, error) {
		return store.NewPerCallNATSKVStateStore(connect, config.Global.StateStoreBucket), nil
	})
}

// newStateStore picks the store by AUTH_STATE_STORE; newNATS builds the
// "nats" one.
func newStateStore(newNATS func() (StateStore, error)) (StateStore, error) {
	switch config.Global.StateStore {
	case "nats":
		return newNATS()
	case "inmemory":
		return store.NewInMemoryStateStore(), nil
	default:
		return nil, ungerr.Unknownf("unsupported AUTH_STATE_STORE value: %q", config.Global.StateStore)
	}
}
