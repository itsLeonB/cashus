package dto

import (
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/shopspring/decimal"
)

type FeeParticipantResponse struct {
	Profile     SimpleProfile   `json:"profile"`
	ShareAmount decimal.Decimal `json:"shareAmount"`
}

type FeeCalculationMethodInfo struct {
	Name        string `json:"name"`
	Display     string `json:"display"`
	Description string `json:"description"`
}

type OtherFeeResponse struct {
	BaseDTO
	Name   string          `json:"name"`
	Amount decimal.Decimal `json:"amount"`
	// enum values must be kept in sync with the expenses.FeeCalculationMethod consts
	CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod" enum:"EQUAL_SPLIT,ITEMIZED_SPLIT"`
	Participants      []FeeParticipantResponse      `json:"participants,omitempty"`
}

type NewOtherFeeRequest struct {
	UserProfileID     uuid.UUID                     `json:"-"`
	GroupExpenseID    uuid.UUID                     `json:"-"`
	Name              string                        `json:"name"`
	Amount            decimal.Decimal               `json:"amount"`
	CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod"`
}

type UpdateOtherFeeRequest struct {
	UserProfileID     uuid.UUID                     `json:"-"`
	ID                uuid.UUID                     `json:"-"`
	GroupExpenseID    uuid.UUID                     `json:"-"`
	Name              string                        `json:"name"`
	Amount            decimal.Decimal               `json:"amount"`
	CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod"`
}
