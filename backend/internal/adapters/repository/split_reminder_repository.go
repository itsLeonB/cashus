package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/users"
	"github.com/itsLeonB/ungerr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type splitReminderRepository struct{ db *gorm.DB }

func NewSplitReminderRepository(db *gorm.DB) *splitReminderRepository {
	return &splitReminderRepository{db}
}

type reminderRow struct {
	dto.SplitReminderResponse `gorm:"embedded"`
}

func (reminderRow) TableName() string { return "split_reminders" }

func accessibleFriendship(db *gorm.DB, actor, id uuid.UUID) (users.Friendship, error) {
	var f users.Friendship
	err := db.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND (profile_id1 = ? OR profile_id2 = ?)", id, actor, actor).First(&f).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return f, ungerr.NotFoundError("friendship not found")
	}
	if err != nil {
		return f, ungerr.Wrap(err, "read friendship")
	}
	return f, nil
}

func (r *splitReminderRepository) Send(ctx context.Context, actor, friendship uuid.UUID, body dto.SendSplitReminderRequest) (dto.SplitReminderResponse, error) {
	var row reminderRow
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		f, err := accessibleFriendship(tx, actor, friendship)
		if err != nil {
			return err
		}
		if f.Type != users.Real {
			return ungerr.ConflictError("split reminders require a real friendship")
		}
		recipient := f.ProfileID1
		if recipient == actor {
			recipient = f.ProfileID2
		}
		var mealDate *time.Time
		if body.MealDate != nil {
			parsed, err := time.Parse(time.RFC3339Nano, *body.MealDate)
			if err != nil {
				return ungerr.Wrap(err, "parse meal timestamp")
			}
			normalized := parsed.UTC().Truncate(time.Microsecond)
			mealDate = &normalized
		}
		query := tx.Where("sender_profile_id = ? AND recipient_profile_id = ? AND status = 'OPEN'", actor, recipient)
		if mealDate == nil {
			query = query.Where("meal_date IS NULL")
		} else {
			query = query.Where("meal_date = ?", *mealDate)
		}
		var candidates []reminderRow
		if err := query.Find(&candidates).Error; err != nil {
			return ungerr.Wrap(err, "check duplicate reminder")
		}
		description := strings.ToLower(body.Description)
		for _, candidate := range candidates {
			if strings.ToLower(candidate.Description) == description {
				return ungerr.ConflictError("an open reminder already exists for this meal")
			}
		}
		row = reminderRow{SplitReminderResponse: dto.SplitReminderResponse{FriendshipID: friendship, SenderProfileID: actor, RecipientProfileID: recipient, Description: body.Description, MealDate: mealDate, Status: "OPEN"}}
		row.CreatedAt = time.Now().UTC().Truncate(time.Microsecond)
		row.UpdatedAt = row.CreatedAt
		if err := tx.Create(&row).Error; err != nil {
			return ungerr.Wrap(err, "create reminder")
		}
		return nil
	})
	if row.MealDate != nil {
		utc := row.MealDate.UTC()
		row.MealDate = &utc
	}
	row.CreatedAt = row.CreatedAt.UTC()
	row.UpdatedAt = row.UpdatedAt.UTC()
	return row.SplitReminderResponse, err
}

func (r *splitReminderRepository) List(ctx context.Context, actor, friendship uuid.UUID) ([]dto.SplitReminderResponse, error) {
	result := []dto.SplitReminderResponse{}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := accessibleFriendship(tx, actor, friendship); err != nil {
			return err
		}
		var rows []reminderRow
		if err := tx.Where("friendship_id = ? AND status = 'OPEN' AND (sender_profile_id = ? OR recipient_profile_id = ?)", friendship, actor, actor).Order("created_at DESC, id DESC").Find(&rows).Error; err != nil {
			return ungerr.Wrap(err, "list reminders")
		}
		for _, row := range rows {
			if row.MealDate != nil {
				utc := row.MealDate.UTC()
				row.MealDate = &utc
			}
			row.CreatedAt = row.CreatedAt.UTC()
			row.UpdatedAt = row.UpdatedAt.UTC()
			result = append(result, row.SplitReminderResponse)
		}
		return nil
	})
	return result, err
}
func (r *splitReminderRepository) Get(ctx context.Context, actor, id uuid.UUID) (dto.SplitReminderResponse, error) {
	var row reminderRow
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Where("id = ? AND (sender_profile_id = ? OR recipient_profile_id = ?)", id, actor, actor).Take(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ungerr.NotFoundError("reminder not found")
		}
		if err != nil {
			return ungerr.Wrap(err, "read reminder")
		}
		_, err = accessibleFriendship(tx, actor, row.FriendshipID)
		return err
	})
	if row.MealDate != nil {
		utc := row.MealDate.UTC()
		row.MealDate = &utc
	}
	row.CreatedAt = row.CreatedAt.UTC()
	row.UpdatedAt = row.UpdatedAt.UTC()
	return row.SplitReminderResponse, err
}
