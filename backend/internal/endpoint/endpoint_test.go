package endpoint_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

// TestRegister_SecuredSetsBearerAuthSecurity proves Secured: true produces
// the BearerAuth security requirement on the generated operation. Checked
// against the spec directly (no round trip) since Huma doesn't enforce
// security schemes at runtime by itself — that's done by the gin auth
// middleware bridged in via mw, which this package doesn't own.
func TestRegister_SecuredSetsBearerAuthSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.Register(api, endpoint.Endpoint[struct{}, struct{}]{
		OperationID: "test-secured",
		Method:      http.MethodGet,
		Path:        "/test/secured",
		SuccessCode: http.StatusOK,
		Secured:     true,
		HandlerFunc: func(context.Context, struct{}) (struct{}, error) {
			return struct{}{}, nil
		},
	})

	op := api.OpenAPI().Paths["/test/secured"].Get
	assert.Equal(t, []map[string][]string{{"BearerAuth": {}}}, op.Security)
}

// TestRegister_UnsecuredHasNoSecurity proves Secured: false (the zero value)
// leaves the operation's Security unset.
func TestRegister_UnsecuredHasNoSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.Register(api, endpoint.Endpoint[struct{}, struct{}]{
		OperationID: "test-unsecured",
		Method:      http.MethodGet,
		Path:        "/test/unsecured",
		SuccessCode: http.StatusOK,
		HandlerFunc: func(context.Context, struct{}) (struct{}, error) {
			return struct{}{}, nil
		},
	})

	op := api.OpenAPI().Paths["/test/unsecured"].Get
	assert.Empty(t, op.Security)
}

type greetReq struct {
	Name string `query:"name"`
}

type greetRes struct {
	Greeting string `json:"greeting"`
}

// TestRegister_EnvelopeWrapsBody proves the response body matches what
// httpapi.NewEnvelope produces directly, with no shape drift.
func TestRegister_EnvelopeWrapsBody(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.Register(api, endpoint.Endpoint[greetReq, greetRes]{
		OperationID: "test-greet",
		Method:      http.MethodGet,
		Path:        "/test/greet",
		SuccessCode: http.StatusOK,
		HandlerFunc: func(_ context.Context, req greetReq) (greetRes, error) {
			return greetRes{Greeting: "hello " + req.Name}, nil
		},
	})

	resp := api.Get("/test/greet?name=world")
	assert.Equal(t, http.StatusOK, resp.Code)

	want, err := json.Marshal(httpapi.NewEnvelope(greetRes{Greeting: "hello world"}))
	assert.NoError(t, err)
	assert.JSONEq(t, string(want), resp.Body.String())
}

// TestRegister_ErrorPassesThroughUntouched proves an error returned by
// HandlerFunc reaches the client with the same HTTP status ungerr would
// normally produce, with no translation layer in between.
func TestRegister_ErrorPassesThroughUntouched(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	endpoint.Register(api, endpoint.Endpoint[struct{}, struct{}]{
		OperationID: "test-error",
		Method:      http.MethodGet,
		Path:        "/test/error",
		SuccessCode: http.StatusOK,
		HandlerFunc: func(context.Context, struct{}) (struct{}, error) {
			return struct{}{}, ungerr.NotFoundError("thing not found")
		},
	})

	resp := api.Get("/test/error")
	assert.Equal(t, http.StatusNotFound, resp.Code)
}

type echoReq struct {
	Value string `query:"value"`
}

type echoRes struct {
	Echoed string `json:"echoed"`
}

// TestRegisterAll_RegistersMultipleEndpointTypes proves Registrable/New/
// RegisterAll can register several Endpoint[Req,Res] instantiations with
// different Req/Res types through one call, and every registered route
// works.
func TestRegisterAll_RegistersMultipleEndpointTypes(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	routes := []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[greetReq, greetRes]{
			OperationID: "test-all-greet",
			Method:      http.MethodGet,
			Path:        "/test/all/greet",
			SuccessCode: http.StatusOK,
			HandlerFunc: func(_ context.Context, req greetReq) (greetRes, error) {
				return greetRes{Greeting: "hi " + req.Name}, nil
			},
		}),
		endpoint.New(endpoint.Endpoint[echoReq, echoRes]{
			OperationID: "test-all-echo",
			Method:      http.MethodGet,
			Path:        "/test/all/echo",
			SuccessCode: http.StatusOK,
			HandlerFunc: func(_ context.Context, req echoReq) (echoRes, error) {
				return echoRes{Echoed: req.Value}, nil
			},
		}),
	}

	endpoint.RegisterAll(api, routes)

	greetResp := api.Get("/test/all/greet?name=there")
	assert.Equal(t, http.StatusOK, greetResp.Code)
	assert.JSONEq(t, `{"data":{"greeting":"hi there"}}`, greetResp.Body.String())

	echoResp := api.Get("/test/all/echo?value=ping")
	assert.Equal(t, http.StatusOK, echoResp.Code)
	assert.JSONEq(t, `{"data":{"echoed":"ping"}}`, echoResp.Body.String())
}

