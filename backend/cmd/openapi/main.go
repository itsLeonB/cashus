// Command openapi generates the Huma-produced OpenAPI document without
// starting an HTTP server, a database, or any network connection. It wires
// up the same no-op-provider gin router + Huma API that
// internal/adapters/http/routes.BuildNoopAPI (and its
// TestFullRegistrationSmoke consumer) use, then serializes the resulting
// spec as indented JSON to stdout.
//
// This exists so the checked-in backend/openapi.json artifact - the stable
// input the frontend's codegen step consumes - can be regenerated (`make
// openapi`) and its freshness verified (`make openapi-check`) purely from
// the router wiring, in CI or locally, with nothing else running. See
// CASH-18 and backend/CLAUDE.md.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/itsLeonB/cashback/internal/adapters/http/routes"
)

func main() {
	if err := run(os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "openapi: "+err.Error())
		os.Exit(1)
	}
}

func run(w *os.File) error {
	_, api := routes.BuildNoopAPI()

	raw, err := api.OpenAPI().MarshalJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal OpenAPI document: %w", err)
	}

	var pretty bytes.Buffer
	if err := json.Indent(&pretty, raw, "", "  "); err != nil {
		return fmt.Errorf("failed to indent OpenAPI document: %w", err)
	}
	pretty.WriteByte('\n')

	if _, err := w.Write(pretty.Bytes()); err != nil {
		return fmt.Errorf("failed to write OpenAPI document: %w", err)
	}

	return nil
}
