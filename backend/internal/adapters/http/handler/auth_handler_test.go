package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/gin-gonic/gin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/adapters/http/middlewares"
	"github.com/itsLeonB/cashback/internal/mocks"
	"github.com/itsLeonB/go-authkit/authgin"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/time/rate"
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

// The tests below cover logic that used to live inline in the RegisterXxx
// huma.Register closures and is now in the private sendPasswordReset /
// refreshToken methods. ah.kit is left nil throughout: these tests only
// exercise branches that return before ever touching it (a nil *AuthKit
// method call would panic), which is also why there's no test here for the
// success path of either method — that would require a live *authkit.AuthKit,
// same limitation the pre-existing tests in this file already work around.

// TestSendPasswordReset_RateLimited_ReturnsMappedTooManyRequests proves the
// rate-limit guard now inside sendPasswordReset still short-circuits before
// the captcha check or the (nil) kit call, and still maps to a 429 via
// httpapi.MapAuthErr(authkit.ErrTooManyRequests).
func TestSendPasswordReset_RateLimited_ReturnsMappedTooManyRequests(t *testing.T) {
	limiter := middlewares.NewValueLimiter(rate.Limit(0), 0, time.Hour)
	defer limiter.Stop()

	captcha := mocks.NewMockCaptchaService(t) // no .On(...): must not be called
	ah := &AuthHandler{captcha: captcha, limiter: limiter}

	var in SendPasswordResetInput
	in.Body.Email = "someone@example.com"

	assert.NotPanics(t, func() {
		_, err := ah.sendPasswordReset(context.Background(), in)

		var appErr ungerr.AppError
		assert.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusTooManyRequests, appErr.HttpStatus())
	})
}

// TestSendPasswordReset_CaptchaFails_ReturnsCaptchaErrorAsIs proves a captcha
// verification failure is returned unwrapped (not passed through
// httpapi.MapAuthErr, per the comment on MapAuthErr about errors that are
// already an AppError).
func TestSendPasswordReset_CaptchaFails_ReturnsCaptchaErrorAsIs(t *testing.T) {
	captchaErr := ungerr.BadRequestError("invalid captcha token")

	captcha := mocks.NewMockCaptchaService(t)
	captcha.On("Verify", mock.Anything, "bad-token").Return(captchaErr)

	ah := &AuthHandler{captcha: captcha} // no limiter: rate-limit check is skipped

	var in SendPasswordResetInput
	in.Body.Email = "someone@example.com"
	in.Body.CaptchaToken = "bad-token"

	_, err := ah.sendPasswordReset(context.Background(), in)

	assert.ErrorIs(t, err, captchaErr)
}

// TestRefreshToken_MissingCookie_ReturnsUnauthorizedError proves the manual
// ungerr.UnauthorizedError(...) construction for a failed
// transport.ReadRefreshToken now lives inside refreshToken and still fires
// before the (nil) kit is ever called.
func TestRefreshToken_MissingCookie_ReturnsUnauthorizedError(t *testing.T) {
	transport, err := authgin.NewCookieTransport(authgin.CookieConfig{})
	assert.NoError(t, err)

	ah := &AuthHandler{transport: transport}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/refresh", nil)
	gc := &gin.Context{Request: req}

	var in RefreshTokenInput
	in.Gin = gc

	assert.NotPanics(t, func() {
		_, err := ah.refreshToken(context.Background(), in)

		var appErr ungerr.AppError
		assert.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusUnauthorized, appErr.HttpStatus())
	})
}