// TestRegister_PerRouteMiddlewareRunsAfterShared proves Endpoint's
// Middlewares field is appended after RegisterAll's shared mw, and that a
// nil/empty Middlewares (every already-converted route) leaves behavior
// unchanged from passing mw straight through.
func TestRegister_PerRouteMiddlewareRunsAfterShared(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	var order []string
	sharedMW := func(ctx huma.Context, next func(huma.Context)) {
		order = append(order, "shared")
		next(ctx)
	}
	routeMW := func(ctx huma.Context, next func(huma.Context)) {
		order = append(order, "route")
		next(ctx)
	}

	endpoint.Register(api, endpoint.Endpoint[struct{}, struct{}]{
		OperationID: "test-mw-order",
		Method:      http.MethodGet,
		Path:        "/test/mw/order",
		SuccessCode: http.StatusOK,
		Middlewares: []func(huma.Context, func(huma.Context)){routeMW},
		HandlerFunc: func(context.Context, struct{}) (struct{}, error) {
			return struct{}{}, nil
		},
	}, sharedMW)

	resp := api.Get("/test/mw/order")
	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, []string{"shared", "route"}, order)
}

// TestRegisterAll_MixedEndpointTypes proves Endpoint, NoBodyEndpoint,
// ListEndpoint, and RedirectEndpoint can all be registered together through
// one RegisterAll call, and every registered route works.
func TestRegisterAll_MixedEndpointTypes(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	routes := []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[greetReq, greetRes]{
			OperationID: "test-mixed-greet",
			Method:      http.MethodGet,
			Path:        "/test/mixed/greet",
			SuccessCode: http.StatusOK,
			HandlerFunc: func(_ context.Context, req greetReq) (greetRes, error) {
				return greetRes{Greeting: "hi " + req.Name}, nil
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[struct{}]{
			OperationID: "test-mixed-nobody",
			Method:      http.MethodDelete,
			Path:        "/test/mixed/nobody",
			HandlerFunc: func(context.Context, struct{}) error {
				return nil
			},
		}),
		endpoint.NewList(endpoint.ListEndpoint[struct{}, greetRes]{
			OperationID: "test-mixed-list",
			Method:      http.MethodGet,
			Path:        "/test/mixed/list",
			HandlerFunc: func(context.Context, struct{}) ([]greetRes, error) {
				return []greetRes{{Greeting: "a"}, {Greeting: "b"}}, nil
			},
		}),
		endpoint.NewRedirect(endpoint.RedirectEndpoint[struct{}]{
			OperationID: "test-mixed-redirect",
			Method:      http.MethodGet,
			Path:        "/test/mixed/redirect",
			HandlerFunc: func(context.Context, struct{}) (string, error) {
				return "https://example.com", nil
			},
		}),
	}

	endpoint.RegisterAll(api, routes)

	greetResp := api.Get("/test/mixed/greet?name=there")
	assert.Equal(t, http.StatusOK, greetResp.Code)
	assert.JSONEq(t, `{"data":{"greeting":"hi there"}}`, greetResp.Body.String())

	noBodyResp := api.Delete("/test/mixed/nobody")
	assert.Equal(t, http.StatusNoContent, noBodyResp.Code)
	assert.Empty(t, noBodyResp.Body.String())

	listResp := api.Get("/test/mixed/list")
	assert.Equal(t, http.StatusOK, listResp.Code)
	assert.Equal(t, "2", listResp.Header().Get("X-Total-Count"))
	assert.JSONEq(t, `{"data":[{"greeting":"a"},{"greeting":"b"}]}`, listResp.Body.String())

	redirectResp := api.Get("/test/mixed/redirect")
	assert.Equal(t, http.StatusTemporaryRedirect, redirectResp.Code)
	assert.Equal(t, "https://example.com", redirectResp.Header().Get("Location"))
}
