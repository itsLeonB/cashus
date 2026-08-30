// Package httpapi hosts the shared Huma v2 wiring for the cashback API:
// the huma.Config, the auth-context resolver bridging ginkgo's context
// helper into typed Huma inputs, a Decimal schema wrapper for numeric
// request-body fields, and a bridge for reusing existing gin middleware
// (auth, CSRF, rate limiting) as Huma operation middleware.
package httpapi

import "github.com/danielgtaylor/huma/v2"

// NewConfig builds the huma.Config used to construct the single huma.API
// bound to the gin engine root.
//
// Successful response bodies are wrapped in a top-level "data" field (see
// httpapi.Envelope) by each handler's Output struct, matching the envelope
// shape the frontend expects. That wrapping is done per-Output-struct, not
// here; this config only disables Huma's own schema-link additions, which
// are unrelated to the envelope:
//   - CreateHooks is cleared so the default SchemaLinkTransformer (which
//     injects a top-level "$schema" field and a describedby Link header into
//     every response) is never registered.
//   - SchemasPath is cleared so the "/schemas/{schema}" route that serves
//     those linked JSON Schema documents is not mounted either.
//
// DocsPath and OpenAPIPath are left at their defaults ("/docs",
// "/openapi.json"/"/openapi.yaml") so Huma auto-mounts docs + spec at the
// engine root, unauthenticated.
func NewConfig() huma.Config {
	cfg := huma.DefaultConfig("Cashback API", "1.0")

	cfg.CreateHooks = nil
	cfg.SchemasPath = ""

	if cfg.Components.SecuritySchemes == nil {
		cfg.Components.SecuritySchemes = map[string]*huma.SecurityScheme{}
	}
	cfg.Components.SecuritySchemes["BearerAuth"] = &huma.SecurityScheme{
		Type:         "http",
		Scheme:       "bearer",
		BearerFormat: "JWT",
	}

	return cfg
}
