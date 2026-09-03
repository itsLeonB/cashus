package endpoint

import (
	"context"
	"net/http"
	"strconv"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/ungerr"
	"github.com/stretchr/testify/assert"
)

type listItemRes struct {
	Name string `json:"name"`
}

// TestRegisterList_SecuredSetsBearerAuthSecurity mirrors
// TestRegister_SecuredSetsBearerAuthSecurity for ListEndpoint.
func TestRegisterList_SecuredSetsBearerAuthSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterList(api, ListEndpoint[struct{}, listItemRes]{
		OperationID: "test-list-secured",
		Method:      http.MethodGet,
		Path:        "/test/list/secured",
		Secured:     true,
		HandlerFunc: func(context.Context, struct{}) ([]listItemRes, error) {
			return nil, nil
		},
	})

	op := api.OpenAPI().Paths["/test/list/secured"].Get
	assert.Equal(t, []map[string][]string{{"BearerAuth": {}}}, op.Security)
}

// TestRegisterList_UnsecuredHasNoSecurity mirrors
// TestRegister_UnsecuredHasNoSecurity for ListEndpoint.
func TestRegisterList_UnsecuredHasNoSecurity(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterList(api, ListEndpoint[struct{}, listItemRes]{
		OperationID: "test-list-unsecured",
		Method:      http.MethodGet,
		Path:        "/test/list/unsecured",
		HandlerFunc: func(context.Context, struct{}) ([]listItemRes, error) {
			return nil, nil
		},
	})

	op := api.OpenAPI().Paths["/test/list/unsecured"].Get
	assert.Empty(t, op.Security)
}

// TestRegisterList_BodyAndTotalCount proves the body wraps in
// Envelope[[]Res] correctly and X-Total-Count matches len(result).
func TestRegisterList_BodyAndTotalCount(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	items := []listItemRes{{Name: "a"}, {Name: "b"}, {Name: "c"}}

	RegisterList(api, ListEndpoint[struct{}, listItemRes]{
		OperationID: "test-list-body",
		Method:      http.MethodGet,
		Path:        "/test/list/body",
		HandlerFunc: func(context.Context, struct{}) ([]listItemRes, error) {
			return items, nil
		},
	})

	resp := api.Get("/test/list/body")
	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, strconv.Itoa(len(items)), resp.Header().Get("X-Total-Count"))
	assert.JSONEq(t, `{"data":[{"name":"a"},{"name":"b"},{"name":"c"}]}`, resp.Body.String())
}

// TestRegisterList_ErrorPassesThroughUntouched mirrors
// TestRegister_ErrorPassesThroughUntouched for ListEndpoint.
func TestRegisterList_ErrorPassesThroughUntouched(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	RegisterList(api, ListEndpoint[struct{}, listItemRes]{
		OperationID: "test-list-error",
		Method:      http.MethodGet,
		Path:        "/test/list/error",
		HandlerFunc: func(context.Context, struct{}) ([]listItemRes, error) {
			return nil, ungerr.NotFoundError("thing not found")
		},
	})

	resp := api.Get("/test/list/error")
	assert.Equal(t, http.StatusNotFound, resp.Code)
}

// TestRegisterList_PerRouteMiddlewareRuns proves a per-route Middlewares
// entry actually gets invoked.
func TestRegisterList_PerRouteMiddlewareRuns(t *testing.T) {
	_, api := humatest.New(t, httpapi.NewConfig())

	var ran bool
	routeMW := func(ctx huma.Context, next func(huma.Context)) {
		ran = true
		next(ctx)
	}

	RegisterList(api, ListEndpoint[struct{}, listItemRes]{
		OperationID: "test-list-mw",
		Method:      http.MethodGet,
		Path:        "/test/list/mw",
		Middlewares: []func(huma.Context, func(huma.Context)){routeMW},
		HandlerFunc: func(context.Context, struct{}) ([]listItemRes, error) {
			return nil, nil
		},
	})

	resp := api.Get("/test/list/mw")
	assert.Equal(t, http.StatusOK, resp.Code)
	assert.True(t, ran)
}
