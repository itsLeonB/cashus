package httpapi

import "github.com/danielgtaylor/huma/v2"

// CheckPasswordMatch returns a Huma resolver error if password and
// confirmation differ, for use directly from an input's Resolve() method so
// the mismatch participates in Huma's exhaustive field-validation error
// response instead of being a separate early-return. Shared by every auth
// operation that accepts a password/passwordConfirmation pair (register,
// reset-password, admin register) — all of them nest it at
// "body.passwordConfirmation".
func CheckPasswordMatch(password, confirmation string) []error {
	if password != confirmation {
		return []error{&huma.ErrorDetail{
			Location: "body.passwordConfirmation",
			Message:  "must match password",
		}}
	}

	return nil
}
