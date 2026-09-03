package job

import (
	"github.com/itsLeonB/cashback/internal/adapters/job/asset"
	"github.com/itsLeonB/cashback/internal/adapters/job/migrate"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/provider"
)

type Job struct {
	cleanup func()
	asset   *asset.Asset
	migrate *migrate.Migrate
}

func Setup(cfg *config.Config) (*Job, error) {
	providers, cleanup, err := provider.InitializeProviders()
	if err != nil {
		return nil, err
	}

	migrator, err := migrate.Setup(providers)
	if err != nil {
		cleanup()
		return nil, err
	}

	return &Job{cleanup, asset.Setup(providers), migrator}, nil
}

func (j *Job) Run() {
	logger.Info("running all jobs...")

	defer j.cleanup()

	logger.Info("running migrations...")
	if err := j.migrate.Run(); err != nil {
		logger.Fatal(err)
	}
	logger.Info("success running migrations")

	logger.Info("running asset sync...")
	if err := j.asset.Run(); err != nil {
		logger.Fatal(err)
	}
	logger.Info("success running asset sync")

	logger.Info("success running all jobs")
}
