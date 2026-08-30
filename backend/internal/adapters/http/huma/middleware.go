package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
)

// Bridge adapts an existing gin.HandlerFunc middleware (auth, CSRF, rate
// limiting, ...) into a Huma operation middleware, so it can be reused
// unchanged even though Huma is bound at the engine root and bypasses the
// gin route-group middleware chains those handlers used to run in.
//
// It unwraps the Huma context to the underlying gin context, runs the gin
// middleware against it, and only continues the Huma middleware chain if the
// gin context was not aborted. If the gin middleware aborted the request
// (e.g. unauthenticated, CSRF mismatch, rate limited), it has already
// written the gin response, so `next` is not called and the Huma chain stops
// here.
func Bridge(ginmw gin.HandlerFunc) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		gc := humagin.Unwrap(ctx)

		ginmw(gc)

		if gc.IsAborted() {
			return
		}

		next(ctx)
	}
}
