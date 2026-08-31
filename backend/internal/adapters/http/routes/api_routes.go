package routes

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/adapters/http/middlewares"
	"github.com/itsLeonB/cashback/internal/appconstant"
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

	handlers.Public.RegisterGetPublicProfile(api)
	handlers.Plan.RegisterGetActive(api)
	handlers.Payment.RegisterNotification(api)

	handlers.Payment.RegisterMakePayment(api, protectedMW...)

	handlers.Profile.RegisterProfile(api, protectedMW...)
	handlers.Profile.RegisterUpdate(api, protectedMW...)
	handlers.Profile.RegisterAssociate(api, protectedMW...)
	handlers.Profile.RegisterSearch(api, profilesMW...)

	handlers.ProfileTransferMethod.RegisterAdd(api, protectedMW...)
	handlers.ProfileTransferMethod.RegisterGetAllOwned(api, protectedMW...)
	handlers.ProfileTransferMethod.RegisterGetAllByFriendProfileID(api, profilesMW...)

	handlers.Subscription.RegisterGetSubscribedDetails(api, protectedMW...)
	handlers.Subscription.RegisterCreatePurchase(api, protectedMW...)

	handlers.Friendship.RegisterCreateAnonymousFriendship(api, protectedMW...)
	handlers.Friendship.RegisterGetAll(api, protectedMW...)
	handlers.Friendship.RegisterGetDetails(api, protectedMW...)

	handlers.FriendshipRequest.RegisterSend(api, profilesMW...)
	handlers.FriendshipRequest.RegisterGetAll(api, protectedMW...)
	handlers.FriendshipRequest.RegisterCancel(api, protectedMW...)
	handlers.FriendshipRequest.RegisterIgnore(api, protectedMW...)
	handlers.FriendshipRequest.RegisterBlock(api, protectedMW...)
	handlers.FriendshipRequest.RegisterAccept(api, protectedMW...)

	handlers.TransferMethod.RegisterGetAll(api, protectedMW...)

	handlers.Debt.RegisterCreate(api, protectedMW...)
	handlers.Debt.RegisterGetAll(api, protectedMW...)
	handlers.Debt.RegisterGetTransactionSummary(api, protectedMW...)
	handlers.Debt.RegisterGetRecent(api, protectedMW...)

	handlers.GroupExpense.RegisterCreateDraft(api, protectedMW...)
	handlers.GroupExpense.RegisterGetAll(api, protectedMW...)
	handlers.GroupExpense.RegisterGetDetails(api, protectedMW...)
	handlers.GroupExpense.RegisterConfirmDraft(api, protectedMW...)
	handlers.GroupExpense.RegisterDelete(api, protectedMW...)
	handlers.GroupExpense.RegisterSyncParticipants(api, protectedMW...)
	handlers.GroupExpense.RegisterGetRecent(api, protectedMW...)

	handlers.ExpenseItem.RegisterAdd(api, protectedMW...)
	handlers.ExpenseItem.RegisterUpdate(api, protectedMW...)
	handlers.ExpenseItem.RegisterRemove(api, protectedMW...)
	handlers.ExpenseItem.RegisterSyncParticipants(api, protectedMW...)

	handlers.OtherFee.RegisterAdd(api, protectedMW...)
	handlers.OtherFee.RegisterUpdate(api, protectedMW...)
	handlers.OtherFee.RegisterRemove(api, protectedMW...)
	handlers.OtherFee.RegisterGetFeeCalculationMethods(api, protectedMW...)

	handlers.ExpenseBill.RegisterPresignedSave(api, protectedMW...)
	handlers.ExpenseBill.RegisterTriggerParsing(api, protectedMW...)

	handlers.Notification.RegisterGetUnread(api, protectedMW...)
	handlers.Notification.RegisterMarkAsRead(api, protectedMW...)
	handlers.Notification.RegisterMarkAllAsRead(api, protectedMW...)

	handlers.PushSubscription.RegisterSubscribe(api, protectedMW...)
	handlers.PushSubscription.RegisterUnsubscribe(api, protectedMW...)

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

	handlers.Auth.RegisterRegister(api, authRateMW...)
	handlers.Auth.RegisterLogin(api, authRateMW...)
	handlers.Auth.RegisterOAuthLogin(api, authRateMW...)
	handlers.Auth.RegisterOAuthCallback(api, authRateMW...)
	handlers.Auth.RegisterVerifyRegistration(api, authRateMW...)
	handlers.Auth.RegisterSendPasswordReset(api, passwordResetMW...)
	handlers.Auth.RegisterResetPassword(api, resetPasswordMW...)
	handlers.Auth.RegisterRefreshToken(api, authRateMW...)

	// Logout is not under the rate-limited /auth group above (it never was,
	// even before this migration); it's protected the same way as every
	// other protected route.
	handlers.Auth.RegisterLogout(api, protectedMW...)
}

// withRateLimit appends an extra bridged gin middleware onto a copy of base,
// without mutating base or its backing array.
func withRateLimit(base []func(huma.Context, func(huma.Context)), extra gin.HandlerFunc) []func(huma.Context, func(huma.Context)) {
	return append(append([]func(huma.Context, func(huma.Context)){}, base...), httpapi.Bridge(extra))
}
