package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/gin-gonic/gin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/stretchr/testify/assert"
)

// TestRegisterAuthInput_PasswordMismatch_ResolverError proves the
// password/passwordConfirmation check moved into RegisterAuthInput.Resolve
// still produces a 400-level, resolver-path error mentioning the mismatch
// (not a panic or an opaque 500) when the two fields differ, and that the
// handler never runs.
func TestRegisterAuthInput_PasswordMismatch_ResolverError(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	handlerCalled := false
	huma.Register(api, huma.Operation{
		OperationID: "test-register-mismatch",
		Method:      http.MethodPost,
		Path:        "/test/register",
	}, func(_ context.Context, in *RegisterAuthInput) (*struct{}, error) {
		handlerCalled = true
		return &struct{}{}, nil
	})

	resp := api.Post("/test/register", map[string]string{
		"email":                "foo@example.com",
		"password":             "secret123",
		"passwordConfirmation": "different",
	})

	assert.Equal(t, http.StatusUnprocessableEntity, resp.Code)
	assert.False(t, handlerCalled, "handler must not run when the resolver already produced an error")
	assert.Contains(t, resp.Body.String(), "passwordConfirmation")
}

// TestResetPasswordInput_Resolve_KeepsGinPopulated proves that, despite
// ResetPasswordInput.Resolve being defined directly on the struct (which
// shadows the embedded GinContextInput.Resolve for Huma's resolver-dispatch
// purposes — findResolvers/_findInType in huma.go stops recursing into
// anonymous fields once the outer type itself already satisfies
// huma.Resolver), in.Gin is still populated: ResetPasswordInput.Resolve
// explicitly calls GinContextInput.Resolve itself. Verified against a real
// gin.Engine + humagin adapter (the same one production wiring uses) rather
// than humatest's humaflow adapter, since humagin.Unwrap panics on a
// non-gin huma.Context.
func TestResetPasswordInput_Resolve_KeepsGinPopulated(t *testing.T) {
	router := gin.New()
	api := humagin.New(router, httpapi.NewConfig())

	var gotGin, gotWriter bool

	huma.Register(api, huma.Operation{
		OperationID:   "test-reset-password",
		Method:        http.MethodPatch,
		Path:          "/test/reset-password",
		DefaultStatus: http.StatusOK,
	}, func(_ context.Context, in *ResetPasswordInput) (*struct{}, error) {
		gotGin = in.Gin != nil
		gotWriter = gotGin && in.Gin.Writer != nil
		if gotWriter {
			// Prove the cookie-writing path this test exists to protect: a
			// Set-Cookie header can actually be written through in.Gin.
			in.Gin.SetCookie("test", "ok", 3600, "/", "", false, true)
		}
		return &struct{}{}, nil
	})

	body := `{"token":"abc","password":"secret123","passwordConfirmation":"secret123"}`
	req := httptest.NewRequest(http.MethodPatch, "/test/reset-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, gotGin, "expected in.Gin to be populated by the embedded GinContextInput.Resolve call")
	assert.True(t, gotWriter, "expected in.Gin.Writer to be populated")
	assert.Contains(t, rec.Header().Get("Set-Cookie"), "test=ok", "expected cookie-writing through in.Gin to still work")
}

// TestResetPasswordInput_PasswordMismatch_Returns400NotPanic proves a
// mismatched password/passwordConfirmation on reset-password is caught by
// the resolver (400-level response) instead of falling through to the
// handler body and potentially panicking on a nil in.Gin, or any other 500.
func TestResetPasswordInput_PasswordMismatch_Returns400NotPanic(t *testing.T) {
	router := gin.New()
	api := humagin.New(router, httpapi.NewConfig())

	handlerCalled := false

	huma.Register(api, huma.Operation{
		OperationID:   "test-reset-password-mismatch",
		Method:        http.MethodPatch,
		Path:          "/test/reset-password-mismatch",
		DefaultStatus: http.StatusOK,
	}, func(_ context.Context, in *ResetPasswordInput) (*struct{}, error) {
		handlerCalled = true
		return &struct{}{}, nil
	})

	body := `{"token":"abc","password":"secret123","passwordConfirmation":"different"}`
	req := httptest.NewRequest(http.MethodPatch, "/test/reset-password-mismatch", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	assert.NotPanics(t, func() {
		router.ServeHTTP(rec, req)
	})

	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.False(t, handlerCalled, "handler must not run when the resolver already produced an error")
	assert.Contains(t, rec.Body.String(), "passwordConfirmation")
}
