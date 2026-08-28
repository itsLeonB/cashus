/**
 * Utility for persisting notification context across authentication flows.
 * This ensures that deep-link or push notification intent is not lost
 * during token refreshes or re-authentication.
 */

export type NotificationSource =
  | "push"
  | "deep-link"
  | "cold-start"
  | (string & Record<never, never>);

export interface NotificationContext {
  notification_id: string;
  source: NotificationSource;
}

const STORAGE_KEY = "cashus_notification_context";

// In-memory persistence
let memoryContext: NotificationContext | null = null;

/**
 * Persists the notification context to memory and sessionStorage.
 */
export function persistNotificationContext(context: NotificationContext): void {
  // Save to memory
  memoryContext = context;

  // Save to durable storage (sessionStorage survives refreshes but not tab close)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch (error) {
    console.error(
      "Failed to persist notification context to sessionStorage:",
      error,
    );
  }
}

/**
 * Retrieves the notification context from memory or sessionStorage.
 */
export function getNotificationContext(): NotificationContext | null {
  // Try memory first
  if (memoryContext) {
    return memoryContext;
  }

  // Fallback to sessionStorage
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as NotificationContext;
      // Sync memory state
      memoryContext = parsed;
      return parsed;
    }
  } catch (error) {
    console.error(
      "Failed to retrieve notification context from sessionStorage:",
      error,
    );
  }

  return null;
}

/**
 * Clears the notification context from memory and sessionStorage.
 * Should be called after the context has been successfully consumed.
 */
export function clearNotificationContext(): void {
  memoryContext = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error(
      "Failed to clear notification context from sessionStorage:",
      error,
    );
  }
}
