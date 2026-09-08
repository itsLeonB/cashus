package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/stretchr/testify/assert"
)

// newAuthedDebtRouter builds a gin.Engine + Huma API wired the same way
// production does for a Secured route (humagin.New, httpapi.NewConfig), plus
// a minimal middleware standing in for the real auth middleware: it sets the
// gin context value AuthInput.Resolve reads (appconstant.ContextProfileID),
// so CreateDebtInput.ProfileID resolves the same way it would behind a real
// JWT, without pulling a real token/JWT stack into this test.
func newAuthedDebtRouter(t *testing.T) (*gin.Engine, huma.API) {
	t.Helper()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(appconstant.ContextProfileID.String(), uuid.NewString())
		c.Next()
	})
	api := humagin.New(router, httpapi.NewConfig())
	return router, api
}

// TestCreateDebtInput_NonPositiveAmount_RejectedBySchema proves the
// "amount must be greater than 0" rule (CASH-16) - moved from
// DebtService.RecordNewTransaction's imperative check onto
// CreateDebtInput.Body.Amount's httpapi.PositiveDecimal type - is enforced
// as a schema-validation (422, ungerr/Huma error contract) failure before
// the handler ever runs, for both wire forms Decimal/PositiveDecimal accept.
func TestCreateDebtInput_NonPositiveAmount_RejectedBySchema(t *testing.T) {
	tests := []struct {
		name string
		slug string
		body string
	}{
		{"negative number", "neg-number", `{"friendProfileId":"` + uuid.NewString() + `","direction":"OUTGOING","currency":"USD","amount":-5,"transferMethodId":"` + uuid.NewString() + `"}`},
		{"zero number", "zero-number", `{"friendProfileId":"` + uuid.NewString() + `","direction":"OUTGOING","currency":"USD","amount":0,"transferMethodId":"` + uuid.NewString() + `"}`},
		{"negative string", "neg-string", `{"friendProfileId":"` + uuid.NewString() + `","direction":"OUTGOING","currency":"USD","amount":"-5","transferMethodId":"` + uuid.NewString() + `"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router, api := newAuthedDebtRouter(t)

			handlerCalled := false
			huma.Register(api, huma.Operation{
				OperationID: "test-create-debt-" + tt.slug,
				Method:      http.MethodPost,
				Path:        "/test/debts-" + tt.slug,
			}, func(_ context.Context, in *CreateDebtInput) (*struct{}, error) {
				handlerCalled = true
				return &struct{}{}, nil
			})

			req := httptest.NewRequest(http.MethodPost, "/test/debts-"+tt.slug, strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
			assert.False(t, handlerCalled, "handler must not run for a non-positive amount")
			assert.Contains(t, rec.Body.String(), "amount")
		})
	}
}

// TestCreateDebtInput_PositiveAmount_ReachesHandler proves the
// PositiveDecimal constraint doesn't also reject valid positive amounts, for
// both wire forms.
func TestCreateDebtInput_PositiveAmount_ReachesHandler(t *testing.T) {
	tests := []struct {
		name string
		slug string
		body string
	}{
		{"positive number", "pos-number", `{"friendProfileId":"` + uuid.NewString() + `","direction":"OUTGOING","currency":"USD","amount":10.5,"transferMethodId":"` + uuid.NewString() + `"}`},
		{"positive string", "pos-string", `{"friendProfileId":"` + uuid.NewString() + `","direction":"OUTGOING","currency":"USD","amount":"10.50","transferMethodId":"` + uuid.NewString() + `"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router, api := newAuthedDebtRouter(t)

			handlerCalled := false
			huma.Register(api, huma.Operation{
				OperationID:   "test-create-debt-ok-" + tt.slug,
				Method:        http.MethodPost,
				Path:          "/test/debts-ok-" + tt.slug,
				DefaultStatus: http.StatusCreated,
			}, func(_ context.Context, in *CreateDebtInput) (*struct{}, error) {
				handlerCalled = true
				return &struct{}{}, nil
			})

			req := httptest.NewRequest(http.MethodPost, "/test/debts-ok-"+tt.slug, strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusCreated, rec.Code)
			assert.True(t, handlerCalled, "handler should run for a valid positive amount")
		})
	}
}
