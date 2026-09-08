package dto

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type NewGroupExpenseRequest struct {
	CreatorProfileID uuid.UUID               `json:"-"`
	PayerProfileID   uuid.UUID               `json:"payerProfileId"`
	TotalAmount      decimal.Decimal         `json:"totalAmount"`
	Subtotal         decimal.Decimal         `json:"subtotal"`
	Description      string                  `json:"description"`
	Items            []NewExpenseItemRequest `json:"items"`
	OtherFees        []NewOtherFeeRequest    `json:"otherFees"`
}

type GroupExpenseResponse struct {
	BaseDTO
	Currency         string          `json:"currency"`
	TotalAmount      decimal.Decimal `json:"totalAmount"`
	ItemsTotalAmount decimal.Decimal `json:"itemsTotalAmount"`
	FeesTotalAmount  decimal.Decimal `json:"feesTotalAmount"`
	Description      string          `json:"description"`
	Status           string          `json:"status"`
	IsPreviewable    bool            `json:"isPreviewable"`

	// Relationships
	Payer        SimpleProfile                `json:"payer"`
	Creator      SimpleProfile                `json:"creator"`
	Items        []ExpenseItemResponse        `json:"items"`
	OtherFees    []OtherFeeResponse           `json:"otherFees"`
	Participants []ExpenseParticipantResponse `json:"participants"`
	Bill         ExpenseBillResponse          `json:"bill"`
	BillExists   bool                         `json:"billExists"`

	ConfirmationPreview ExpenseConfirmationResponse `json:"confirmationPreview"`
}

type ExpenseParticipantResponse struct {
	ParticipantProfile SimpleProfile   `json:"participantProfile"`
	ProxyProfile       SimpleProfile   `json:"proxyProfile,omitzero"`
	ShareAmount        decimal.Decimal `json:"shareAmount"`
	HasProxy           bool            `json:"hasProxy"`
}

type NewDraftRequest struct {
	UserProfileID uuid.UUID `json:"-"`
	Description   string    `json:"description"`
	Currency      string    `json:"currency"`
}

type ExpenseParticipantsRequest struct {
	ParticipantProfileIDs []uuid.UUID             `json:"participantProfileIds"`
	ProxyByProfileIDs     map[uuid.UUID]uuid.UUID `json:"proxyByProfileIds"`
	PayerProfileID        uuid.UUID               `json:"payerProfileId"`
	UserProfileID         uuid.UUID               `json:"-"`
	GroupExpenseID        uuid.UUID               `json:"-"`
}

type ExpenseConfirmationResponse struct {
	ID           uuid.UUID                     `json:"id"`
	Description  string                        `json:"description"`
	Currency     string                        `json:"currency"`
	TotalAmount  decimal.Decimal               `json:"totalAmount"`
	Payer        SimpleProfile                 `json:"payer"`
	Participants []ConfirmedExpenseParticipant `json:"participants"`
}

type ConfirmedExpenseParticipant struct {
	Profile      SimpleProfile        `json:"profile"`
	ProxyProfile SimpleProfile        `json:"proxyProfile,omitzero"`
	Items        []ConfirmedItemShare `json:"items"`
	ItemsTotal   decimal.Decimal      `json:"itemsTotal"`
	Fees         []ConfirmedItemShare `json:"fees"`
	FeesTotal    decimal.Decimal      `json:"feesTotal"`
	Total        decimal.Decimal      `json:"total"`
	HasProxy     bool                 `json:"hasProxy"`
}

type ConfirmedItemShare struct {
	ID          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	BaseAmount  decimal.Decimal `json:"baseAmount"`
	ShareRate   decimal.Decimal `json:"shareRate"`
	ShareAmount decimal.Decimal `json:"shareAmount"`
}
