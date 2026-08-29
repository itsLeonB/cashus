package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
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

type GetUnreadNotificationsOutput struct {
	Body []dto.NotificationResponse
}

// RegisterGetUnread registers GET /api/v1/notifications on the Huma API.
func (nh *NotificationHandler) RegisterGetUnread(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-unread-notifications",
		Method:        http.MethodGet,
		Path:          "/api/v1/notifications",
		Summary:       "Get unread notifications",
		Tags:          []string{"notifications"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetUnreadNotificationsInput) (*GetUnreadNotificationsOutput, error) {
		res, err := nh.notificationService.GetUnread(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetUnreadNotificationsOutput{Body: res}, nil
	})
}

type MarkNotificationAsReadInput struct {
	httpapi.AuthInput
	NotificationID uuid.UUID `path:"notificationID"`
}

type MarkNotificationAsReadOutput struct{}

// RegisterMarkAsRead registers PATCH /api/v1/notifications/{notificationID} on the Huma API.
func (nh *NotificationHandler) RegisterMarkAsRead(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "mark-notification-as-read",
		Method:        http.MethodPatch,
		Path:          "/api/v1/notifications/{notificationID}",
		Summary:       "Mark a notification as read",
		Tags:          []string{"notifications"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *MarkNotificationAsReadInput) (*MarkNotificationAsReadOutput, error) {
		if err := nh.notificationService.MarkAsRead(ctx, in.ProfileID, in.NotificationID); err != nil {
			return nil, err
		}

		return &MarkNotificationAsReadOutput{}, nil
	})
}

type MarkAllNotificationsAsReadInput struct {
	httpapi.AuthInput
}

type MarkAllNotificationsAsReadOutput struct{}

// RegisterMarkAllAsRead registers PATCH /api/v1/notifications on the Huma API.
func (nh *NotificationHandler) RegisterMarkAllAsRead(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "mark-all-notifications-as-read",
		Method:        http.MethodPatch,
		Path:          "/api/v1/notifications",
		Summary:       "Mark all notifications as read",
		Tags:          []string{"notifications"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *MarkAllNotificationsAsReadInput) (*MarkAllNotificationsAsReadOutput, error) {
		if err := nh.notificationService.MarkAllAsRead(ctx, in.ProfileID); err != nil {
			return nil, err
		}

		return &MarkAllNotificationsAsReadOutput{}, nil
	})
}
