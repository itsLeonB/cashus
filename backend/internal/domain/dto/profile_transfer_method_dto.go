package dto

import "github.com/google/uuid"

type NewProfileTransferMethodRequest struct {
	ProfileID        uuid.UUID `json:"-"`
	TransferMethodID uuid.UUID `json:"transferMethodId"`
	AccountName      string    `json:"accountName"`
	AccountNumber    string    `json:"accountNumber"`
}

type ProfileTransferMethodResponse struct {
	BaseDTO
	Method        TransferMethodResponse `json:"method"`
	AccountName   string                 `json:"accountName"`
	AccountNumber string                 `json:"accountNumber"`
}
