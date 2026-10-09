package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/itsLeonB/cashback/internal/adapters/http"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/core/logger"
	"github.com/itsLeonB/cashback/internal/core/otel"
	_ "github.com/joho/godotenv/autoload"
)

func main() {
	fmt.Printf("EXP boot pid=%d ts=%s\n", os.Getpid(), time.Now().Format(time.RFC3339Nano)) // EXPERIMENT CASH-24

	var exitCode int
	defer func() {
		os.Exit(exitCode)
	}()

	logger.Init("Cashback")

	if err := config.Load(); err != nil {
		logger.Error(err)
		exitCode = 1
		return
	}

	ctx := context.Background()
	otelShutdown, err := otel.InitSDK(ctx, config.Global.OTel)
	if err != nil {
		logger.Error(err)
		exitCode = 1
		return
	}
	defer func() {
		if err := otelShutdown(ctx); err != nil {
			logger.Error(err)
		}
	}()

	srv, shutdownFunc, err := http.Setup(*config.Global)
	if err != nil {
		logger.Error(err)
		exitCode = 1
		return
	}
	defer shutdownFunc()

	if err := srv.ListenAndServe(ctx); err != nil {
		logger.Error(err)
		exitCode = 1
	}
}
