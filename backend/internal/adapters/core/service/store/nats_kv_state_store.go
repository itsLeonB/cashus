package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/core/service/natsconn"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/core/otel"
	"github.com/itsLeonB/ungerr"
	"github.com/nats-io/nats.go/jetstream"
)

// kvOpener yields the KV bucket for one call plus a func to close it: a
// no-op for the shared connection used by the worker and job, a real Close
// for the API's per-call connection.
type kvOpener func(ctx context.Context) (kv jetstream.KeyValue, closeConn func(), err error)

type natsKVStateStore struct {
	open kvOpener
}

// NewNATSKVStateStore wraps an already-open, long-lived KV bucket owned by
// the caller (worker and job processes).
func NewNATSKVStateStore(kv jetstream.KeyValue) *natsKVStateStore {
	return &natsKVStateStore{open: func(context.Context) (jetstream.KeyValue, func(), error) {
		return kv, func() {}, nil
	}}
}

// NewPerCallNATSKVStateStore is the API-process variant: every Store and
// VerifyAndDelete opens a connection via connect, creates or updates the
// bucket (same config the long-lived path uses), does its work, and closes
// the connection before returning, so no idle socket outlives the call (an
// idle NATS socket keeps the Railway service from sleeping). If NATS is down
// the error surfaces on the call (after the connect timeout), not at boot.
func NewPerCallNATSKVStateStore(connect natsconn.ConnectFunc, bucket string) *natsKVStateStore {
	return &natsKVStateStore{open: func(ctx context.Context) (jetstream.KeyValue, func(), error) {
		js, closeConn, err := connect(ctx)
		if err != nil {
			return nil, nil, err
		}

		kv, err := js.CreateOrUpdateKeyValue(ctx, KVConfig(bucket))
		if err != nil {
			closeConn()
			return nil, nil, ungerr.Wrap(err, "error creating NATS KV state store bucket")
		}

		return kv, closeConn, nil
	}}
}

// KVConfig is the state-store bucket config shared by the long-lived and
// per-call paths.
func KVConfig(bucket string) jetstream.KeyValueConfig {
	return jetstream.KeyValueConfig{
		Bucket:         bucket,
		History:        1,
		LimitMarkerTTL: 10 * time.Minute,
	}
}

func (s *natsKVStateStore) Store(ctx context.Context, state string, value string, expiry time.Duration) error {
	ctx, span := otel.Tracer.Start(ctx, "natsKVStateStore.Store")
	defer span.End()

	kv, closeConn, err := s.open(ctx)
	if err != nil {
		return err
	}
	defer closeConn()

	_, err = kv.Create(ctx, s.constructKey(state), []byte(value), jetstream.KeyTTL(expiry))
	if err != nil {
		return ungerr.Wrap(err, "error storing state in NATS KV")
	}

	return nil
}

func (s *natsKVStateStore) VerifyAndDelete(ctx context.Context, state string) (string, error) {
	ctx, span := otel.Tracer.Start(ctx, "natsKVStateStore.VerifyAndDelete")
	defer span.End()

	kv, closeConn, err := s.open(ctx)
	if err != nil {
		return "", err
	}
	defer closeConn()

	key := s.constructKey(state)
	entry, err := kv.Get(ctx, key)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return "", ungerr.BadRequestError("invalid state")
		}
		return "", ungerr.Wrap(err, "error verifying state in NATS KV")
	}

	if err := kv.Delete(ctx, key, jetstream.LastRevision(entry.Revision())); err != nil {
		logger.Warnf("error deleting state from NATS KV: %v", err)
		return "", ungerr.BadRequestError("invalid state")
	}

	return string(entry.Value()), nil
}

func (s *natsKVStateStore) Shutdown() error {
	return nil
}

func (s *natsKVStateStore) constructKey(state string) string {
	return fmt.Sprintf("state.%s", state)
}
