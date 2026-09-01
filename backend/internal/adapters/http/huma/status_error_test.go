package httpapi_test

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

// TestUngerrSatisfiesHumaStatusError proves the exact assumption Huma's
// handler dispatch relies on (huma.go: `errors.As(err, &se)` where se is
// huma.StatusError): every ungerr.AppError constructor already returns a
// concrete type with a GetStatus() method, so it satisfies huma.StatusError
// without any adapter/wrapper in this codebase. If this ever regresses (e.g.
// an ungerr upgrade drops GetStatus()), this test fails first.
func TestUngerrSatisfiesHumaStatusError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{"NotFoundError", ungerr.NotFoundError("thing not found"), http.StatusNotFound},
		{"ConflictError", ungerr.ConflictError("already exists"), http.StatusConflict},
		{"UnauthorizedError", ungerr.UnauthorizedError("nope"), http.StatusUnauthorized},
		{"ForbiddenError", ungerr.ForbiddenError("nope"), http.StatusForbidden},
		{"TooManyRequestsError", ungerr.TooManyRequestsError("slow down"), http.StatusTooManyRequests},
		{"UnknownError", ungerr.Unknown("boom"), http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var se huma.StatusError
			ok := errors.As(tt.err, &se)
			assert.True(t, ok, "expected %T to satisfy huma.StatusError", tt.err)
			if ok {
				assert.Equal(t, tt.wantStatus, se.GetStatus())
			}
		})
	}
}

// TestUngerrErrorProducesRealHTTPStatus is an end-to-end check: a Huma
// handler that returns an ungerr.AppError must produce that error's real
// HTTP status on the wire, not a generic 500, with no huma.NewError override
// or wrapper needed anywhere in this codebase.
func TestUngerrErrorProducesRealHTTPStatus(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	huma.Register(api, huma.Operation{
		OperationID: "test-not-found",
		Method:      http.MethodGet,
		Path:        "/test/not-found",
	}, func(ctx context.Context, in *struct{}) (*struct{}, error) {
		return nil, ungerr.NotFoundError("thing not found")
	})

	resp := api.Get("/test/not-found")
	assert.Equal(t, http.StatusNotFound, resp.Code)
}
