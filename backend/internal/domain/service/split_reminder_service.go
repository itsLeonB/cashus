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
func (s *splitReminderServiceImpl) Send(ctx context.Context, actor, friendship, key uuid.UUID, body dto.SendSplitReminderRequest) (dto.SplitReminderResponse, error) {
	body.Description = strings.Join(strings.Fields(body.Description), " ")
	fields := map[string]string{}
	if n := utf8.RuneCountInString(body.Description); n < 1 || n > 200 {
		fields["description"] = "description must contain 1–200 characters"
	}
	if body.MealDate != nil {
		date, err := time.Parse("2006-01-02", *body.MealDate)
		if err != nil || date.Year() < 1 || date.Year() > 9999 {
			fields["mealDate"] = "mealDate must be a calendar date in YYYY-MM-DD format"
		}
	}
	if key == uuid.Nil {
		fields["Idempotency-Key"] = "Idempotency-Key must be a nonzero UUID"
	}
	if len(fields) > 0 {
		return dto.SplitReminderResponse{}, ungerr.ValidationError(fields)
	}
	return s.SplitReminderRepository.Send(ctx, actor, friendship, key, body)
}
