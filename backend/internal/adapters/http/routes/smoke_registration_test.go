package routes

import (
	"encoding/json"
	"testing"

	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	"github.com/itsLeonB/cashback/internal/adapters/http/handler"
	adminHandler "github.com/itsLeonB/cashback/internal/adapters/http/handler/admin"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/provider"
	adminProvider "github.com/itsLeonB/cashback/internal/provider/admin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFullRegistrationSmoke verifies that every Huma operation across the
// public/protected/admin surface registers without panicking (duplicate
// operation IDs, duplicate method+path, or path params without a matching
// input field all panic at huma.Register time, not at go build time).
func TestFullRegistrationSmoke(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := humagin.New(router, httpapi.NewConfig())

	handlers := handler.ProvideHandlers(&provider.Services{}, nil)
	adminHandlers := adminHandler.ProvideHandlers(&adminProvider.Services{}, &adminProvider.Repositories{}, &provider.Services{})

	noopAuth := func(c *gin.Context) {}

	assert.NotPanics(t, func() {
		RegisterAPIRoutes(router, handlers, noopAuth, api)
		RegisterAdminRoutes(router, adminHandlers, noopAuth, api)
	})

	spec := api.OpenAPI()
	require.NotNil(t, spec)

	b, err := json.Marshal(spec)
	require.NoError(t, err)

	var doc map[string]any
	require.NoError(t, json.Unmarshal(b, &doc))

	paths, ok := doc["paths"].(map[string]any)
	require.True(t, ok)

	opCount := 0
	for _, methods := range paths {
		methodsMap, ok := methods.(map[string]any)
		require.True(t, ok)
		for range methodsMap {
			opCount++
		}
	}

	t.Logf("total registered Huma operations: %d", opCount)

	_, hasDebtsPost := paths["/api/v1/debts"]
	assert.True(t, hasDebtsPost, "expected /api/v1/debts to be registered")

	_, hasAdminPlansGet := paths["/admin/v1/plans"]
	assert.True(t, hasAdminPlansGet, "expected /admin/v1/plans to be registered")

	components, ok := doc["components"].(map[string]any)
	require.True(t, ok)
	securitySchemes, ok := components["securitySchemes"].(map[string]any)
	require.True(t, ok)
	_, hasBearer := securitySchemes["BearerAuth"]
	assert.True(t, hasBearer, "expected components.securitySchemes.BearerAuth to be present")
}
