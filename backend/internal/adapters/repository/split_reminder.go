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
	IdempotencyKey            uuid.UUID
	DuplicateDescription      string
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

func (r *splitReminderRepository) Send(ctx context.Context, actor, friendship, key uuid.UUID, body dto.SendSplitReminderRequest) (dto.SplitReminderResponse, error) {
	var row reminderRow
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize the sender's persistent keys, including keys reused across friendships.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", actor.String()).Error; err != nil {
			return ungerr.Wrap(err, "lock reminder sender")
		}
		f, err := accessibleFriendship(tx, actor, friendship)
		if err != nil {
			return err
		}
		if f.Type != users.Real {
			return ungerr.ConflictError("split reminders require a real friendship")
		}
		err = tx.Where("sender_profile_id = ? AND idempotency_key = ?", actor, key).Take(&row).Error
		if err == nil {
			sameDate := row.MealDate == nil && body.MealDate == nil || row.MealDate != nil && body.MealDate != nil && *row.MealDate == *body.MealDate
			if row.FriendshipID != friendship || row.Description != body.Description || !sameDate {
				return ungerr.ConflictError("idempotency key already used for another meal")
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return ungerr.Wrap(err, "read reminder replay")
		}
		recipient := f.ProfileID1
		if recipient == actor {
			recipient = f.ProfileID2
		}
		row = reminderRow{SplitReminderResponse: dto.SplitReminderResponse{ID: uuid.New(), FriendshipID: friendship, SenderProfileID: actor, RecipientProfileID: recipient, Description: body.Description, MealDate: body.MealDate, Status: "OPEN"}, IdempotencyKey: key, DuplicateDescription: strings.ToLower(body.Description)}
		var count int64
		query := tx.Model(&reminderRow{}).Where("sender_profile_id = ? AND recipient_profile_id = ? AND duplicate_description = ? AND status = 'OPEN'", actor, recipient, row.DuplicateDescription)
		if body.MealDate == nil {
			query = query.Where("meal_date IS NULL")
		} else {
			query = query.Where("meal_date = ?", *body.MealDate)
		}
		if err := query.Count(&count).Error; err != nil {
			return ungerr.Wrap(err, "check duplicate reminder")
		}
		if count > 0 {
			return ungerr.ConflictError("an open reminder already exists for this meal")
		}
		row.CreatedAt = time.Now().UTC().Truncate(time.Microsecond)
		row.UpdatedAt = row.CreatedAt
		if err := tx.Create(&row).Error; err != nil {
			return ungerr.Wrap(err, "create reminder")
		}
		return nil
	})
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
	row.CreatedAt = row.CreatedAt.UTC()
	row.UpdatedAt = row.UpdatedAt.UTC()
	return row.SplitReminderResponse, err
}
