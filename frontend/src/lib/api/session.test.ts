import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { apiClient } from "./client";
import { authApi } from "./auth";
import { session } from "./session";

const originalFetch = globalThis.fetch;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
type TestPayload = string | { csrfToken?: string; name?: string };
const ok = (data: TestPayload = {}) => Response.json({ data });
const fail = (status: number) => Response.json({ title: `HTTP ${status}` }, { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}


function serve(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  // SAFETY: these tests only call fetch with string URLs; Bun's extra fetch members are not used.
  globalThis.fetch = ((url: string, init: RequestInit) => Promise.resolve(handler(url, init))) as typeof fetch;
}
async function login(token = "old") {
  serve(() => ok({ csrfToken: token }));
  await authApi.login({ email: "test@example.com", password: "password" });
}
beforeEach(async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  await login();
});
afterEach(async () => {
  serve(() => ok());
  await authApi.logout();
  globalThis.fetch = originalFetch;
  if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("request/session behavior", () => {
  test("concurrent JSON and multipart requests share refresh and adopt its token", async () => {
    const refresh = deferred<Response>();
    const started = deferred<void>();
    let refreshes = 0;
    const attempts: RequestInit[] = [];
    serve((url, init) => {
      if (url.endsWith("/auth/refresh")) { refreshes++; started.resolve(); return refresh.promise; }
      attempts.push(init);
      return new Headers(init.headers).get("X-CSRF-Token") === "new" ? ok("saved") : fail(401);
    });
    const form = new FormData();
    form.set("file", new Blob(["image"]), "image.png");
    const json = apiClient.post("/items", { amount: 5 });
    const upload = apiClient.uploadFile("/upload", form);
    await started.promise;
    refresh.resolve(ok({ csrfToken: "new" }));
    expect(await Promise.all([json, upload])).toEqual(["saved", "saved"]);
    expect(refreshes).toBe(1);
    expect(attempts).toHaveLength(4);
    for (const attempt of attempts.filter((item) => item.body instanceof FormData)) {
      expect(attempt.body).toBe(form);
      expect(new Headers(attempt.headers).has("Content-Type")).toBe(false);
      expect(attempt.credentials).toBe("include");
    }
    expect(attempts.filter((item) => !(item.body instanceof FormData)).map((item) => item.body))
      .toEqual(['{"amount":5}', '{"amount":5}']);
  });

  for (const status of [0, 500, 429, 403]) {
    test(`refresh failure ${status} settles all callers without losing session; later retry works`, async () => {
      let refreshes = 0;
      serve((url) => {
        if (url.endsWith("/auth/refresh")) {
          refreshes++;
          if (status === 0) return Promise.reject(new TypeError("offline"));
          return fail(status);
        }
        return fail(401);
      });
      const results = await Promise.allSettled([apiClient.get("/a"), apiClient.get("/b")]);
      expect(refreshes).toBe(1);
      for (const result of results) {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason.isRefreshFailure).not.toBe(true);
          if (status === 0) expect(result.reason.isNetworkError).toBe(true);
          else expect(result.reason.status).toBe(status);
        }
      }
      expect(session.token()).toBe("old");
      serve((url) => url.endsWith("/auth/refresh") ? ok({ csrfToken: "recovered" }) :
        session.token() === "recovered" ? ok("done") : fail(401));
      expect(await apiClient.get("/a")).toBe("done");
    });
  }

  test("refresh 401 notifies expiry once, unsubscribe works, and login works in the loaded tab", async () => {
    let notices = 0;
    const unsubscribe = session.subscribe(() => { if (session.read().status === "expired") notices++; });
    serve(() => fail(401));
    const results = await Promise.allSettled([apiClient.get("/a"), apiClient.get("/b")]);
    expect(results.every((result) => result.status === "rejected" && result.reason.isRefreshFailure)).toBe(true);
    expect(session.token()).toBeNull();
    expect(notices).toBe(1);
    unsubscribe();
    await login("fresh-login");
    serve(() => ok({ name: "New user" }));
    expect(await authApi.getProfile()).toEqual({ name: "New user" });
    expect(notices).toBe(1);
  });

  test("explicit auth refresh also reports confirmed expiry", async () => {
    serve(() => fail(401));
    await expect(authApi.refreshToken()).rejects.toMatchObject({ status: 401 });
    expect(session.read().status).toBe("expired");
    expect(session.token()).toBeNull();
  });

  test("bad login does not refresh even after expiry", async () => {
    serve(() => fail(401));
    await apiClient.get("/a").catch(() => {});
    const urls: string[] = [];
    serve((url) => { urls.push(url); return fail(401); });
    await expect(authApi.login({ email: "bad", password: "bad" })).rejects.toMatchObject({ status: 401 });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toEndWith("/auth/login");
  });

  test("late concurrent 401 reuses completed refresh even when the CSRF token is unchanged", async () => {
    const late = deferred<Response>();
    let refreshes = 0;
    let lateCalls = 0;
    let firstCalls = 0;
    serve((url) => {
      if (url.endsWith("/auth/refresh")) { refreshes++; return ok({ csrfToken: "old" }); }
      if (url.endsWith("/late") && ++lateCalls === 1) return late.promise;
      if (url.endsWith("/first") && ++firstCalls === 1) return fail(401);
      return ok("done");
    });
    const slow = apiClient.post("/late", {});
    expect(await apiClient.post("/first", {})).toBe("done");
    late.resolve(fail(401));
    expect(await slow).toBe("done");
    expect(refreshes).toBe(1);
  });

  test("logout sends the old CSRF token and waits for the server response", async () => {
    const response = deferred<Response>();
    let csrf: string | null = null;
    let settled = false;
    serve((_url, init) => { csrf = new Headers(init.headers).get("X-CSRF-Token"); return response.promise; });
    const logout = authApi.logout().then(() => { settled = true; });
    await Promise.resolve();
    expect(csrf).toBe("old");
    expect(settled).toBe(false);
    expect(session.token()).toBeNull();
    response.resolve(ok());
    await logout;
    expect(settled).toBe(true);
  });

  for (const logoutStatus of [200, 500]) {
    test(`login waits for logout HTTP completion (${logoutStatus}) even if its session changes`, async () => {
      const response = deferred<Response>();
      const events: string[] = [];
      let cookie: string | null = "old";
      serve((url) => {
        if (url.endsWith("/auth/logout")) {
          events.push("logout");
          return response.promise.then((result) => { cookie = null; return result; });
        }
        if (url.endsWith("/auth/refresh")) return fail(401);
        events.push("login");
        cookie = "new";
        return ok({ csrfToken: "new" });
      });
      const logout = Promise.allSettled([authApi.logout()]);
      await authApi.refreshToken().catch(() => {});
      const newLogin = authApi.login({ email: "new@example.com", password: "password" });
      for (let tick = 0; tick < 10; tick++) await Promise.resolve();
      const beforeCompletion = [...events];
      response.resolve(logoutStatus === 200 ? ok() : fail(logoutStatus));
      await logout;
      await newLogin;
      expect(beforeCompletion).toEqual(["logout"]);
      expect(events).toEqual(["logout", "login"]);
      expect(cookie).toBe("new");
      expect(session.token()).toBe("new");
    });
  }

  test("a rejected password reset preserves the current session", async () => {
    let notices = 0;
    const unsubscribe = session.subscribe(() => { notices++; });
    serve(() => fail(400));
    try {
      await expect(authApi.resetPassword({ token: "expired", password: "new-password",
        passwordConfirmation: "new-password" })).rejects.toMatchObject({ status: 400 });
      expect(session.token()).toBe("old");
      expect(session.read().status).toBe("present");
      expect(notices).toBe(0);
    } finally { unsubscribe(); }
  });

  test("a replayed 401 stops after one refresh", async () => {
    let refreshes = 0;
    let requests = 0;
    serve((url) => {
      if (url.endsWith("/auth/refresh")) { refreshes++; return ok({ csrfToken: "new" }); }
      requests++; return fail(401);
    });
    await expect(apiClient.get("/a")).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(1);
    expect(requests).toBe(2);
  });

  for (const status of [0, 500]) {
    test(`a write failure ${status} is not replayed`, async () => {
      let calls = 0;
      serve(() => { calls++; return status ? fail(status) : Promise.reject(new Error("offline")); });
      await apiClient.post("/expense", { amount: 10 }).catch(() => {});
      expect(calls).toBe(1);
    });
  }

  for (const transition of ["login", "logout"]) {
    for (const refreshStatus of [200, 401]) {
      test(`pending refresh ${refreshStatus} settles at ${transition} and cannot change the newer session`, async () => {
        const refresh = deferred<Response>();
        const started = deferred<void>();
        serve((url) => {
          if (url.endsWith("/auth/refresh")) { started.resolve(); return refresh.promise; }
          return fail(401);
        });
        const pending = Promise.allSettled([apiClient.get("/a"), apiClient.get("/b")]);
        await started.promise;
        if (transition === "login") await login("new-login");
        else { serve(() => ok()); await authApi.logout(); }
        expect((await pending).every((result) => result.status === "rejected")).toBe(true);
        refresh.resolve(refreshStatus === 200 ? ok({ csrfToken: "stale" }) : fail(401));
        await Promise.resolve();
        await Promise.resolve();
        expect(session.token()).toBe(transition === "login" ? "new-login" : null);
        expect(session.read().status).not.toBe("expired");
      });
    }
  }

  test("late profile response cannot restore data from before login", async () => {
    const profile = deferred<Response>();
    serve(() => profile.promise);
    const old = Promise.allSettled([authApi.getProfile()]);
    await login("new-login");
    expect((await old)[0].status).toBe("rejected");
    profile.resolve(ok({ name: "Old user" }));
    serve(() => ok({ name: "New user" }));
    expect(await authApi.getProfile()).toEqual({ name: "New user" });
  });

  test("initial profile outage is classified without expiry and a retry succeeds", async () => {
    serve(() => fail(503));
    await expect(authApi.getProfile()).rejects.toMatchObject({ status: 503 });
    expect(session.read().status).toBe("present");
    serve(() => ok({ name: "Retry user" }));
    expect(await authApi.getProfile()).toEqual({ name: "Retry user" });
  });
});
