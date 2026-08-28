/**
 * Centralized route resolver for notifications.
 * Maps notification type + entityId to application routes.
 */

import { Notification } from "./api/notifications";

type NotificationConfig = {
  route: (notification: Notification) => string;
};

const notificationConfigs: Record<string, NotificationConfig> = {
  "debt-created": {
    route: (notification) => {
      const metadata = notification.metadata;
      if (metadata["friendshipId"]) {
        return `/friends/${metadata["friendshipId"]}`;
      }
      return "/friends";
    },
  },

  "friend-request-received": {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    route: (_) => "/friends?tab=requests",
  },

  "friendship-created": {
    route: (notification) => `/friends/${notification.entityId}`,
  },

  "expense-confirmed": {
    route: (notification) => `/expenses/${notification.entityId}`,
  },
};

/**
 * Resolves a notification to an application route.
 * Returns the appropriate route based on notification type and entity ID.
 * Falls back to dashboard for unknown notification types.
 */
export function resolveNotificationRoute(notification: Notification): string {
  return (
    notificationConfigs[notification.type]?.route(notification) || "/dashboard"
  );
}
