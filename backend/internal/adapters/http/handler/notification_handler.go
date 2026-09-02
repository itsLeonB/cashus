package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type NotificationHandler struct {
	notificationService service.NotificationService
}

func NewNotificationHandler(notificationService service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notificationService}
}

type GetUnreadNotificationsInput struct {
	httpapi.AuthInput
}

type MarkNotificationAsReadInput struct {
	httpapi.AuthInput
	NotificationID uuid.UUID `path:"notificationID"`
}

type MarkAllNotificationsAsReadInput struct {
	httpapi.AuthInput
}

// Routes returns every route NotificationHandler exposes via
// endpoint.Endpoint/endpoint.NoBodyEndpoint, for registration via
// endpoint.RegisterAll.
func (nh *NotificationHandler) getUnreadNotifications(ctx context.Context, in GetUnreadNotificationsInput) ([]dto.NotificationResponse, error) {
	return nh.notificationService.GetUnread(ctx, in.ProfileID)
}

func (nh *NotificationHandler) markNotificationAsRead(ctx context.Context, in MarkNotificationAsReadInput) error {
	return nh.notificationService.MarkAsRead(ctx, in.ProfileID, in.NotificationID)
}

func (nh *NotificationHandler) markAllNotificationsAsRead(ctx context.Context, in MarkAllNotificationsAsReadInput) error {
	return nh.notificationService.MarkAllAsRead(ctx, in.ProfileID)
}

func (nh *NotificationHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetUnreadNotificationsInput, []dto.NotificationResponse]{
			OperationID: "get-unread-notifications",
			Method:      http.MethodGet,
			Path:        "/api/v1/notifications",
			Summary:     "Get unread notifications",
			Tags:        []string{"notifications"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: nh.getUnreadNotifications,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[MarkNotificationAsReadInput]{
			OperationID: "mark-notification-as-read",
			Method:      http.MethodPatch,
			Path:        "/api/v1/notifications/{notificationID}",
			Summary:     "Mark a notification as read",
			Tags:        []string{"notifications"},
			Secured:     true,
			HandlerFunc: nh.markNotificationAsRead,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[MarkAllNotificationsAsReadInput]{
			OperationID: "mark-all-notifications-as-read",
			Method:      http.MethodPatch,
			Path:        "/api/v1/notifications",
			Summary:     "Mark all notifications as read",
			Tags:        []string{"notifications"},
			Secured:     true,
			HandlerFunc: nh.markAllNotificationsAsRead,
		}),
	}
}
