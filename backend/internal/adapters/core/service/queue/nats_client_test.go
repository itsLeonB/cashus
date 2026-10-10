package queue

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/itsLeonB/cashback/internal/adapters/core/service/natsconn/natsconntest"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/stretchr/testify/assert"
)

func TestMain(m *testing.M) {
	logger.Init("test")
	os.Exit(m.Run())
}

type fakeMsg struct{ Name string }

func (fakeMsg) Type() string { return "fake.type" }

type fakeJS struct {
	jetstream.JetStream
	publishErr error
	published  []string
}

func (f *fakeJS) Publish(_ context.Context, subject string, _ []byte, _ ...jetstream.PublishOpt) (*jetstream.PubAck, error) {
	if f.publishErr != nil {
		return nil, f.publishErr
	}
	f.published = append(f.published, subject)
	return &jetstream.PubAck{Stream: "TASKS", Sequence: 1}, nil
}

func TestPerCallNATSTaskQueue_Enqueue_ClosesOnSuccess(t *testing.T) {
	js := &fakeJS{}
	fc := &natsconntest.Fake{JS: js}
	q := NewPerCallNATSTaskQueue(fc.Connect)

	assert.NoError(t, q.Enqueue(context.Background(), fakeMsg{Name: "a"}))

	assert.Equal(t, []string{"fake.type"}, js.published)
	assert.Equal(t, 1, fc.Connects)
	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSTaskQueue_Enqueue_ClosesOnPublishError(t *testing.T) {
	fc := &natsconntest.Fake{JS: &fakeJS{publishErr: errors.New("boom")}}
	q := NewPerCallNATSTaskQueue(fc.Connect)

	assert.Error(t, q.Enqueue(context.Background(), fakeMsg{}))

	assert.Equal(t, 1, fc.Connects)
	assert.Equal(t, 1, fc.Closes)
}

func TestPerCallNATSTaskQueue_Enqueue_ConnectErrorSurfaces(t *testing.T) {
	fc := &natsconntest.Fake{Err: errors.New("down")}
	q := NewPerCallNATSTaskQueue(fc.Connect)

	assert.Error(t, q.Enqueue(context.Background(), fakeMsg{}))

	assert.Equal(t, 0, fc.Closes, "nothing was opened, so nothing to close")
}

func TestPerCallNATSTaskQueue_Enqueue_ConnectsEachCall(t *testing.T) {
	js := &fakeJS{}
	fc := &natsconntest.Fake{JS: js}
	q := NewPerCallNATSTaskQueue(fc.Connect)

	assert.NoError(t, q.Enqueue(context.Background(), fakeMsg{}))
	assert.NoError(t, q.Enqueue(context.Background(), fakeMsg{}))

	assert.Equal(t, 2, fc.Connects)
	assert.Equal(t, 2, fc.Closes)
}

func TestNATSTaskQueue_Enqueue_UsesSharedJetStream(t *testing.T) {
	js := &fakeJS{}
	q := NewNATSTaskQueue(js)

	assert.NoError(t, q.Enqueue(context.Background(), fakeMsg{}))
	assert.Equal(t, []string{"fake.type"}, js.published)
}
