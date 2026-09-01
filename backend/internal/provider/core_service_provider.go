package provider

import (
	"github.com/go-playground/validator/v10"
	"github.com/google/wire"
	adapters "github.com/itsLeonB/cashback/internal/adapters/core/service/queue"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/core/service/langfuse"
	"github.com/itsLeonB/cashback/internal/core/service/llm"
	"github.com/itsLeonB/cashback/internal/core/service/mail"
	"github.com/itsLeonB/cashback/internal/core/service/ocr"
	"github.com/itsLeonB/cashback/internal/core/service/queue"
	"github.com/itsLeonB/cashback/internal/core/service/storage"
	"github.com/itsLeonB/cashback/internal/core/service/store"
	"github.com/itsLeonB/cashback/internal/core/service/webpush"
	"github.com/itsLeonB/ungerr"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// CoreServiceSet is the wire provider set for CoreServices, assembled from
// the individual sub-resource providers below via wire.Struct so that wire's
// generated cleanup ordering handles partial-construction failures (e.g. a
// later sub-resource failing after the NATS connection is already open).
var CoreServiceSet = wire.NewSet(
	ProvideGCSStorage,
	ProvideOCRClient,
	ProvideNATSConn,
	ProvideJetStream,
	ProvideStateStore,
	ProvideTaskQueue,
	ProvideLangfuseClient,
	ProvideLLMService,
	ProvideMailService,
	ProvideImageService,
	ProvideWebPushClient,
	wire.Struct(new(CoreServices), "*"),
)

type CoreServices struct {
	LLM      llm.LLMService
	Mail     mail.MailService
	Image    storage.ImageService
	State    store.StateStore
	OCR      ocr.OCRService
	Storage  storage.StorageRepository
	Queue    queue.TaskQueue
	WebPush  webpush.Client
	Langfuse langfuse.Client

	NATSConn  *nats.Conn
	JetStream jetstream.JetStream
}

// ProvideGCSStorage opens the GCS-backed storage repository.
func ProvideGCSStorage() (storage.StorageRepository, func(), error) {
	storageRepo, err := storage.NewGCSStorageRepository()
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		if err := storageRepo.Close(); err != nil {
			logger.Error(ungerr.Wrap(err, "error closing GCS storage client"))
		}
	}

	return storageRepo, cleanup, nil
}

// ProvideOCRClient opens the OCR client.
func ProvideOCRClient() (ocr.OCRService, func(), error) {
	ocrClient, err := ocr.NewOCRClient()
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		if err := ocrClient.Shutdown(); err != nil {
			logger.Error(ungerr.Wrap(err, "error shutting down OCR client"))
		}
	}

	return ocrClient, cleanup, nil
}

// ProvideNATSConn opens the NATS connection. Its cleanup drains the
// connection; wire calls this cleanup before any of its own inputs' cleanups
// on both a graceful full shutdown and a later sub-resource's construction
// failure, which subsumes the old hand-rolled nc.Close()-on-failure branch.
//
// Note Drain() is not a synchronous replacement for the old Close(): it
// spawns an internal goroutine bounded by nats.go's DrainTimeout (30s by
// default) and returns immediately, so on this codebase's failure paths
// (every caller logs and os.Exit(1)s right after a construction error) the
// drain goroutine is likely killed mid-flight rather than completing —
// effectively best-effort, not a guarantee strictly stronger than the old
// Close(). Practical impact is low here (no subscriptions or pending
// publishes exist yet at construction time, and the OS reclaims the socket
// on exit regardless), and the same async-vs-exit race already existed
// pre-wire on the graceful full-shutdown path, so this is left as-is rather
// than reintroducing a separate Close()-based failure branch.
func ProvideNATSConn() (*nats.Conn, func(), error) {
	nc, err := nats.Connect(config.Global.Url)
	if err != nil {
		return nil, nil, ungerr.Wrap(err, "error connecting to NATS")
	}

	cleanup := func() {
		if err := nc.Drain(); err != nil {
			logger.Error(ungerr.Wrap(err, "error draining NATS connection"))
		}
	}

	return nc, cleanup, nil
}

// ProvideJetStream creates the JetStream context from the NATS connection.
func ProvideJetStream(nc *nats.Conn) (jetstream.JetStream, error) {
	js, err := jetstream.New(nc)
	if err != nil {
		return nil, ungerr.Wrap(err, "error creating JetStream context")
	}

	return js, nil
}

// ProvideStateStore creates the JetStream-backed state store.
func ProvideStateStore(js jetstream.JetStream) (store.StateStore, func(), error) {
	stateStore, err := store.NewStateStore(js)
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		if err := stateStore.Shutdown(); err != nil {
			logger.Error(ungerr.Wrap(err, "error shutting down state store"))
		}
	}

	return stateStore, cleanup, nil
}

// ProvideTaskQueue creates the JetStream-backed task queue.
func ProvideTaskQueue(js jetstream.JetStream) (queue.TaskQueue, func()) {
	taskQueue := adapters.NewNATSTaskQueue(js)

	cleanup := func() {
		if err := taskQueue.Shutdown(); err != nil {
			logger.Error(ungerr.Wrap(err, "error shutting down task queue"))
		}
	}

	return taskQueue, cleanup
}

// ProvideLangfuseClient creates the Langfuse client.
func ProvideLangfuseClient() (langfuse.Client, func()) {
	client := langfuse.NewClient(config.Global.Langfuse)

	cleanup := func() {
		if err := client.Shutdown(); err != nil {
			logger.Error(ungerr.Wrap(err, "error shutting down langfuse client"))
		}
	}

	return client, cleanup
}

// ProvideLLMService creates the LLM service. No cleanup required.
func ProvideLLMService() llm.LLMService {
	return llm.NewLLMService(config.Global.LLM)
}

// ProvideMailService creates the mail service. No cleanup required.
func ProvideMailService() mail.MailService {
	return mail.NewMailService()
}

// ProvideImageService creates the image service, reusing the GCS storage
// repository.
func ProvideImageService(storageRepo storage.StorageRepository) storage.ImageService {
	return storage.NewImageService(validator.New(), storageRepo)
}

// ProvideWebPushClient creates the web push client. No cleanup required.
func ProvideWebPushClient() webpush.Client {
	return webpush.NewWebPush(config.Global.Push)
}
