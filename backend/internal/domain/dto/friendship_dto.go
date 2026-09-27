package dto

import (
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/domain/entity/users"
	"github.com/shopspring/decimal"
)

type NewAnonymousFriendshipRequest struct {
	ProfileID uuid.UUID `json:"-"`
	Name      string    `json:"name"`
}

type FriendshipResponse struct {
	BaseDTO
	Type                users.FriendshipType       `json:"type" enum:"REAL,ANON"`
	ProfileID           uuid.UUID                  `json:"profileId"`
	ProfileName         string                     `json:"profileName"`
	ProfileAvatar       string                     `json:"profileAvatar"`
	BalancesPerCurrency map[string]decimal.Decimal `json:"balancesPerCurrency,omitempty"`
}

type FriendshipWithProfile struct {
	Friendship    FriendshipResponse
	UserProfile   ProfileResponse
	FriendProfile ProfileResponse
}

type FriendDetails struct {
	BaseDTO
	ProfileID  uuid.UUID            `json:"profileId"`
	Name       string               `json:"name"`
	Type       users.FriendshipType `json:"type" enum:"REAL,ANON"`
	Email      string               `json:"email,omitempty"`
	Phone      string               `json:"phone,omitempty"`
	Avatar     string               `json:"avatar,omitempty"`
	Slug       string               `json:"slug,omitempty"`
	ProfileID1 uuid.UUID            `json:"profileId1"`
	ProfileID2 uuid.UUID            `json:"profileId2"`
}

type FriendBalance struct {
	NetBalance              decimal.Decimal         `json:"netBalance"`
	TotalLentToFriend       decimal.Decimal         `json:"totalLentToFriend"`
	TotalBorrowedFromFriend decimal.Decimal         `json:"totalBorrowedFromFriend"`
	TransactionHistory      []FriendTransactionItem `json:"transactionHistory"`
}

type FriendTransactionItem struct {
	BaseDTO
	Type           DebtTransactionType `json:"type" enum:"LENT,BORROWED"`
	Amount         decimal.Decimal     `json:"amount"`
	TransferMethod string              `json:"transferMethod"`
	Description    string              `json:"description"`
	// TransactionDate is the effective (possibly backdated) transaction date,
	// formatted "YYYY-MM-DD". Independent of BaseDTO.CreatedAt.
	TransactionDate string `json:"transactionDate"`
	// IsRepayment mirrors DebtTransaction.IsRepayment, same as
	// DebtTransactionResponse.IsRepayment.
	IsRepayment bool `json:"isRepayment"`
}

type FriendDetailsResponse struct {
	Friend              FriendDetails            `json:"friend"`
	BalancesPerCurrency map[string]FriendBalance `json:"balancesPerCurrency"`
}
