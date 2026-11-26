package dto

import (
	"time"

	"github.com/google/uuid"
)

type SendSplitReminderRequest struct {
	Description string  `json:"description"`
	MealDate    *string `json:"mealDate" required:"false"`
}

type SplitReminderResponse struct {
	ID                 uuid.UUID  `json:"id" gorm:"primaryKey;default:uuidv7()"`
	FriendshipID       uuid.UUID  `json:"friendshipId"`
	SenderProfileID    uuid.UUID  `json:"senderProfileId"`
	RecipientProfileID uuid.UUID  `json:"recipientProfileId"`
	Description        string     `json:"description"`
	MealDate           *time.Time `json:"mealDate"`
	Status             string     `json:"status" enum:"OPEN,CANCELLED,DECLINED,COMPLETED,FRIENDSHIP_CLOSED"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
	ClosedAt           *time.Time `json:"closedAt"`
	ExpenseID          *uuid.UUID `json:"expenseId" nullable:"true"`
}
