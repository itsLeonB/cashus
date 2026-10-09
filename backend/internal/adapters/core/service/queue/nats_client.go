package queue

import (
	"context"
	"encoding/json"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/core/service/natsconn"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/core/otel"
	"github.com/itsLeonB/cashback/internal/core/service/queue"
	"github.com/itsLeonB/ungerr"
	"github.com/nats-io/nats.go/jetstream"
	"go.opentelemetry.io/otel/trace"
)

// natsClient publishes tasks to JetStream. open yields the JetStream context
// for one call plus a func to close it: a no-op for the shared connection
// used by the worker and job, a real Close for the API's per-call connection.
type natsClient struct {
	open natsconn.ConnectFunc
}

// NewNATSTaskQueue publishes over an already-open, long-lived JetStream
// context owned by the caller (worker and job processes).
func NewNATSTaskQueue(js jetstream.JetStream) *natsClient {
	return &natsClient{open: func(context.Context) (jetstream.JetStream, func(), error) {
		return js, func() {}, nil
	}}
}

// NewPerCallNATSTaskQueue is the API-process variant: every Enqueue opens a
// connection via connect, publishes, and closes it before returning, so no
// idle socket outlives the call (an idle NATS socket keeps the Railway
// service from sleeping). If NATS is down the error surfaces on the call
// (after the connect timeout), not at boot.
func NewPerCallNATSTaskQueue(connect natsconn.ConnectFunc) *natsClient {
	return &natsClient{open: connect}
}

func (nc *natsClient) Enqueue(ctx context.Context, message queue.TaskMessage) error {
	ctx, span := otel.Tracer.Start(ctx, "natsClient.Enqueue")
	defer span.End()

	payload, err := json.Marshal(message)
	if err != nil {
		return ungerr.Wrap(err, "error marshaling message to JSON")
	}

	js, closeConn, err := nc.open(ctx)
	if err != nil {
		return err
	}
	defer closeConn()

	ack, err := js.Publish(ctx, message.Type(), payload)
	if err != nil {
		return ungerr.Wrap(err, "error publishing message to NATS")
	}

	logger.Infof("published message: Stream=%s, Seq=%d, Subject=%s", ack.Stream, ack.Sequence, message.Type())
	return nil
}

func (nc *natsClient) Shutdown() error {
	return nil
}

func (nc *natsClient) AsyncEnqueue(ctx context.Context, msg queue.TaskMessage) {
	parentSpanCtx := trace.SpanContextFromContext(ctx)
	go func() {
		detached, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if parentSpanCtx.IsValid() {
			detached = trace.ContextWithSpanContext(detached, parentSpanCtx)
		}

		if err := nc.Enqueue(detached, msg); err != nil {
			logger.Error(err)
		}
	}()
}
