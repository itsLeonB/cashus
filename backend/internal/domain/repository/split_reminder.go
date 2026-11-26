package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/dto"
)

type SplitReminderRepository interface {
	Send(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, dto.SendSplitReminderRequest) (dto.SplitReminderResponse, error)
	List(context.Context, uuid.UUID, uuid.UUID) ([]dto.SplitReminderResponse, error)
	Get(context.Context, uuid.UUID, uuid.UUID) (dto.SplitReminderResponse, error)
}
