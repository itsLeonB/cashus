package httpapi

import (
	"errors"

	"github.com/itsLeonB/go-authkit"
	"github.com/itsLeonB/ungerr"
)

// MapAuthErr translates authkit's sentinel errors (returned directly by
// *authkit.AuthKit methods) into ungerr.AppError, so Huma responds with the
// correct HTTP status (see status_error_test.go for why a returned
// ungerr.AppError alone is enough — no further wrapping needed). Errors that
// are already an AppError (e.g. from service.CaptchaService) should be
// returned as-is and never passed through here.
func MapAuthErr(err error) error {
	if err == nil {
		return nil
	}

	switch {
	case errors.Is(err, authkit.ErrUserNotFound):
		return ungerr.NotFoundError(err.Error())
	case errors.Is(err, authkit.ErrUserExists):
		return ungerr.ConflictError(err.Error())
	case errors.Is(err, authkit.ErrInvalidCredentials),
		errors.Is(err, authkit.ErrNotVerified),
		errors.Is(err, authkit.ErrTokenExpired),
		errors.Is(err, authkit.ErrTokenInvalid),
		errors.Is(err, authkit.ErrSessionNotFound):
		return ungerr.UnauthorizedError(err.Error())
	case errors.Is(err, authkit.ErrTooManyRequests):
		return ungerr.TooManyRequestsError(err.Error())
	case errors.Is(err, authkit.ErrProviderDisabled), errors.Is(err, authkit.ErrNotSupported):
		return ungerr.ForbiddenError(err.Error())
	default:
		return ungerr.Wrap(err, "auth operation failed")
	}
}
