package handler

import (
	"context"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type SplitReminderHandler struct {
	Repository service.SplitReminderService
}
type SendSplitReminderInput struct {
	httpapi.AuthInput
	FriendshipID   uuid.UUID `path:"friendshipID"`
	IdempotencyKey uuid.UUID `header:"Idempotency-Key" required:"true"`
	Body           dto.SendSplitReminderRequest
}
type ListSplitRemindersInput struct {
	httpapi.AuthInput
	FriendshipID uuid.UUID `path:"friendshipID"`
}
type GetSplitReminderInput struct {
	httpapi.AuthInput
	ReminderID uuid.UUID `path:"reminderID"`
}

func (h *SplitReminderHandler) sendSplitReminder(ctx context.Context, in SendSplitReminderInput) (dto.SplitReminderResponse, error) {
	return h.Repository.Send(ctx, in.ProfileID, in.FriendshipID, in.IdempotencyKey, in.Body)
}
func (h *SplitReminderHandler) listSplitReminders(ctx context.Context, in ListSplitRemindersInput) ([]dto.SplitReminderResponse, error) {
	return h.Repository.List(ctx, in.ProfileID, in.FriendshipID)
}
func (h *SplitReminderHandler) getSplitReminder(ctx context.Context, in GetSplitReminderInput) (dto.SplitReminderResponse, error) {
	return h.Repository.Get(ctx, in.ProfileID, in.ReminderID)
}
func (h *SplitReminderHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[SendSplitReminderInput, dto.SplitReminderResponse]{OperationID: "send-split-reminder", Method: "POST", Path: "/api/v1/friendships/{friendshipID}/split-reminders", Summary: "Send a split reminder", Tags: []string{"split-reminders"}, SuccessCode: 201, Secured: true, HandlerFunc: h.sendSplitReminder}),
		endpoint.New(endpoint.Endpoint[ListSplitRemindersInput, []dto.SplitReminderResponse]{OperationID: "list-split-reminders", Method: "GET", Path: "/api/v1/friendships/{friendshipID}/split-reminders", Summary: "List open split reminders", Tags: []string{"split-reminders"}, SuccessCode: 200, Secured: true, HandlerFunc: h.listSplitReminders}),
		endpoint.New(endpoint.Endpoint[GetSplitReminderInput, dto.SplitReminderResponse]{OperationID: "get-split-reminder", Method: "GET", Path: "/api/v1/split-reminders/{reminderID}", Summary: "Get a split reminder", Tags: []string{"split-reminders"}, SuccessCode: 200, Secured: true, HandlerFunc: h.getSplitReminder}),
	}
}
