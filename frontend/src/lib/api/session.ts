import type { ApiError } from "./types";

export const SESSION_EXPIRED_ERROR: ApiError = {
  type: "about:blank", title: "Session Expired", detail: "Session expired",
  status: 401, isRefreshFailure: true,
};
const SESSION_CHANGED_ERROR: ApiError = {
  type: "about:blank", title: "Session Changed", detail: "The session changed. Try again.",
};
let snapshot = { generation: 0, status: globalThis.localStorage?.getItem("csrfToken") ? "present" : "anonymous" };
const listeners = new Set<() => void>();

export const session = {
  read: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  token: () => globalThis.localStorage?.getItem("csrfToken") ?? null,
  change(status = "anonymous") {
    globalThis.localStorage?.removeItem("csrfToken");
    snapshot = { generation: snapshot.generation + 1, status };
    listeners.forEach((listener) => listener());
    return snapshot.generation;
  },
  adopt(token: string, generation: number) {
    session.check(generation);
    globalThis.localStorage?.setItem("csrfToken", token);
    if (snapshot.status !== "present") {
      snapshot = { ...snapshot, status: "present" };
      listeners.forEach((listener) => listener());
    }
  },
  check(generation: number) {
    if (snapshot.generation !== generation) {
      throw snapshot.status === "expired" ? SESSION_EXPIRED_ERROR : SESSION_CHANGED_ERROR;
    }
  },
  async guard<T>(generation: number, work: Promise<T>): Promise<T> {
    let unsubscribe = () => {};
    const changed = new Promise<never>((_resolve, reject) => {
      unsubscribe = session.subscribe(() => {
        try { session.check(generation); } catch (error) { reject(error); }
      });
      try { session.check(generation); } catch (error) { reject(error); }
    });
    try { return await Promise.race([work, changed]); }
    finally { unsubscribe(); }
  },
};
