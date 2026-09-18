import { describe, test, expect } from "bun:test";
import { parseErrorResponse } from "./client";
import { getApiErrorMessage } from "./errors";
import type { ValidationError } from "./types";

interface BackendErrorBody {
  title?: string;
  status?: number;
  detail?: string;
  errors?: ValidationError[];
}

function jsonResponse(status: number, body: BackendErrorBody): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("parseErrorResponse", () => {
  test("parses the backend's raw ErrorModel body verbatim", async () => {
    // Shape produced by ungerr.AppError (e.g. UnprocessableEntityError).
    const response = jsonResponse(422, {
      title: "amount must be more than 0",
      status: 422,
      detail: "amount must be more than 0",
    });

    const error = await parseErrorResponse(response);

    expect(error.detail).toBe("amount must be more than 0");
    expect(error.title).toBe("amount must be more than 0");
    expect(error.status).toBe(422);
  });

  test("carries the `errors` array through untouched", async () => {
    // Shape produced by Huma's own request validation.
    const response = jsonResponse(400, {
      title: "Bad Request",
      status: 400,
      detail: "validation failed",
      errors: [{ message: "expected string", location: "body.name" }],
    });

    const error = await parseErrorResponse(response);

    expect(error.errors).toEqual([
      { message: "expected string", location: "body.name" },
    ]);
    expect(error.status).toBe(400);
  });

  test("uses the response's actual HTTP status even if the body omits it", async () => {
    const response = jsonResponse(400, {
      errors: [{ message: "expected string", location: "body.name" }],
    });

    const error = await parseErrorResponse(response);

    expect(error.status).toBe(400);
  });

  test("defaults `type` to \"about:blank\" when the body doesn't include one", async () => {
    const response = jsonResponse(404, {});

    const error = await parseErrorResponse(response);

    expect(error.type).toBe("about:blank");
  });

  test("falls back to an empty-but-valid ApiError when the body isn't valid JSON", async () => {
    const response = new Response("not json", { status: 400 });

    const error = await parseErrorResponse(response);

    expect(error.status).toBe(400);
    expect(error.detail).toBeUndefined();
  });
});

describe("getApiErrorMessage", () => {
  test("uses the backend's `detail` field for a business-rule error", async () => {
    const response = jsonResponse(422, {
      title: "amount must be more than 0",
      status: 422,
      detail: "amount must be more than 0",
    });
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toBe("amount must be more than 0");
  });

  test("uses `errors[].message` for a per-field request validation error", async () => {
    const response = jsonResponse(400, {
      title: "Bad Request",
      status: 400,
      detail: "validation failed",
      errors: [{ message: "expected string", location: "body.name" }],
    });
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toBe("expected string");
  });

  test("joins multiple field validation messages", async () => {
    const response = jsonResponse(400, {
      errors: [
        { message: "expected string", location: "body.name" },
        { message: "required", location: "body.amount" },
      ],
    });
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toBe("expected string; required");
  });

  test("shows a contact-developer message for server errors, ignoring detail", async () => {
    const response = jsonResponse(500, {
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
    });
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toContain("contact the developer");
  });

  test("falls back to a generic message when the body has no usable detail", async () => {
    const response = jsonResponse(404, {});
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toBe("Something went wrong");
  });

  test("falls back to a generic message when the body isn't valid JSON", async () => {
    const response = new Response("not json", { status: 400 });
    const error = await parseErrorResponse(response);

    expect(getApiErrorMessage(error)).toBe("Something went wrong");
  });

  test("uses the given fallback instead of the default when provided", () => {
    expect(getApiErrorMessage(null, "Custom fallback")).toBe(
      "Custom fallback",
    );
  });
});
