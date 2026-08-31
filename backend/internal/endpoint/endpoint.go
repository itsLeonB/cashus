// Package endpoint provides small, concrete generic wrappers around
// huma.Register, one per route shape used throughout this API, instead of
// one mega-generic mechanism:
//
//   - Endpoint[Req, Res]: the common shape — a request type Req (embedding
//     httpapi.AuthInput when secured), a response type Res wrapped in
//     httpapi.Envelope, and a service call that either succeeds or returns
//     an error untouched (ungerr.AppError already satisfies huma.StatusError,
//     so no translation is needed here).
//   - NoBodyEndpoint[Req]: a route with no response body at all (e.g. 204).
//   - ListEndpoint[Req, Res]: a route returning Envelope[[]Res] plus an
//     X-Total-Count header set to len(result).
//   - RedirectEndpoint[Req]: a bodyless redirect (Status + Location header).
//
// Every route in this API fits one of these four shapes; each can be
// wrapped as a Registrable (see registrable.go) and mixed in one
// []Registrable slice for RegisterAll.
package endpoint

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
)

// bearerAuthSecurity is the single security requirement used by every
// secured route in this API — see httpapi.NewConfig, which registers
// "BearerAuth" as the only security scheme.
var bearerAuthSecurity = []map[string][]string{{"BearerAuth": {}}}

// mergeMiddlewares appends route-specific middlewares after RegisterAll's
// shared ones, so shared middleware always runs first. Returns shared
// unmodified when route is empty, keeping behavior identical to passing mw
// straight through for every route that doesn't set per-route Middlewares.
func mergeMiddlewares(shared, route []func(huma.Context, func(huma.Context))) []func(huma.Context, func(huma.Context)) {
	if len(route) == 0 {
		return shared
	}

	merged := make([]func(huma.Context, func(huma.Context)), 0, len(shared)+len(route))
	merged = append(merged, shared...)
	merged = append(merged, route...)

	return merged
}

// Endpoint describes one route.
type Endpoint[Req, Res any] struct {
	OperationID string
	Method      string
	Path        string
	Summary     string
	Tags        []string
	SuccessCode int
	Secured     bool
	Middlewares []func(huma.Context, func(huma.Context))
	ServiceFunc func(context.Context, Req) (Res, error)
}

// envelopeOutput is the Output struct every Endpoint registers.
type envelopeOutput[Res any] struct {
	Body httpapi.Envelope[Res]
}

// Register builds a huma.Operation from e and registers it on api.
func Register[Req, Res any](api huma.API, e Endpoint[Req, Res], mw ...func(huma.Context, func(huma.Context))) {
	op := huma.Operation{
		OperationID:   e.OperationID,
		Method:        e.Method,
		Path:          e.Path,
		Summary:       e.Summary,
		Tags:          e.Tags,
		DefaultStatus: e.SuccessCode,
		Middlewares:   mergeMiddlewares(mw, e.Middlewares),
	}

	if e.Secured {
		op.Security = bearerAuthSecurity
	}

	huma.Register(api, op, func(ctx context.Context, in *Req) (*envelopeOutput[Res], error) {
		res, err := e.ServiceFunc(ctx, *in)
		if err != nil {
			return nil, err
		}

		return &envelopeOutput[Res]{Body: httpapi.NewEnvelope(res)}, nil
	})
}

// NoBodyEndpoint describes one route with no response body at all (e.g. a
// 204 No Content). Endpoint can't express this: its Output always has a
// Body field, and Huma advertises a response content schema for whatever
// status that Body is declared under regardless of whether it's 204 (see
// handler.LogoutOutput's doc comment for the same reasoning).
type NoBodyEndpoint[Req any] struct {
	OperationID string
	Method      string
	Path        string
	Summary     string
	Tags        []string
	Secured     bool
	Middlewares []func(huma.Context, func(huma.Context))
	ServiceFunc func(context.Context, Req) error
}

// noBodyOutput is the Output struct every NoBodyEndpoint registers: no Body
// field at all, matching handler.LogoutOutput's convention for a genuinely
// bodyless response.
type noBodyOutput struct{}

