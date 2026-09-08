package handler

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
)

// TestAddOtherFeeInput_ZeroAmount_RejectedBySchema proves
// AddOtherFeeInput.Body.Amount's httpapi.NonZeroDecimal type (CASH-16
// review follow-up) rejects a zero amount at the schema level. This is one
// representative case wired onto the real Input type; NonZeroDecimal's full
// case matrix (all-zero strings, negative-is-allowed, etc.) lives in
// schema_test.go's TestNonZeroDecimalSchema, not duplicated here.
func TestAddOtherFeeInput_ZeroAmount_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(AddOtherFeeInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)
	schema.PrecomputeMessages()

	payload := map[string]any{"name": "service fee", "amount": float64(0), "calculationMethod": "EQUAL_SPLIT"}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "a zero amount should fail schema validation")
}

// TestAddOtherFeeInput_NegativeAmount_PassesSchema proves the "!= 0"
// constraint doesn't also reject a negative amount, which is a legitimate
// discount for other fees (CASH-16) - see AddOtherFeeInput.Body.Amount's
// comment.
func TestAddOtherFeeInput_NegativeAmount_PassesSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(AddOtherFeeInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)
	schema.PrecomputeMessages()

	payload := map[string]any{"name": "discount", "amount": -10.5, "calculationMethod": "EQUAL_SPLIT"}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.Empty(t, res.Errors, "a negative amount is a legitimate discount and should pass schema validation")
}
