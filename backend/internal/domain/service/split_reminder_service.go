package service

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/repository"
	"github.com/itsLeonB/ungerr"
)

type splitReminderServiceImpl struct {
	repository.SplitReminderRepository
}

func NewSplitReminderService(repo repository.SplitReminderRepository) SplitReminderService {
	return &splitReminderServiceImpl{repo}
}
func (s *splitReminderServiceImpl) Send(ctx context.Context, actor, friendship uuid.UUID, body dto.SendSplitReminderRequest) (dto.SplitReminderResponse, error) {
	body.Description = strings.Join(strings.Fields(body.Description), " ")
	fields := map[string]string{}
	if n := utf8.RuneCountInString(body.Description); n < 1 || n > 200 {
		fields["description"] = "description must contain 1–200 characters"
	}
	if body.MealDate != nil {
		date, err := time.Parse(time.RFC3339Nano, *body.MealDate)
		if err != nil || date.UTC().Year() < 1 || date.UTC().Year() > 9999 {
			fields["mealDate"] = "mealDate must be an RFC3339 timestamp with a timezone"
		}
	}
	if len(fields) > 0 {
		return dto.SplitReminderResponse{}, ungerr.ValidationError(fields)
	}
	return s.SplitReminderRepository.Send(ctx, actor, friendship, body)
}
