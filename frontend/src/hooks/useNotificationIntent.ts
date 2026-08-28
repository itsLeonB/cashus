import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  persistNotificationContext,
  NotificationContext,
} from "@/lib/notificationPersistence";

/**
 * Hook to detect and persist notification context from URL parameters.
 */
export function useNotificationIntent() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const notificationId = searchParams.get("notification_id");
    const source = searchParams.get("source");

    if (notificationId) {
      const context: NotificationContext = {
        notification_id: notificationId,
        source: source || "deep-link",
      };

      console.log("[NotificationIntent] Detected context in URL:", context);
      persistNotificationContext(context);
    }
  }, [location.search]);
}
