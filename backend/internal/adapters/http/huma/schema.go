package httpapi

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/shopspring/decimal"
)

// Decimal wraps decimal.Decimal for use in Huma request-body fields.
//
// decimal.Decimal implements encoding.TextUnmarshaler, which Huma's schema
// inference treats as a plain "string" schema. That would reject the numeric
// `amount` values the frontend sends (parsed as JS numbers). Implementing
// huma.SchemaProvider here overrides the inferred schema to "number" so
// numeric request bodies validate correctly.
//
// Response DTOs are unaffected: they keep using raw decimal.Decimal, which
// still (de)serializes as a JSON string on the way out, matching today's
// wire format.
type Decimal struct {
	decimal.Decimal
}

// Schema implements huma.SchemaProvider.
//
// decimal.Decimal.UnmarshalJSON (see shopspring/decimal) accepts both a raw
// JSON number and a quoted numeric string (e.g. "10.50"), so the schema must
// accept both too, or huma's request validation would reject one of the two
// forms decimal.Decimal can actually parse.
func (Decimal) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{
		AnyOf: []*huma.Schema{
			{Type: huma.TypeNumber},
			{Type: huma.TypeString},
		},
	}
}

// PositiveDecimal is Decimal plus a "must be greater than zero" constraint,
// for amount fields whose service-layer rule is a strict positivity check
// (e.g. DebtService.RecordNewTransaction's "amount must be greater than 0"
// - see CASH-16).
//
// This is a distinct type, rather than a `Decimal` field plus an
// `exclusiveMinimum` struct tag, because that combination silently doesn't
// work with huma v2.39.1: huma.SchemaFromField applies numeric struct tags
// (`minimum`, `exclusiveMinimum`, etc.) directly onto whatever schema the
// field's type provides, without checking its shape. For a plain `Decimal`
// field, that schema is Decimal.Schema()'s `anyOf: [number, string]` object,
// which has no top-level `type`. huma.Validate's own ExclusiveMinimum check
// lives inside `switch s.Type { case TypeNumber, TypeInteger: ... }`, which
// an anyOf-only schema's `s.Type == ""` never enters - so the tag ends up
// serialized into /openapi.json (looking enforced) while being a silent
// no-op at request-validation time. Verified empirically against huma
// v2.39.1's Validate/SchemaFromField (CASH-16 spike follow-up).
//
// PositiveDecimal instead puts the constraint on the individual `anyOf`
// branches, where huma.Validate does check it: `exclusiveMinimum` on the
// number branch (hit by the TypeNumber case above), and a `pattern` on the
// string branch rejecting anything but an unsigned decimal (no leading
// `-`). The pattern requires at least one non-zero digit somewhere in the
// value (either before or after the decimal point), so quoted all-zero
// strings like "0", "0.0" and "000.000" are rejected the same way
// ExclusiveMinimum rejects 0 for the number branch. Any remaining gap
// between what this pattern accepts and true positivity (e.g. exotic
// numeric-string forms decimal.Decimal itself would reject at parse time)
// is why the service-layer positivity check stays in place as a backstop
// even where this type is used - see the callers' comments.
type PositiveDecimal struct {
	decimal.Decimal
}

// Schema implements huma.SchemaProvider. See the PositiveDecimal doc comment
// for why the constraint lives on each anyOf branch instead of as a
// struct-tag-applied top-level property.
func (PositiveDecimal) Schema(huma.Registry) *huma.Schema {
	zero := 0.0
	return &huma.Schema{
		AnyOf: []*huma.Schema{
			{Type: huma.TypeNumber, ExclusiveMinimum: &zero},
			{
				Type:               huma.TypeString,
				Pattern:            `^(0*[1-9][0-9]*(\.[0-9]+)?|0+\.[0-9]*[1-9][0-9]*)$`,
				PatternDescription: "a positive decimal number, e.g. \"10.50\" (no sign, not zero)",
			},
		},
	}
}

// NonZeroDecimal is Decimal plus a "must not be zero" constraint, for amount
// fields whose service-layer rule is a strict non-zero check (e.g.
// OtherFeeService's "amount != 0" - see AddOtherFeeInput.Body.Amount's
// comment in other_fee_handler.go, CASH-16), where a negative value is a
// legitimate case (e.g. a discount) and only zero is disallowed.
//
// JSON Schema has no direct "not equal to N" numeric keyword, but combining
// `not` with `const` expresses it: `not: {const: 0}` matches only when the
// value does NOT equal 0. Unlike the `exclusiveMinimum`/`pattern` tags
// PositiveDecimal relies on, huma v2.39.1's Validate does not gate `Not` or
// `Const` inside `switch s.Type { ... }` - both checks run unconditionally
// (near the top and bottom of Validate respectively), so they apply even to
// an anyOf-only schema with no top-level `type`. That means `not`+`const`
// IS enforced here, unlike the exclusiveMinimum-on-a-bare-Decimal-field gap
// TestDecimalFieldExclusiveMinimumTagIsNotEnforced documents - verified
// empirically in TestNonZeroDecimalSchema (CASH-16 follow-up spike).
//
// The number branch therefore puts `not: {const: 0}` alongside `type:
// number`. The string branch instead uses a `pattern` requiring at least
// one non-zero digit, with an optional leading `-` (negative is allowed
// here, unlike PositiveDecimal) - the same format-level approach
// PositiveDecimal uses, with the same residual gap (exotic numeric-string
// forms decimal.Decimal itself would still reject at parse time), which is
// why the service-layer "!= 0" check stays in place as a backstop even
// where this type is used - see the callers' comments.
type NonZeroDecimal struct {
	decimal.Decimal
}

// Schema implements huma.SchemaProvider. See the NonZeroDecimal doc comment
// for why the constraint lives on each anyOf branch instead of as a
// struct-tag-applied top-level property.
func (NonZeroDecimal) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{
		AnyOf: []*huma.Schema{
			{Type: huma.TypeNumber, Not: &huma.Schema{Const: 0.0}},
			{
				Type:               huma.TypeString,
				Pattern:            `^-?(0*[1-9][0-9]*(\.[0-9]+)?|0+\.[0-9]*[1-9][0-9]*)$`,
				PatternDescription: "a non-zero decimal number, e.g. \"10.50\" or \"-5\" (no zero)",
			},
		},
	}
}
