package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
)

// RegisterAdminRoutes wires up the admin auth register/login gin routes
// (which delegate to authgin.StatelessHandler, an external library, and so
// are kept as native gin routes) and the Huma operations for the rest of the
// admin API. Huma is bound at the engine root, so every protected admin
// operation must have the admin auth gin middleware bridged onto it
// individually via httpapi.Bridge.
func RegisterAdminRoutes(router *gin.Engine, handlers *admin.Handlers, authMiddleware gin.HandlerFunc, api huma.API) {
	adminRoutes := router.Group("/admin")
	{
		v1 := adminRoutes.Group("/v1")
		{
			authRoutes := v1.Group("/auth")
			{
				authRoutes.POST("/register", handlers.Auth.HandleRegister())
				authRoutes.POST("/login", handlers.Auth.HandleLogin())
			}
		}
	}

	adminMW := []func(huma.Context, func(huma.Context)){
		httpapi.Bridge(authMiddleware),
	}

	handlers.Auth.RegisterMe(api, adminMW...)

	handlers.Plan.RegisterCreate(api, adminMW...)
	handlers.Plan.RegisterGetList(api, adminMW...)
	handlers.Plan.RegisterGetOne(api, adminMW...)
	handlers.Plan.RegisterUpdate(api, adminMW...)
	handlers.Plan.RegisterDelete(api, adminMW...)

	handlers.PlanVersion.RegisterCreate(api, adminMW...)
	handlers.PlanVersion.RegisterGetList(api, adminMW...)
	handlers.PlanVersion.RegisterGetOne(api, adminMW...)
	handlers.PlanVersion.RegisterUpdate(api, adminMW...)
	handlers.PlanVersion.RegisterDelete(api, adminMW...)

	handlers.Subscription.RegisterCreate(api, adminMW...)
	handlers.Subscription.RegisterGetList(api, adminMW...)
	handlers.Subscription.RegisterGetOne(api, adminMW...)
	handlers.Subscription.RegisterUpdate(api, adminMW...)
	handlers.Subscription.RegisterDelete(api, adminMW...)

	handlers.Payment.RegisterGetList(api, adminMW...)
	handlers.Payment.RegisterGetOne(api, adminMW...)
	handlers.Payment.RegisterUpdate(api, adminMW...)
	handlers.Payment.RegisterDelete(api, adminMW...)

	handlers.Profile.RegisterGetList(api, adminMW...)
	handlers.Profile.RegisterGetOne(api, adminMW...)
}
