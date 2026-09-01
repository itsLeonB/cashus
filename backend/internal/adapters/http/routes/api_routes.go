package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/adapters/http/middlewares"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/itsLeonB/go-authkit/authgin"
	"github.com/kroma-labs/sentinel-go/httpserver"
	sentinelGin "github.com/kroma-labs/sentinel-go/httpserver/adapters/gin"
	"golang.org/x/time/rate"
)

// RegisterAPIRoutes wires up every /api/v1 operation on the Huma API. Huma
// is bound at the engine root, so operations that need the same auth+CSRF
// protection as `protectedMW` below must have those gin middlewares bridged
// onto them individually via httpapi.Bridge.
func RegisterAPIRoutes(router *gin.Engine, handlers *handler.Handlers, authMiddleware gin.HandlerFunc, api huma.API) {
	protectedMW := []func(huma.Context, func(huma.Context)){
		httpapi.Bridge(authMiddleware),
		httpapi.Bridge(authgin.CSRFMiddleware()),
	}

	profilesMW := append(append([]func(huma.Context, func(huma.Context)){}, protectedMW...),
		httpapi.Bridge(middlewares.WithRateKey(appconstant.ContextProfileID.String())),
		httpapi.Bridge(sentinelGin.RateLimit(httpserver.RateLimitConfig{
			Limit:   rate.Limit(10.0 / 60),
			Burst:   3,
			KeyFunc: httpserver.KeyFuncByHeader("X-Rate-Key"),
		})),
	)

	endpoint.RegisterAll(api, handlers.Public.Routes())
	endpoint.RegisterAll(api, handlers.Plan.Routes())
	handlers.Payment.RegisterNotification(api)

	endpoint.RegisterAll(api, handlers.Payment.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.Profile.Routes(), protectedMW...)
	endpoint.RegisterAll(api, handlers.Profile.SearchRoutes(), profilesMW...)

	endpoint.RegisterAll(api, handlers.ProfileTransferMethod.Routes(), protectedMW...)
	endpoint.RegisterAll(api, handlers.ProfileTransferMethod.GetAllByFriendProfileIDRoutes(), profilesMW...)

	endpoint.RegisterAll(api, handlers.Subscription.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.Friendship.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.FriendshipRequest.SendRoutes(), profilesMW...)
	endpoint.RegisterAll(api, handlers.FriendshipRequest.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.TransferMethod.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.Debt.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.GroupExpense.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.ExpenseItem.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.OtherFee.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.ExpenseBill.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.Notification.Routes(), protectedMW...)

	endpoint.RegisterAll(api, handlers.PushSubscription.Routes(), protectedMW...)

	// authRateMW mirrors the rate limit the whole /api/v1/auth group used to
	// share as a gin route-group middleware (20/60 per IP): the
	// sentinelGin.RateLimit middleware (and its bucket store) is constructed
	// once here and bridged once, then reused unchanged across every op
	// below so they keep sharing one limiter, not one each.
	authRateMW := []func(huma.Context, func(huma.Context)){
		httpapi.Bridge(sentinelGin.RateLimit(httpserver.RateLimitConfig{
			Limit:   rate.Limit(20.0 / 60),
			Burst:   5,
			KeyFunc: httpserver.KeyFuncByIP(),
		})),
	}
	passwordResetMW := withRateLimit(authRateMW, sentinelGin.RateLimit(httpserver.RateLimitConfig{
		Limit:   rate.Limit(3.0 / 900),
		Burst:   3,
		KeyFunc: httpserver.KeyFuncByIP(),
	}))
	resetPasswordMW := withRateLimit(authRateMW, sentinelGin.RateLimit(httpserver.RateLimitConfig{
		Limit:   rate.Limit(5.0 / 900),
		Burst:   5,
		KeyFunc: httpserver.KeyFuncByIP(),
	}))

	// Register, Login, OAuthLogin, OAuthCallback, VerifyRegistration, and
	// RefreshToken share only the group-wide rate limit.
	endpoint.RegisterAll(api, handlers.Auth.Routes(), authRateMW...)

	// SendPasswordReset and ResetPassword each need an extra, tighter rate
	// limit layered on top of authRateMW, so they're registered separately
	// from the rest of Routes() with their own middleware slice.
	endpoint.RegisterAll(api, handlers.Auth.PasswordResetRoutes(), passwordResetMW...)
	endpoint.RegisterAll(api, handlers.Auth.ResetPasswordRoutes(), resetPasswordMW...)

	// Logout is not under the rate-limited /auth group above (it never was,
	// even before this migration); it's protected the same way as every
	// other protected route.
	endpoint.RegisterAll(api, handlers.Auth.LogoutRoutes(), protectedMW...)
}

// withRateLimit appends an extra bridged gin middleware onto a copy of base,
// without mutating base or its backing array.
func withRateLimit(base []func(huma.Context, func(huma.Context)), extra gin.HandlerFunc) []func(huma.Context, func(huma.Context)) {
	return append(append([]func(huma.Context, func(huma.Context)){}, base...), httpapi.Bridge(extra))
}
