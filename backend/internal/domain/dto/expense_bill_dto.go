package dto

import (
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
)

type NewExpenseBillRequest struct {
	ImageData      []byte
	ProfileID      uuid.UUID
	GroupExpenseID uuid.UUID
	ContentType    string
	Filename       string
	FileSize       int64
}

type ExpenseBillResponse struct {
	BaseDTO
	ImageURL string `json:"imageUrl"`
	// enum values must be kept in sync with the expenses.BillStatus consts
	Status expenses.BillStatus `json:"status" enum:"NOT_UPLOADED,PENDING,EXTRACTED,FAILED_EXTRACTING,PARSED,FAILED_PARSING,NOT_DETECTED"`
}

type PresignedExpenseBillRequest struct {
	ProfileID      uuid.UUID `json:"-"`
	GroupExpenseID uuid.UUID `json:"-"`
	Filename       string    `json:"fileName"`
}

type PresignedExpenseBillResponse struct {
	BillID    uuid.UUID `json:"billId"`
	UploadURL string    `json:"uploadUrl"`
}
