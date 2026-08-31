package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/kroma-labs/sentinel-go/httpserver"
	sentinelGin "github.com/kroma-labs/sentinel-go/httpserver/adapters/gin"
	"golang.org/x/time/rate"
)

// RegisterAdminRoutes wires up every admin operation on the Huma API. Huma
// is bound at the engine root, so every protected admin operation must have
// the admin auth gin middleware bridged onto it individually via
// httpapi.Bridge.
func RegisterAdminRoutes(router *gin.Engine, handlers *admin.Handlers, authMiddleware gin.HandlerFunc, api huma.API) {
	adminMW := []func(huma.Context, func(huma.Context)){
		httpapi.Bridge(authMiddleware),
	}

	// Register is intentionally left unauthenticated and unrestricted here:
	// it's the one-time admin-bootstrap endpoint, self-limiting via the
	// authkit BeforeRegister hook (see internal/provider/admin) which
	// forbids registration once any admin user exists. Login stays
	// unauthenticated too (there's no session yet to bridge), but gets a
	// per-IP rate limit to slow down credential-stuffing/brute-force
	// attempts, mirroring the /api/v1/auth login rate limit.
	loginMW := []func(huma.Context, func(huma.Context)){
		httpapi.Bridge(sentinelGin.RateLimit(httpserver.RateLimitConfig{
			Limit:   rate.Limit(20.0 / 60),
			Burst:   5,
			KeyFunc: httpserver.KeyFuncByIP(),
		})),
	}

	handlers.Auth.RegisterRegister(api)
	handlers.Auth.RegisterLogin(api, loginMW...)
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
