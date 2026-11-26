package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/core/config"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSplitReminderPreflightAllowsIdempotencyKey(t *testing.T) {
	old := config.Global
	t.Cleanup(func() { config.Global = old })
	config.Global = &config.Config{}
	config.Global.ClientUrls = []string{"https://app.example.com"}
	config.Global.Timeout = time.Second
	router := gin.New()
	require.NoError(t, setupSentinel(router, nil, zerolog.Nop()))
	router.POST("/api/v1/friendships/:friendshipID/split-reminders", func(c *gin.Context) { c.Status(http.StatusCreated) })
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/friendships/123/split-reminders", nil)
	request.Header.Set("Origin", "https://app.example.com")
	request.Header.Set("Access-Control-Request-Method", "POST")
	request.Header.Set("Access-Control-Request-Headers", "authorization,content-type,idempotency-key")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Less(t, response.Code, 400)
	assert.Contains(t, response.Header().Get("Access-Control-Allow-Headers"), "Idempotency-Key")
}
