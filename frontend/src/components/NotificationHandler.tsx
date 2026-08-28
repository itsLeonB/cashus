import { useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUnreadNotifications,
  useMarkNotificationAsRead,
} from "@/hooks/useApi";
import { queryKeys } from "@/lib/queryKeys";
import { resolveNotificationRoute } from "@/lib/notificationResolvers";
import {
  getNotificationContext,
  clearNotificationContext,
} from "@/lib/notificationPersistence";

export function NotificationHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationId = searchParams.get("notification_id");
  const lastProcessedId = useRef<string | null>(null);
  const lastRefetchedId = useRef<string | null>(null);

  const {
    data: notifications,
    isSuccess,
    isError,
    error,
    refetch,
    isFetching,
  } = useUnreadNotifications();
  const notification = useMemo(
    () => notifications?.find((n) => n.id === notificationId),
    [notifications, notificationId],
  );

  const markAsRead = useMarkNotificationAsRead(notificationId || "");

  // Restore notificationId from persistence if missing from URL
  useEffect(() => {
    if (!notificationId) {
      const persisted = getNotificationContext();
      if (persisted) {
        console.log(
          "[NotificationHandler] Restoring context from persistence:",
          persisted,
        );
        // Put it back in the URL to trigger the normal flow
        navigate(
          {
            search: `?notification_id=${persisted.notification_id}&source=${persisted.source}`,
          },
          { replace: true },
        );
      }
    }
  }, [notificationId, navigate]);

  // Force refetch if we have an ID but it's not in the list
  useEffect(() => {
    if (
      notificationId &&
      isSuccess &&
      !notification &&
      !isFetching &&
      lastRefetchedId.current !== notificationId
    ) {
      console.log(
        "[NotificationHandler] ID not found in list, forcing refetch...",
      );
      lastRefetchedId.current = notificationId;
      refetch();
    }
  }, [notificationId, isSuccess, notification, isFetching, refetch]);

  useEffect(() => {
    if (
      notificationId &&
      isSuccess &&
      notification &&
      notificationId !== lastProcessedId.current
    ) {
      console.log(
        "[NotificationHandler] Processing notification:",
        notificationId,
        notification,
      );
      lastProcessedId.current = notificationId;

      // Mark as read in the background
      markAsRead.mutate();

      // Resolve route and navigate
      const route = resolveNotificationRoute(notification);
      if (route) {
        console.log("[NotificationHandler] Redirecting to:", route);
        // Clear persistence context as we are now consuming it
        clearNotificationContext();
        navigate(route, { replace: true });
      }
    }
  }, [notificationId, notification, isSuccess, navigate, markAsRead]);

  // Log error if unread notifications fetch fails
  useEffect(() => {
    if (notificationId && isError) {
      console.error(
        "[NotificationHandler] Failed to fetch unread notifications:",
        error,
      );
    }
  }, [notificationId, isError, error]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      console.log("[NotificationHandler] Received SW message:", event.data);
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const id = event.data.notificationId;
        console.log(
          "[NotificationHandler] Eagerly invalidating and navigating to id:",
          id,
        );

        // Eagerly invalidate to trigger fetch immediately
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unread,
        });

        // Set query param to trigger the main effect
        navigate({ search: `?notification_id=${id}` }, { replace: true });
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [navigate, queryClient]);

  return null;
}