// RegisterNoBody builds a huma.Operation from e and registers it on api.
// DefaultStatus is always http.StatusNoContent.
func RegisterNoBody[Req any](api huma.API, e NoBodyEndpoint[Req], mw ...func(huma.Context, func(huma.Context))) {
	op := huma.Operation{
		OperationID:   e.OperationID,
		Method:        e.Method,
		Path:          e.Path,
		Summary:       e.Summary,
		Tags:          e.Tags,
		DefaultStatus: http.StatusNoContent,
		Middlewares:   mergeMiddlewares(mw, e.Middlewares),
	}

	if e.Secured {
		op.Security = bearerAuthSecurity
	}

	huma.Register(api, op, func(ctx context.Context, in *Req) (*noBodyOutput, error) {
		if err := e.ServiceFunc(ctx, *in); err != nil {
			return nil, err
		}

		return &noBodyOutput{}, nil
	})
}

// ListEndpoint describes one "get list" route: a body of Envelope[[]Res]
// plus an X-Total-Count header set to len(result), matching every current
// admin list route (e.g. admin.PlanHandler.RegisterGetList).
type ListEndpoint[Req, Res any] struct {
	OperationID string
	Method      string
	Path        string
	Summary     string
	Tags        []string
	Secured     bool
	Middlewares []func(huma.Context, func(huma.Context))
	ServiceFunc func(context.Context, Req) ([]Res, error)
}

// listOutput is the Output struct every ListEndpoint registers.
type listOutput[Res any] struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        httpapi.Envelope[[]Res]
}

// RegisterList builds a huma.Operation from e and registers it on api.
// DefaultStatus is always http.StatusOK.
func RegisterList[Req, Res any](api huma.API, e ListEndpoint[Req, Res], mw ...func(huma.Context, func(huma.Context))) {
	op := huma.Operation{
		OperationID:   e.OperationID,
		Method:        e.Method,
		Path:          e.Path,
		Summary:       e.Summary,
		Tags:          e.Tags,
		DefaultStatus: http.StatusOK,
		Middlewares:   mergeMiddlewares(mw, e.Middlewares),
	}

	if e.Secured {
		op.Security = bearerAuthSecurity
	}

	huma.Register(api, op, func(ctx context.Context, in *Req) (*listOutput[Res], error) {
		res, err := e.ServiceFunc(ctx, *in)
		if err != nil {
			return nil, err
		}

		return &listOutput[Res]{XTotalCount: len(res), Body: httpapi.NewEnvelope(res)}, nil
	})
}

// RedirectEndpoint describes one redirect route with no body, matching
// handler.AuthHandler.RegisterOAuthLogin (the only current route of this
// shape).
type RedirectEndpoint[Req any] struct {
	OperationID string
	Method      string
	Path        string
	Summary     string
	Tags        []string
	Secured     bool
	Middlewares []func(huma.Context, func(huma.Context))
	ServiceFunc func(context.Context, Req) (string, error)
}

// redirectOutput is the Output struct every RedirectEndpoint registers.
type redirectOutput struct {
	Status   int
	Location string `header:"Location"`
}

// RegisterRedirect builds a huma.Operation from e and registers it on api.
// Status is always http.StatusTemporaryRedirect.
func RegisterRedirect[Req any](api huma.API, e RedirectEndpoint[Req], mw ...func(huma.Context, func(huma.Context))) {
	op := huma.Operation{
		OperationID: e.OperationID,
		Method:      e.Method,
		Path:        e.Path,
		Summary:     e.Summary,
		Tags:        e.Tags,
		Middlewares: mergeMiddlewares(mw, e.Middlewares),
	}

	if e.Secured {
		op.Security = bearerAuthSecurity
	}

	huma.Register(api, op, func(ctx context.Context, in *Req) (*redirectOutput, error) {
		url, err := e.ServiceFunc(ctx, *in)
		if err != nil {
			return nil, err
		}

		return &redirectOutput{Status: http.StatusTemporaryRedirect, Location: url}, nil
	})
}
