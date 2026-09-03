package endpoint

import (
	"context"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

// TestRegisterNoBody_SecuredSetsBearerAuthSecurity mirrors
// TestRegister_SecuredSetsBearerAuthSecurity for NoBodyEndpoint.
func TestRegisterNoBody_SecuredSetsBearerAuthSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterNoBody(api, NoBodyEndpoint[struct{}]{
		OperationID: "test-nobody-secured",
		Method:      http.MethodDelete,
		Path:        "/test/nobody/secured",
		Secured:     true,
		HandlerFunc: func(context.Context, struct{}) error {
			return nil
		},
	})

	op := api.OpenAPI().Paths["/test/nobody/secured"].Delete
	assert.Equal(t, []map[string][]string{{"BearerAuth": {}}}, op.Security)
}

// TestRegisterNoBody_UnsecuredHasNoSecurity mirrors
// TestRegister_UnsecuredHasNoSecurity for NoBodyEndpoint.
func TestRegisterNoBody_UnsecuredHasNoSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterNoBody(api, NoBodyEndpoint[struct{}]{
		OperationID: "test-nobody-unsecured",
		Method:      http.MethodDelete,
		Path:        "/test/nobody/unsecured",
		HandlerFunc: func(context.Context, struct{}) error {
			return nil
		},
	})

	op := api.OpenAPI().Paths["/test/nobody/unsecured"].Delete
	assert.Empty(t, op.Security)
}

// TestRegisterNoBody_SuccessReturnsNoContentWithNoBody proves a successful
// HandlerFunc call yields 204 with a genuinely empty body.
func TestRegisterNoBody_SuccessReturnsNoContentWithNoBody(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterNoBody(api, NoBodyEndpoint[struct{}]{
		OperationID: "test-nobody-success",
		Method:      http.MethodDelete,
		Path:        "/test/nobody/success",
		HandlerFunc: func(context.Context, struct{}) error {
			return nil
		},
	})

	resp := api.Delete("/test/nobody/success")
	assert.Equal(t, http.StatusNoContent, resp.Code)
	assert.Empty(t, resp.Body.String())
}

// TestRegisterNoBody_ErrorPassesThroughUntouched mirrors
// TestRegister_ErrorPassesThroughUntouched for NoBodyEndpoint.
func TestRegisterNoBody_ErrorPassesThroughUntouched(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterNoBody(api, NoBodyEndpoint[struct{}]{
		OperationID: "test-nobody-error",
		Method:      http.MethodDelete,
		Path:        "/test/nobody/error",
		HandlerFunc: func(context.Context, struct{}) error {
			return ungerr.NotFoundError("thing not found")
		},
	})

	resp := api.Delete("/test/nobody/error")
	assert.Equal(t, http.StatusNotFound, resp.Code)
}

// TestRegisterNoBody_PerRouteMiddlewareRuns proves a per-route Middlewares
// entry actually gets invoked, appended after any shared mw.
func TestRegisterNoBody_PerRouteMiddlewareRuns(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	var ran bool
	routeMW := func(ctx huma.Context, next func(huma.Context)) {
		ran = true
		next(ctx)
	}

	RegisterNoBody(api, NoBodyEndpoint[struct{}]{
		OperationID: "test-nobody-mw",
		Method:      http.MethodDelete,
		Path:        "/test/nobody/mw",
		Middlewares: []func(huma.Context, func(huma.Context)){routeMW},
		HandlerFunc: func(context.Context, struct{}) error {
			return nil
		},
	})

	resp := api.Delete("/test/nobody/mw")
	assert.Equal(t, http.StatusNoContent, resp.Code)
	assert.True(t, ran)
}
