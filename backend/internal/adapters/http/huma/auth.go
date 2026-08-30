package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/ginkgo/pkg/server"
)

// AuthInput is embedded in every protected operation's input struct. It
// carries no request tag (no path/query/header/body), so it contributes
// nothing to the request schema; instead, its Resolve method (satisfying
// huma.Resolver) populates ProfileID from the gin context value the bridged
// auth middleware put there, bridging ginkgo's context helper into the
// typed Huma input.
type AuthInput struct {
	ProfileID uuid.UUID `json:"-"`
}

// Resolve implements huma.Resolver.
func (a *AuthInput) Resolve(ctx huma.Context) []error {
	gc := humagin.Unwrap(ctx)

	profileID, err := server.GetAndParseFromContext[uuid.UUID](gc, appconstant.ContextProfileID.String())
	if err != nil {
		return []error{err}
	}

	a.ProfileID = profileID

	return nil
}
