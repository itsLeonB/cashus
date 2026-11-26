import { afterEach, expect, test } from "bun:test";
import { splitRemindersApi } from "./split-reminders";
const originalFetch = globalThis.fetch;

test("list and retrieve use read-only routes and unwrap empty and populated responses", async () => {
  const requests: string[] = [];
  // SAFETY: test fetch returns real Response objects for the API transport.
  globalThis.fetch = (async (url, init) => {
    expect(init?.method).toBe("GET");
    requests.push(String(url));
    return Response.json({ data: requests.length === 1 ? [] : { id: "meal", mealDate: null } });
  }) as typeof fetch;
  expect(await splitRemindersApi.list("friend")).toEqual([]);
  expect(await splitRemindersApi.get("meal")).toEqual({ id: "meal", mealDate: null });
  expect(requests[0]).toEndWith("/friendships/friend/split-reminders");
  expect(requests[1]).toEndWith("/split-reminders/meal");
});

test("validation, duplicate and inaccessible reminder errors remain available to callers", async () => {
  for (const status of [422, 409, 404]) {
    // SAFETY: test fetch returns a real error Response for every request.
    globalThis.fetch = (async () => Response.json({ detail: "Cannot send this reminder" }, { status })) as typeof fetch;
    await expect(splitRemindersApi.send("friend", { description: "Lunch" })).rejects.toMatchObject({
      status, detail: "Cannot send this reminder",
    });
  }
});
afterEach(() => { globalThis.fetch = originalFetch; });
for (const mealDate of [null, "2026-07-03T15:00:00.123456Z"]) test(`send preserves timestamp ${mealDate} without a retry header`, async () => {
  // SAFETY: the replacement implements the fetch RequestInit/Response boundary used by apiClient.
  globalThis.fetch = (async (url, init) => {
    expect(String(url)).toEndWith("/friendships/friend/split-reminders");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual({ description: "Lunch", mealDate });
    return Response.json({ data: { id: "reminder", status: "OPEN" } }, { status: 201 });
  }) as typeof fetch;
  expect(await splitRemindersApi.send("friend", { description: "Lunch", mealDate })).toEqual({ id: "reminder", status: "OPEN" });
});
