package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler"
	adminHandler "github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/provider"
	adminProvider "github.com/itsLeonB/cashback/internal/provider/admin"
)

// BuildNoopAPI wires up a gin engine + huma.API with every Huma operation
// registered (public, protected, and admin) against zero-value services and
// a no-op auth middleware.
//
// This is the same wiring TestFullRegistrationSmoke exercises to catch
// duplicate-operation-ID/route panics at test time, factored out so it can
// also drive offline OpenAPI-document generation (CASH-18, see
// cmd/openapi): since huma.Register only inspects each Input/Output
// struct's shape (types, tags, embedded SchemaProvider implementations) to
// build the spec, it never touches the underlying service, so zero-value
// provider.Services/admin.Services/admin.Repositories are enough to
// register every route and produce the full, real OpenAPI document -
// without a running server, a database, or any network access.
func BuildNoopAPI() (*gin.Engine, huma.API) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := humagin.New(router, httpapi.NewConfig())

	handlers := handler.ProvideHandlers(&provider.Services{}, nil)
	adminHandlers := adminHandler.ProvideHandlers(&adminProvider.Services{}, &adminProvider.Repositories{}, &provider.Services{})

	noopAuth := func(c *gin.Context) {}

	RegisterAPIRoutes(router, handlers, noopAuth, api)
	RegisterAdminRoutes(router, adminHandlers, noopAuth, api)

	return router, api
}
