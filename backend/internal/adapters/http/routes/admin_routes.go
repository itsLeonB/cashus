package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

	endpoint.RegisterAll(api, handlers.Auth.RegisterRoutes())
	endpoint.RegisterAll(api, handlers.Auth.LoginRoutes(), loginMW...)
	endpoint.RegisterAll(api, handlers.Auth.Routes(), adminMW...)

	endpoint.RegisterAll(api, handlers.Plan.Routes(), adminMW...)

	endpoint.RegisterAll(api, handlers.PlanVersion.Routes(), adminMW...)

	endpoint.RegisterAll(api, handlers.Subscription.Routes(), adminMW...)

	endpoint.RegisterAll(api, handlers.Payment.Routes(), adminMW...)

	endpoint.RegisterAll(api, handlers.Profile.Routes(), adminMW...)
}
