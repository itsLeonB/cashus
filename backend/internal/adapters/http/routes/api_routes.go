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

// RegisterAPIRoutes wires up both the remaining ginkgo/gin routes and the
// (currently canary-only) Huma operations. Huma is bound at the engine root,
// so operations that need the same auth+CSRF protection as
// `protectedRoutes` below must have those gin middlewares bridged onto them
// individually via httpapi.Bridge.
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

	apiRoutes := router.Group("/api")
	{
		v1 := apiRoutes.Group("/v1")
		{
			authRoutes := v1.Group("/auth")
			authRoutes.Use(sentinelGin.RateLimit(httpserver.RateLimitConfig{
				Limit:   rate.Limit(20.0 / 60),
				Burst:   5,
				KeyFunc: httpserver.KeyFuncByIP(),
			}))
			{
				authRoutes.POST("/register", handlers.Auth.Register())
				authRoutes.POST("/login", handlers.Auth.Login())
				authRoutes.PUT("/refresh", handlers.Auth.RefreshToken())
				authRoutes.GET("/:provider", handlers.Auth.OAuthLogin())
				authRoutes.GET("/:provider/callback", handlers.Auth.OAuthCallback())
				authRoutes.GET("/verify-registration", handlers.Auth.VerifyRegistration())
				authRoutes.POST("/password-reset",
					sentinelGin.RateLimit(httpserver.RateLimitConfig{
						Limit:   rate.Limit(3.0 / 900),
						Burst:   3,
						KeyFunc: httpserver.KeyFuncByIP(),
					}),
					handlers.Auth.SendPasswordReset(),
				)
				authRoutes.PATCH("/reset-password",
					sentinelGin.RateLimit(httpserver.RateLimitConfig{
						Limit:   rate.Limit(5.0 / 900),
						Burst:   5,
						KeyFunc: httpserver.KeyFuncByIP(),
					}),
					handlers.Auth.ResetPassword(),
				)
			}

			protectedRoutes := v1.Group("/", authMiddleware, authgin.CSRFMiddleware())
			{
				protectedRoutes.DELETE("/auth/logout", handlers.Auth.Logout())
			}
		}
	}
}
