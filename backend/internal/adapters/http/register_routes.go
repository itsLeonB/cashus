package http

import (
	"os"

	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	_ "github.com/itsLeonB/cashback/docs"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler"
	adminHandler "github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/adapters/http/middlewares"
	"github.com/itsLeonB/cashback/internal/adapters/http/routes"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/itsLeonB/cashback/internal/provider"
	"github.com/itsLeonB/cashback/internal/provider/admin"
	"github.com/itsLeonB/go-authkit"
	"github.com/itsLeonB/go-authkit/authgin"
	"github.com/kroma-labs/sentinel-go/httpserver"
	sentinelGin "github.com/kroma-labs/sentinel-go/httpserver/adapters/gin"
)

func RegisterRoutes(router *gin.Engine, configs config.Config, services *provider.Services, adminServices *admin.Services, adminRepos *admin.Repositories) (func(), error) {
	authCfg := configs.Auth

	transport, err := authgin.NewCookieTransport(authgin.CookieConfig{
		Domain:     authCfg.CookieDomain,
		Secure:     authCfg.CookieSecure,
		SameSite:   authCfg.ParsedSameSite(),
		AccessTTL:  authCfg.TokenDuration,
		RefreshTTL: authCfg.RefreshTokenDuration,
	})
	if err != nil {
		return nil, err
	}

	authMW := authgin.AuthMiddleware(services.AuthKit, transport, authkit.RequireAuth)

	handlers := handler.ProvideHandlers(services, transport)
	adminHandlers := adminHandler.ProvideHandlers(adminServices, adminRepos, services)
	mw := middlewares.Provide(configs.App, adminServices.Kit)

	router.Use(mw.Err)

	sentinelGin.RegisterHealth(router, httpserver.NewHealthHandler())

	if configs.App.Env != "release" {
		sentinelGin.RegisterPprof(router, httpserver.DefaultPprofConfig())
		routes.RegisterTestRoutes(router)
	}

	// Huma API bound to the engine root. Operations carry full paths (e.g.
	// "/api/v1/debts"), so this single huma.API covers public + protected +
	// admin routes as they migrate off ginkgo. Huma auto-mounts its docs UI
	// and OpenAPI spec at "/docs", "/openapi.json", "/openapi.yaml" —
	// unauthenticated, outside "/api/v1" — which is why the swaggo UI route
	// (also "/docs/*any") is removed here to avoid colliding with it.
	api := humagin.New(router, httpapi.NewConfig())

	// Markdown docs: /docs.md
	router.GET("/docs.md", func(ctx *gin.Context) {
		data, err := os.ReadFile("docs/docs.md")
		if err != nil {
			ctx.Status(404)
			return
		}
		ctx.Data(200, "text/markdown; charset=utf-8", data)
	})

	routes.RegisterBaseRoutes(router)
	routes.RegisterAPIRoutes(router, handlers, authMW, api)
	routes.RegisterAdminRoutes(router, adminHandlers, mw.AdminAuth)

	return handlers.Shutdown, nil
}
