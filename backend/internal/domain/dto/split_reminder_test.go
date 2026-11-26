package dto

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSplitReminderNullableExpenseReferences(t *testing.T) {
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)
	schema := registry.Schema(reflect.TypeOf(SplitReminderResponse{}), false, "")
	assert.True(t, schema.Properties["draftExpenseId"].Nullable)
	assert.True(t, schema.Properties["expenseId"].Nullable)
	encoded, err := json.Marshal(SplitReminderResponse{})
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, json.Unmarshal(encoded, &body))
	for _, field := range []string{"draftExpenseId", "expenseId"} {
		assert.Contains(t, body, field)
		assert.Nil(t, body[field])
	}
}
