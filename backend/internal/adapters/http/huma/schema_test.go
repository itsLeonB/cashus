package httpapi_test

import (
	"testing"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/stretchr/testify/assert"
)

// TestDecimalSchemaAcceptsNumberAndString proves Decimal's schema validates
// both a raw JSON number and a quoted numeric string, matching what
// decimal.Decimal.UnmarshalJSON actually accepts on the wire.
func TestDecimalSchemaAcceptsNumberAndString(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	schema := httpapi.Decimal{}.Schema(registry)

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
