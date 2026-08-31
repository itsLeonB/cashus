package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
)

// GinContextInput is embedded in operation inputs whose handler body needs
// direct access to the underlying *gin.Context (e.g. its .Writer/.Request,
// for authgin.CookieTransport). humagin.Unwrap only accepts a huma.Context,
// which the handler body does not receive (it gets a plain context.Context),
// so the gin context must be captured earlier, during Resolve, where a
// huma.Context is available — like AuthInput/SessionInput/AdminAuthInput, but
// storing the whole *gin.Context instead of one derived value.
type GinContextInput struct {
	Gin *gin.Context `json:"-"`
}

// Resolve implements huma.Resolver.
func (g *GinContextInput) Resolve(ctx huma.Context) []error {
	g.Gin = humagin.Unwrap(ctx)
	return nil
}
