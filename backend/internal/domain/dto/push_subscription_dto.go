package dto

import "github.com/google/uuid"

type PushSubscriptionRequest struct {
	ProfileID uuid.UUID            `json:"-"`
	SessionID uuid.UUID            `json:"-"`
	Endpoint  string               `json:"endpoint"`
	Keys      PushSubscriptionKeys `json:"keys"`
	UserAgent string               `json:"userAgent,omitempty"`
}

type PushSubscriptionKeys struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type PushUnsubscribeRequest struct {
	ProfileID uuid.UUID `json:"-"`
	Endpoint  string    `json:"endpoint"`
}
