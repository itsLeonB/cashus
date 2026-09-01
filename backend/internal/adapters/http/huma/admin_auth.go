package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/google/uuid"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/ginkgo/pkg/server"
)

// AdminAuthInput is embedded in protected admin operation input structs that
// need the admin user id set by the bridged admin auth middleware
// (mw.AdminAuth). It carries no request tag, so it contributes nothing to
// the request schema; its Resolve method populates UserID from the gin
// context value the bridged admin auth middleware put there.
//
// Unlike AuthInput (which parses ContextProfileID out of a string context
// value via GetAndParseFromContext), the admin auth middleware
// (ginkgo/pkg/middleware.NewAuthMiddleware) copies the verified JWT claims
// map directly into the gin context with ctx.Set, so ContextUserID is
// already stored under its native type there; this mirrors the existing
// admin.getUserID helper by using GetFromContext instead.
type AdminAuthInput struct {
	UserID uuid.UUID `json:"-"`
}

// Resolve implements huma.Resolver.
func (a *AdminAuthInput) Resolve(ctx huma.Context) []error {
	gc := humagin.Unwrap(ctx)

	userID, err := server.GetFromContext[uuid.UUID](gc, appconstant.ContextUserID.String())
	if err != nil {
		return []error{err}
	}

	a.UserID = userID

	return nil
}
