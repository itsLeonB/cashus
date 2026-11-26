package handler

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func reminderRouter(h *SplitReminderHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set(appconstant.ContextProfileID.String(), c.GetHeader("X-Test-Profile")) })
	api := humagin.New(router, httpapi.NewConfig())
	endpoint.RegisterAll(api, h.Routes())
	return router
}
func reminderRequest(router *gin.Engine, method, path, body, actor string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-Profile", actor)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}
func TestSendSplitReminderRejectsInvalidInput(t *testing.T) {
	router := reminderRouter(&SplitReminderHandler{Repository: service.NewSplitReminderService(nil)})
	for _, body := range []string{`{"description":""}`, `{"description":"meal","mealDate":"2025-02-30"}`, `{"description":"meal","mealDate":"0000-01-01"}`, `{"description":"meal","mealDate":"2026-01-01"}`, `{"description":"meal","mealDate":"2026-01-01T00:00:00"}`, `{"description":"meal","mealDate":"0001-01-01T00:00:00+01:00"}`} {
		response := reminderRequest(router, "POST", "/api/v1/friendships/11111111-1111-1111-1111-111111111111/split-reminders", body, uuid.NewString())
		assert.Equal(t, 422, response.Code, response.Body.String())
	}
}

func TestSendSplitReminderRejectsMalformedTimestamps(t *testing.T) {
	router := reminderRouter(&SplitReminderHandler{Repository: service.NewSplitReminderService(nil)})
	for _, tc := range []struct {
		name     string
		mealDate string
	}{
		{"offset hour", "2026-01-01T00:00:00+24:00"},
		{"offset minute", "2026-01-01T00:00:00+00:60"},
		{"negative offset hour", "2026-01-01T00:00:00-24:00"},
		{"negative offset minute", "2026-01-01T00:00:00-00:60"},
		{"comma fraction", "2026-01-01T00:00:00,123Z"},
		{"single digit hour", "2026-01-01T1:00:00Z"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(map[string]string{"description": "meal", "mealDate": tc.mealDate})
			require.NoError(t, err)
			response := reminderRequest(router, "POST", "/api/v1/friendships/11111111-1111-1111-1111-111111111111/split-reminders", string(body), uuid.NewString())
			assert.Equal(t, 422, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), "mealDate")
		})
	}
}
