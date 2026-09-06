import { describe, test, expect } from "bun:test";
import { parseErrorResponse } from "./client";
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
  test("uses the backend's `detail` field for a business-rule error", async () => {
    // Shape produced by ungerr.AppError (e.g. UnprocessableEntityError).
    const response = jsonResponse(422, {
      title: "amount must be more than 0",
      status: 422,
      detail: "amount must be more than 0",
    });

    const error = await parseErrorResponse(response);

    expect(error.message).toBe("amount must be more than 0");
    expect(error.statusCode).toBe(422);
  });

  test("uses `errors[].message` for a per-field request validation error", async () => {
    // Shape produced by Huma's own request validation.
    const response = jsonResponse(400, {
      title: "Bad Request",
      status: 400,
      detail: "validation failed",
      errors: [{ message: "expected string", location: "body.name" }],
    });

    const error = await parseErrorResponse(response);

    expect(error.message).toBe("expected string");
    expect(error.statusCode).toBe(400);
  });

  test("joins multiple field validation messages", async () => {
    const response = jsonResponse(400, {
      errors: [
        { message: "expected string", location: "body.name" },
        { message: "required", location: "body.amount" },
      ],
    });

    const error = await parseErrorResponse(response);

    expect(error.message).toBe("expected string; required");
  });

  test("shows a contact-developer message for server errors, ignoring detail", async () => {
    const response = jsonResponse(500, {
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
    });

    const error = await parseErrorResponse(response);

    expect(error.message).toContain("contact the developer");
    expect(error.statusCode).toBe(500);
  });

  test("falls back to a generic message when the body has no usable detail", async () => {
    const response = jsonResponse(404, {});

    const error = await parseErrorResponse(response);

    expect(error.message).toBe("Something went wrong");
  });

  test("falls back to a generic message when the body isn't valid JSON", async () => {
    const response = new Response("not json", { status: 400 });

    const error = await parseErrorResponse(response);

    expect(error.message).toBe("Something went wrong");
    expect(error.statusCode).toBe(400);
  });
});
