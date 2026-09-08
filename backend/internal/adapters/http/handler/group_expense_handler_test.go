package handler

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
)

// TestSyncGroupExpenseParticipantsInput_DuplicateProfileIDs_RejectedBySchema
// proves ParticipantProfileIDs' `uniqueItems:"true"` tag (CASH-16) - which
// replaced GroupExpenseService.validateAndGetParticipants's imperative
// "duplicate participant profile IDs given" check - is actually enforced by
// huma's schema validation, not just documented in /openapi.json.
func TestSyncGroupExpenseParticipantsInput_DuplicateProfileIDs_RejectedBySchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncGroupExpenseParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	dup := "11111111-1111-1111-1111-111111111111"
	payload := map[string]any{
		"participantProfileIds": []any{dup, dup},
		"payerProfileId":        dup,
	}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.NotEmpty(t, res.Errors, "duplicate participant profile IDs should fail schema validation")
}

// TestSyncGroupExpenseParticipantsInput_UniqueProfileIDs_PassesSchema proves
// the uniqueItems tag doesn't also reject a valid, deduplicated list.
func TestSyncGroupExpenseParticipantsInput_UniqueProfileIDs_PassesSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/prefix", huma.DefaultSchemaNamer)
	bodyType := reflect.TypeOf(SyncGroupExpenseParticipantsInput{}.Body)
	schema := huma.SchemaFromType(registry, bodyType)

	a := "11111111-1111-1111-1111-111111111111"
	b := "22222222-2222-2222-2222-222222222222"
	payload := map[string]any{
		"participantProfileIds": []any{a, b},
		"payerProfileId":        a,
	}

	res := &huma.ValidateResult{}
	huma.Validate(registry, schema, huma.NewPathBuffer([]byte(""), 0), huma.ModeWriteToServer, payload, res)
	assert.Empty(t, res.Errors)
}
