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

// TestPositiveDecimalSchemaRejectsAllZeroStrings proves the string-branch
// pattern rejects a quoted amount that is numerically zero regardless of
// how many digits or leading/trailing zeros it's written with, not just the
// literal "0" - this is the CASH-16 CodeRabbit-flagged gap in the previous
// `^[0-9]+(\.[0-9]+)?$` pattern, which wrongly matched "0", "0.0" and
// "000.000". These all-zero-string cases are intentionally unit-level only
// (schema_test.go), not duplicated into the HTTP integration tests, which
// stay limited to one representative rejected input each.
func TestPositiveDecimalSchemaRejectsAllZeroStrings(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := PositiveDecimal{}.Schema(registry)
	schema.PrecomputeMessages()

	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{"zero string", "0", true},
		{"zero string with decimals", "0.0", true},
		{"all-zero string with leading and trailing zeros", "000.000", true},
		{"small positive decimal string", "0.5", false},
		{"integer string", "10", false},
		{"small positive fraction with leading zero digit", "0.01", false},
		{"positive with redundant leading zero", "00.5", false},
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

// TestNonZeroDecimalSchema proves NonZeroDecimal both documents and enforces
// "not zero" (CASH-16), for both wire forms Decimal accepts, and that
// negative values - a legitimate discount for the fields this type is wired
// onto - are still accepted. It also serves as the empirical check for
// NonZeroDecimal's doc comment: that huma v2.39.1's Validate actually
// enforces a `not`/`const` sub-schema even on an anyOf-only schema with no
// top-level `type`, unlike the exclusiveMinimum-on-a-bare-Decimal-field gap
// TestDecimalFieldExclusiveMinimumTagIsNotEnforced documents.
func TestNonZeroDecimalSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := NonZeroDecimal{}.Schema(registry)
	schema.PrecomputeMessages()

	raw, err := schema.MarshalJSON()
	assert.NoError(t, err)
	assert.Contains(t, string(raw), `"not"`, "the constraint must show up in /openapi.json")

	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{"positive number", 10.5, false},
		{"negative number is allowed (discount)", -5.0, false},
		{"positive numeric string", "10.50", false},
		{"negative numeric string is allowed (discount)", "-5", false},
		{"zero number", float64(0), true},
		{"zero string", "0", true},
		{"zero string with decimals", "0.0", true},
		{"all-zero string with leading and trailing zeros", "000.000", true},
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
