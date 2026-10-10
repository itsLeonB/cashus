package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/core/service/natsconn/natsconntest"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
)

type mockKV struct {
	entries map[string][]byte
	jetstream.KeyValue
}

func newMockKV() *mockKV {
	return &mockKV{entries: make(map[string][]byte)}
}

func (m *mockKV) Create(ctx context.Context, key string, value []byte, opts ...jetstream.KVCreateOpt) (uint64, error) {
	if _, ok := m.entries[key]; ok {
		return 0, jetstream.ErrKeyExists
	}
	m.entries[key] = value
	return 1, nil
}

func (m *mockKV) Get(ctx context.Context, key string) (jetstream.KeyValueEntry, error) {
	v, ok := m.entries[key]
	if !ok {
		return nil, jetstream.ErrKeyNotFound
	}
	return &mockEntry{revision: 1, value: v}, nil
}

func (m *mockKV) Delete(ctx context.Context, key string, opts ...jetstream.KVDeleteOpt) error {
	delete(m.entries, key)
	return nil
}

type mockEntry struct {
	jetstream.KeyValueEntry
	revision uint64
	value    []byte
}

func (e *mockEntry) Revision() uint64 { return e.revision }
func (e *mockEntry) Value() []byte    { return e.value }

func TestNATSKVStateStore_Store(t *testing.T) {
	kv := newMockKV()
	s := NewNATSKVStateStore(kv)

	err := s.Store(context.Background(), "abc123", "session-data", 5*time.Minute)
	assert.NoError(t, err)

	assert.Contains(t, kv.entries, "state.abc123")
}

func TestNATSKVStateStore_Store_Duplicate(t *testing.T) {
	kv := newMockKV()
	s := NewNATSKVStateStore(kv)

	_ = s.Store(context.Background(), "abc123", "session-data", 5*time.Minute)
	err := s.Store(context.Background(), "abc123", "session-data", 5*time.Minute)
	assert.Error(t, err)
}

func TestNATSKVStateStore_VerifyAndDelete(t *testing.T) {
	kv := newMockKV()
	s := NewNATSKVStateStore(kv)

	_ = s.Store(context.Background(), "abc123", "session-data", 5*time.Minute)

	value, err := s.VerifyAndDelete(context.Background(), "abc123")
	assert.NoError(t, err)
	assert.Equal(t, "session-data", value)

	assert.NotContains(t, kv.entries, "state.abc123")
}

func TestNATSKVStateStore_VerifyAndDelete_NotFound(t *testing.T) {
	kv := newMockKV()
	s := NewNATSKVStateStore(kv)

	_, err := s.VerifyAndDelete(context.Background(), "nonexistent")
	assert.Error(t, err)
}

func TestNATSKVStateStore_Shutdown(t *testing.T) {
	kv := newMockKV()
	s := NewNATSKVStateStore(kv)

	assert.NoError(t, s.Shutdown())
}

// fakeJS hands out one shared mockKV and records the bucket config it was
// asked for; kvErr simulates a bucket create/update failure.
type fakeJS struct {
	jetstream.JetStream
	kv    *mockKV
	kvErr error
	cfgs  []jetstream.KeyValueConfig
}

func (f *fakeJS) CreateOrUpdateKeyValue(_ context.Context, cfg jetstream.KeyValueConfig) (jetstream.KeyValue, error) {
	f.cfgs = append(f.cfgs, cfg)
	if f.kvErr != nil {
		return nil, f.kvErr
	}
	return f.kv, nil
}

func newFakeConnect() (*natsconntest.Fake, *fakeJS) {
	js := &fakeJS{kv: newMockKV()}
	return &natsconntest.Fake{JS: js}, js
}

const testBucket = "state-store"

func TestPerCallNATSKVStateStore_Store_ClosesOnSuccess(t *testing.T) {
	fc, js := newFakeConnect()
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	assert.NoError(t, s.Store(context.Background(), "abc123", "session-data", 5*time.Minute))

	assert.Contains(t, js.kv.entries, "state.abc123")
	assert.Equal(t, 1, fc.Connects)
	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSKVStateStore_Store_ClosesOnKVError(t *testing.T) {
	fc, _ := newFakeConnect()
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	_ = s.Store(context.Background(), "abc123", "v", time.Minute)
	err := s.Store(context.Background(), "abc123", "v", time.Minute) // duplicate key

	assert.Error(t, err)
	assert.Equal(t, 2, fc.Connects)
	assert.Equal(t, 2, fc.Closes)
}

func TestPerCallNATSKVStateStore_Store_ClosesOnBucketError(t *testing.T) {
	fc, js := newFakeConnect()
	js.kvErr = errors.New("no bucket")
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	assert.Error(t, s.Store(context.Background(), "abc123", "v", time.Minute))

	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSKVStateStore_Store_ConnectErrorSurfaces(t *testing.T) {
	fc, _ := newFakeConnect()
	fc.Err = errors.New("down")
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	assert.Error(t, s.Store(context.Background(), "abc123", "v", time.Minute))

	assert.Equal(t, 0, fc.Closes, "nothing was opened, so nothing to close")
}

func TestPerCallNATSKVStateStore_CreatesBucketWithConfigOnEachConnection(t *testing.T) {
	fc, js := newFakeConnect()
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	_ = s.Store(context.Background(), "a", "v", time.Minute)
	_, _ = s.VerifyAndDelete(context.Background(), "a")

	assert.Len(t, js.cfgs, 2)
	for _, cfg := range js.cfgs {
		assert.Equal(t, testBucket, cfg.Bucket)
		assert.EqualValues(t, 1, cfg.History)
		assert.Equal(t, 10*time.Minute, cfg.LimitMarkerTTL)
	}
}

func TestPerCallNATSKVStateStore_VerifyAndDelete_ClosesOnSuccess(t *testing.T) {
	fc, js := newFakeConnect()
	js.kv.entries["state.abc123"] = []byte("session-data")
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	value, err := s.VerifyAndDelete(context.Background(), "abc123")

	assert.NoError(t, err)
	assert.Equal(t, "session-data", value)
	assert.NotContains(t, js.kv.entries, "state.abc123")
	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSKVStateStore_VerifyAndDelete_ClosesOnNotFound(t *testing.T) {
	fc, _ := newFakeConnect()
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	_, err := s.VerifyAndDelete(context.Background(), "nonexistent")

	assert.Error(t, err)
	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSKVStateStore_VerifyAndDelete_ConnectErrorSurfaces(t *testing.T) {
	fc, _ := newFakeConnect()
	fc.Err = errors.New("down")
	s := NewPerCallNATSKVStateStore(fc.Connect, testBucket)

	_, err := s.VerifyAndDelete(context.Background(), "abc123")

	assert.Error(t, err)
	assert.Equal(t, 0, fc.Closes)
}
