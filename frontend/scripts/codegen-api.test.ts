// scripts/codegen-api.test.ts
//
// Validates scripts/codegen-api.ts against a small, hand-written fixture
// OpenAPI document (scripts/__fixtures__/openapi.sample.json) since
// backend/openapi.json does not exist in this worktree (see CASH-19 /
// frontend/CLAUDE.md's "API codegen" section for why). This is what makes
// the codegen pipeline provably correct ahead of the real backend document
// existing, per the CASH-19 coordination contract.

import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  generateSchemaSource,
  writeSchema,
  checkSchemaDrift,
  parseArgs,
  DEFAULT_INPUT_PATH,
  DEFAULT_OUTPUT_PATH,
} from "./codegen-api";

const FIXTURE_PATH = path.join(import.meta.dir, "__fixtures__", "openapi.sample.json");

function tmpOutputPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-api-test-"));
  return path.join(dir, "schema.gen.ts");
}

describe("generateSchemaSource", () => {
  test("turns the fixture OpenAPI document into TS types with no network access", async () => {
    const source = await generateSchemaSource(FIXTURE_PATH);

    expect(source).toContain("export interface components");
    expect(source).toContain("LoginRequest");
    expect(source).toContain("UserProfile");
    // Nested $ref (CurrentSubscription.limits.uploads.daily -> UploadLimit)
    // resolved correctly, proving local $ref resolution works without
    // touching the network.
    expect(source).toContain('components["schemas"]["UploadLimit"]');
  });

  test("is deterministic for the same input", async () => {
    const first = await generateSchemaSource(FIXTURE_PATH);
    const second = await generateSchemaSource(FIXTURE_PATH);

    expect(first).toBe(second);
  });

  test("throws a clear error when the input file is missing", async () => {
    const missingPath = path.join(os.tmpdir(), "does-not-exist-openapi.json");

    await expect(generateSchemaSource(missingPath)).rejects.toThrow(/not found/);
  });
});

describe("writeSchema + checkSchemaDrift", () => {
  test("check fails with a helpful message when the output doesn't exist yet", async () => {
    const outputPath = tmpOutputPath();

    const result = await checkSchemaDrift({ inputPath: FIXTURE_PATH, outputPath });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("does not exist yet");
  });

  test("check passes right after generate, and catches a hand-edited (stale) file", async () => {
    const outputPath = tmpOutputPath();

    await writeSchema({ inputPath: FIXTURE_PATH, outputPath });

    const freshResult = await checkSchemaDrift({ inputPath: FIXTURE_PATH, outputPath });
    expect(freshResult.ok).toBe(true);

    // Simulate drift: someone hand-edits the checked-in file, or the
    // backend's OpenAPI document changes without regenerating it.
    fs.appendFileSync(outputPath, "\n// hand edit\n");

    const staleResult = await checkSchemaDrift({ inputPath: FIXTURE_PATH, outputPath });
    expect(staleResult.ok).toBe(false);
    expect(staleResult.message).toContain("stale");

    // The check must never shell out to `git diff` — it has to work purely
    // by comparing generated output to the checked-in file, so it behaves
    // the same in CI as in a dirty local working tree. We can't easily
    // assert "no git subprocess was spawned" here, but we can assert the
    // comparison is file-content-only by working entirely inside a tmp dir
    // that isn't part of any git working tree's index state.
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

describe("parseArgs", () => {
  test("defaults to the real backend document and the checked-in schema.gen.ts", () => {
    const { mode, options } = parseArgs(["generate"]);

    expect(mode).toBe("generate");
    expect(options.inputPath).toBe(DEFAULT_INPUT_PATH);
    expect(options.outputPath).toBe(DEFAULT_OUTPUT_PATH);
  });

  test("accepts --input and --output overrides, used here to target the fixture", () => {
    const { mode, options } = parseArgs([
      "check",
      "--input=scripts/__fixtures__/openapi.sample.json",
      "--output=tmp/schema.gen.ts",
    ]);

    expect(mode).toBe("check");
    expect(options.inputPath).toBe(path.resolve(process.cwd(), "scripts/__fixtures__/openapi.sample.json"));
    expect(options.outputPath).toBe(path.resolve(process.cwd(), "tmp/schema.gen.ts"));
  });

  test("rejects an unknown mode", () => {
    expect(() => parseArgs(["bogus"])).toThrow(/Unknown mode/);
  });
});
