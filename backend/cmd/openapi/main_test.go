package main

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRunWritesValidIndentedOpenAPIDocument proves run() produces
// well-formed, indented JSON containing the expected top-level OpenAPI
// document shape, without touching the filesystem (run() is written
// against io.Writer for exactly this).
func TestRunWritesValidIndentedOpenAPIDocument(t *testing.T) {
	var buf bytes.Buffer

	err := run(&buf)
	require.NoError(t, err)

	out := buf.Bytes()
	assert.NotEmpty(t, out)

	// Written as indented JSON: multi-line output, and re-indenting it
	// should be a no-op (already at 2-space indent).
	assert.Contains(t, string(out), "\n  ")

	var doc map[string]any
	require.NoError(t, json.Unmarshal(out, &doc))

	_, hasPaths := doc["paths"]
	assert.True(t, hasPaths, "expected the OpenAPI document to have a top-level 'paths' field")

	components, ok := doc["components"].(map[string]any)
	require.True(t, ok, "expected the OpenAPI document to have a top-level 'components' object")
	_, hasSchemas := components["schemas"]
	assert.True(t, hasSchemas, "expected components.schemas to be present")
}

// TestRunIsDeterministic proves two consecutive runs produce byte-identical
// output, which is what make openapi-check relies on to detect drift.
func TestRunIsDeterministic(t *testing.T) {
	var first, second bytes.Buffer

	require.NoError(t, run(&first))
	require.NoError(t, run(&second))

	assert.Equal(t, first.Bytes(), second.Bytes())
}
