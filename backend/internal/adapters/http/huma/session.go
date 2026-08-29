package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/ginkgo/pkg/server"
)

// SessionInput is embedded in protected operation input structs that need
// the session ID set by the bridged auth middleware (e.g. for push
// subscriptions, which are tied to a specific login session rather than
// just a profile). Like AuthInput, it carries no request tag, so it
// contributes nothing to the request schema; its Resolve method populates
// SessionID from the gin context value the bridged auth middleware put
// there.
type SessionInput struct {
	SessionID uuid.UUID `json:"-"`
}

// Resolve implements huma.Resolver.
func (s *SessionInput) Resolve(ctx huma.Context) []error {
	gc := humagin.Unwrap(ctx)

	sessionID, err := server.GetAndParseFromContext[uuid.UUID](gc, appconstant.ContextSessionID.String())
	if err != nil {
		return []error{err}
	}

	s.SessionID = sessionID

	return nil
}
