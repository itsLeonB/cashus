package endpoint_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

// TestRegisterRedirect_SecuredSetsBearerAuthSecurity mirrors
// TestRegister_SecuredSetsBearerAuthSecurity for RedirectEndpoint.
func TestRegisterRedirect_SecuredSetsBearerAuthSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.RegisterRedirect(api, endpoint.RedirectEndpoint[struct{}]{
		OperationID: "test-redirect-secured",
		Method:      http.MethodGet,
		Path:        "/test/redirect/secured",
		Secured:     true,
		HandlerFunc: func(context.Context, struct{}) (string, error) {
			return "https://example.com", nil
		},
	})

	op := api.OpenAPI().Paths["/test/redirect/secured"].Get
	assert.Equal(t, []map[string][]string{{"BearerAuth": {}}}, op.Security)
}

// TestRegisterRedirect_UnsecuredHasNoSecurity mirrors
// TestRegister_UnsecuredHasNoSecurity for RedirectEndpoint.
func TestRegisterRedirect_UnsecuredHasNoSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.RegisterRedirect(api, endpoint.RedirectEndpoint[struct{}]{
		OperationID: "test-redirect-unsecured",
		Method:      http.MethodGet,
		Path:        "/test/redirect/unsecured",
		HandlerFunc: func(context.Context, struct{}) (string, error) {
			return "https://example.com", nil
		},
	})

	op := api.OpenAPI().Paths["/test/redirect/unsecured"].Get
	assert.Empty(t, op.Security)
}

// TestRegisterRedirect_StatusAndLocation proves the response carries
// Status: 307 and a Location header set from HandlerFunc's returned URL.
func TestRegisterRedirect_StatusAndLocation(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.RegisterRedirect(api, endpoint.RedirectEndpoint[struct{}]{
		OperationID: "test-redirect-success",
		Method:      http.MethodGet,
		Path:        "/test/redirect/success",
		HandlerFunc: func(context.Context, struct{}) (string, error) {
			return "https://example.com/oauth", nil
		},
	})

	resp := api.Get("/test/redirect/success")
	assert.Equal(t, http.StatusTemporaryRedirect, resp.Code)
	assert.Equal(t, "https://example.com/oauth", resp.Header().Get("Location"))

	op := api.OpenAPI().Paths["/test/redirect/success"].Get
	docResp, ok := op.Responses["307"]
	assert.True(t, ok, "expected documented 307 response")
	if ok {
		_, hasLocation := docResp.Headers["Location"]
		assert.True(t, hasLocation, "expected documented Location header")
	}
}

// TestRegisterRedirect_ErrorPassesThroughUntouched mirrors
// TestRegister_ErrorPassesThroughUntouched for RedirectEndpoint.
func TestRegisterRedirect_ErrorPassesThroughUntouched(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.RegisterRedirect(api, endpoint.RedirectEndpoint[struct{}]{
		OperationID: "test-redirect-error",
		Method:      http.MethodGet,
		Path:        "/test/redirect/error",
		HandlerFunc: func(context.Context, struct{}) (string, error) {
			return "", ungerr.NotFoundError("thing not found")
		},
	})

	resp := api.Get("/test/redirect/error")
	assert.Equal(t, http.StatusNotFound, resp.Code)
}

// TestRegisterRedirect_PerRouteMiddlewareRuns proves a per-route
// Middlewares entry actually gets invoked.
func TestRegisterRedirect_PerRouteMiddlewareRuns(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	var ran bool
	routeMW := func(ctx huma.Context, next func(huma.Context)) {
		ran = true
		next(ctx)
	}

	endpoint.RegisterRedirect(api, endpoint.RedirectEndpoint[struct{}]{
		OperationID: "test-redirect-mw",
		Method:      http.MethodGet,
		Path:        "/test/redirect/mw",
		Middlewares: []func(huma.Context, func(huma.Context)){routeMW},
		HandlerFunc: func(context.Context, struct{}) (string, error) {
			return "https://example.com", nil
		},
	})

	resp := api.Get("/test/redirect/mw")
	assert.Equal(t, http.StatusTemporaryRedirect, resp.Code)
	assert.True(t, ran)
}
