package handler

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
)

// TestSyncExpenseItemParticipantsInput_EmptyParticipants_PassesSchema proves
// an empty Participants list is NOT rejected by schema validation (CASH-16
// review follow-up): syncing to an empty participant list is a legitimate,
// intentional state (e.g. clearing participants before confirming an
// expense), not an error, so no `minItems` tag is applied here. See
// AllocationService.AllocateAmounts's comment for why that function still
// rejects an empty slice regardless (a division-by-zero guard, not a rule
// mirrored from this schema).
func TestSyncExpenseItemParticipantsInput_EmptyParticipants_PassesSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncExpenseItemParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	payload := map[string]any{"participants": []any{}}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.Empty(t, res.Errors, "an empty participants list is a legitimate, intentional sync state")
}

// TestSyncExpenseItemParticipantsInput_NegativeWeight_RejectedBySchema
// proves Weight's `minimum:"0"` tag (CASH-16) - mirroring
// AllocationService.calculateAndValidateWeights's "weight cannot be
// negative" check - is enforced by huma's schema validation.
func TestSyncExpenseItemParticipantsInput_NegativeWeight_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncExpenseItemParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	payload := map[string]any{
		"participants": []any{
			map[string]any{"profileId": "11111111-1111-1111-1111-111111111111", "weight": -1},
		},
	}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "a negative weight should fail schema validation")
}

// TestSyncExpenseItemParticipantsInput_ValidParticipants_PassesSchema proves
// the new tags don't also reject a normal, valid request (including a
// zero-weight participant - "0" means equal-split, still allowed).
func TestSyncExpenseItemParticipantsInput_ValidParticipants_PassesSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncExpenseItemParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	payload := map[string]any{
		"participants": []any{
			map[string]any{"profileId": "11111111-1111-1111-1111-111111111111", "weight": float64(0)},
			map[string]any{"profileId": "22222222-2222-2222-2222-222222222222", "weight": float64(2)},
		},
	}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.Empty(t, res.Errors)
}

// TestAddExpenseItemInput_ZeroAmount_RejectedBySchema proves
// AddExpenseItemInput.Body.Amount's httpapi.NonZeroDecimal type (CASH-16
// review follow-up) rejects a zero amount at the schema level. This is one
// representative case wired onto the real Input type; NonZeroDecimal's full
// case matrix (all-zero strings, negative-is-allowed, etc.) lives in
// schema_test.go's TestNonZeroDecimalSchema, not duplicated here.
func TestAddExpenseItemInput_ZeroAmount_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(AddExpenseItemInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)
	schema.PrecomputeMessages()

	payload := map[string]any{"name": "lunch", "amount": float64(0), "quantity": float64(1)}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "a zero amount should fail schema validation")
}

// TestUpdateExpenseItemInput_ZeroAmount_RejectedBySchema mirrors
// TestAddExpenseItemInput_ZeroAmount_RejectedBySchema for
// UpdateExpenseItemInput.Body.Amount, which uses the same
// httpapi.NonZeroDecimal type.
func TestUpdateExpenseItemInput_ZeroAmount_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(UpdateExpenseItemInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)
	schema.PrecomputeMessages()

	payload := map[string]any{"name": "lunch", "amount": "0", "quantity": float64(1)}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "a zero amount should fail schema validation")
}
