import { describe, test, expect, beforeEach } from "bun:test";
import {
  persistNotificationContext,
  getNotificationContext,
  clearNotificationContext,
} from "./notificationPersistence";

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },

    // Below are unused but required for the type
    length: 0,
    key: () => "",
  };
})();

globalThis.sessionStorage = sessionStorageMock;

describe("Notification Persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearNotificationContext();
  });

  test("should persist and retrieve notification context in memory", () => {
    const context = { notification_id: "123", source: "push" };
    persistNotificationContext(context);

    expect(getNotificationContext()).toEqual(context);
    expect(sessionStorage.getItem("cashus_notification_context")).toBe(
      JSON.stringify(context),
    );
  });

  test("should retrieve from sessionStorage if memory is cleared", () => {
    const context = { notification_id: "456", source: "deep-link" };

    // Simulate initial save
    persistNotificationContext(context);

    // Manually clear memory context (internal variable) by calling clear,
    // but then we need to put it back into sessionStorage to simulate a page reload
    clearNotificationContext();
    sessionStorage.setItem(
      "cashus_notification_context",
      JSON.stringify(context),
    );

    const retrieved = getNotificationContext();
    expect(retrieved).toEqual(context);
  });

  test("should clear both memory and sessionStorage", () => {
    const context = { notification_id: "789", source: "cold-start" };
    persistNotificationContext(context);

    clearNotificationContext();

    expect(getNotificationContext()).toBeNull();
    expect(sessionStorage.getItem("cashus_notification_context")).toBeNull();
  });
});
