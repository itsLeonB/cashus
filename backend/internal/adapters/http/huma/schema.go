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
