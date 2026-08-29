package routes

import (
	"fmt"

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
			v1.POST("/payments/midtrans/notifications", handlers.Payment.HandleNotification())
			v1.GET("/plans", handlers.Plan.HandleGetActive())
			v1.GET("/public/profiles/:slug", handlers.Public.HandleGetPublicProfile())

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

				transferMethodsRoute := "/transfer-methods"
				profileRoutes := protectedRoutes.Group("/profile")
				{
					profileRoutes.GET("", handlers.Profile.HandleProfile())
					profileRoutes.PATCH("", handlers.Profile.HandleUpdate())
					profileRoutes.POST("/associate", handlers.Profile.HandleAssociate())
					profileRoutes.POST(transferMethodsRoute, handlers.ProfileTransferMethod.HandleAdd())
					profileRoutes.GET(transferMethodsRoute, handlers.ProfileTransferMethod.HandleGetAllOwned())
					profileRoutes.GET("/subscription", handlers.Subscription.HandleGetSubscribedDetails())
				}

				profilesRoutes := protectedRoutes.Group("/profiles")
				profilesRoutes.Use(
					middlewares.WithRateKey(appconstant.ContextProfileID.String()),
					sentinelGin.RateLimit(httpserver.RateLimitConfig{
						Limit:   rate.Limit(10.0 / 60),
						Burst:   3,
						KeyFunc: httpserver.KeyFuncByHeader("X-Rate-Key"),
					}),
				)
				{
					profilesRoutes.GET("", handlers.Profile.HandleSearch())
					profilesRoutes.POST(fmt.Sprintf("/:%s/friend-requests", appconstant.ContextProfileID.String()), handlers.FriendshipRequest.HandleSend())
					profilesRoutes.GET(fmt.Sprintf("/:%s%s", appconstant.ContextProfileID.String(), transferMethodsRoute), handlers.ProfileTransferMethod.HandleGetAllByFriendProfileID())
				}

				friendshipRoutes := protectedRoutes.Group("/friendships")
				{
					friendshipRoutes.POST("", handlers.Friendship.HandleCreateAnonymousFriendship())
					friendshipRoutes.GET("", handlers.Friendship.HandleGetAll())
					friendshipRoutes.GET(fmt.Sprintf("/:%s", appconstant.ContextFriendshipID), handlers.Friendship.HandleGetDetails())
				}

				receivedFriendRequestRoute := fmt.Sprintf("/%s/:%s", appconstant.ReceivedFriendRequest, appconstant.ContextFriendRequestID)
				friendRequestRoutes := protectedRoutes.Group("/friend-requests")
				{
					friendRequestRoutes.GET(fmt.Sprintf("/:%s", appconstant.PathFriendRequestType), handlers.FriendshipRequest.HandleGetAll())
					friendRequestRoutes.DELETE(fmt.Sprintf("/%s/:%s", appconstant.SentFriendRequest, appconstant.ContextFriendRequestID), handlers.FriendshipRequest.HandleCancel())
					friendRequestRoutes.DELETE(receivedFriendRequestRoute, handlers.FriendshipRequest.HandleIgnore())
					friendRequestRoutes.PATCH(receivedFriendRequestRoute, handlers.FriendshipRequest.HandleBlock())
					friendRequestRoutes.POST(receivedFriendRequestRoute, handlers.FriendshipRequest.HandleAccept())
				}

				protectedRoutes.GET(transferMethodsRoute, handlers.TransferMethod.HandleGetAll())

				protectedRoutes.POST(fmt.Sprintf("/plans/:%s/versions/:%s/subscriptions", appconstant.ContextPlanID.String(), appconstant.ContextPlanVersionID.String()), handlers.Subscription.HandleCreatePurchase())
				protectedRoutes.POST(fmt.Sprintf("/subscriptions/:%s", appconstant.ContextSubscriptionID.String()), handlers.Payment.HandleMakePayment())
			}
		}
	}
}
