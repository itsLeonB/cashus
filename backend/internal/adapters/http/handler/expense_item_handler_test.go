package handler

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
)

// TestSyncExpenseItemParticipantsInput_EmptyParticipants_RejectedBySchema
// proves the Participants `minItems:"1"` tag (CASH-16) - mirroring
// AllocationService.AllocateAmounts's "no participants provided" check -
// is enforced by huma's schema validation.
func TestSyncExpenseItemParticipantsInput_EmptyParticipants_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncExpenseItemParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	payload := map[string]any{"participants": []any{}}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "an empty participants list should fail schema validation")
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
