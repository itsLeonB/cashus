package httpapi

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
)

// TestDecimalSchemaAcceptsNumberAndString proves Decimal's schema validates
// both a raw JSON number and a quoted numeric string, matching what
// decimal.Decimal.UnmarshalJSON actually accepts on the wire.
func TestDecimalSchemaAcceptsNumberAndString(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := Decimal{}.Schema(registry)

	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{"numeric value", 10.5, false},
		{"numeric string", "10.50", false},
		{"boolean is invalid", true, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := &huma.ValidateResult{}
			huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, tt.value, res)
			if tt.wantErr {
				assert.NotEmpty(t, res.Errors)
			} else {
				assert.Empty(t, res.Errors)
			}
		})
	}
}

// TestDecimalFieldExclusiveMinimumTagIsNotEnforced documents the CASH-16
// spike finding this file's PositiveDecimal type exists to work around: a
// plain `exclusiveMinimum` struct tag on a Decimal field DOES get merged
// into the generated schema (visible in /openapi.json, asserted below), but
// huma.Validate never actually applies it, because huma.Validate's numeric
// checks only run inside `switch s.Type { case TypeNumber, TypeInteger:
// ... }`, and the schema the tag lands on has no top-level `type` (only
// `anyOf`) - so a negative amount is wrongly accepted. This test exists to
// catch huma ever changing that behavior out from under PositiveDecimal
// (which would make PositiveDecimal's extra type unnecessary) as much as to
// document today's gap; it is expected to keep passing, not to start
// failing, unless huma's behavior changes.
func TestDecimalFieldExclusiveMinimumTagIsNotEnforced(t *testing.T) {
	type body struct {
		Amount Decimal `json:"amount" exclusiveMinimum:"0"`
	}

	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := huma.SchemaFromType(registry, reflect.TypeOf(body{}))

	raw, err := schema.MarshalJSON()
	assert.NoError(t, err)
	assert.Contains(t, string(raw), `"exclusiveMinimum":0`, "the tag should still be merged into the schema JSON")

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, map[string]any{"amount": float64(-5)}, res)
	assert.Empty(t, res.Errors, "documents that huma.Validate does NOT enforce the merged exclusiveMinimum for an anyOf-shaped schema")
}

// TestPositiveDecimalSchema proves PositiveDecimal both documents and
// enforces "greater than zero" (CASH-16's fix for the gap
// TestDecimalFieldExclusiveMinimumTagIsNotEnforced documents), for both wire
// forms Decimal accepts: a raw JSON number and a quoted numeric string.
func TestPositiveDecimalSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := PositiveDecimal{}.Schema(registry)
	// huma normally calls this itself (schemaFromType, for any SchemaProvider
	// type) before a schema is ever used for validation; it precomputes each
	// AnyOf branch's compiled Pattern regexp (among other things), without
	// which the string branch's positivity check below would silently no-op.
	schema.PrecomputeMessages()

	raw, err := schema.MarshalJSON()
	assert.NoError(t, err)
	assert.Contains(t, string(raw), `"exclusiveMinimum":0`, "the constraint must show up in /openapi.json")

	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{"positive number", 10.5, false},
		{"positive numeric string", "10.50", false},
		{"zero number", float64(0), true},
		{"negative number", -5.0, true},
		{"negative numeric string", "-5", true},
		{"boolean is invalid", true, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := &huma.ValidateResult{}
			huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, tt.value, res)
			if tt.wantErr {
				assert.NotEmpty(t, res.Errors)
			} else {
				assert.Empty(t, res.Errors)
			}
		})
	}
}
