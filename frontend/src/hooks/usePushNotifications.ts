import { useState, useEffect } from "react";
import { useSubscribeToPush } from "./useApi";
import { urlBase64ToUint8Array } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import config from "@/config/config";

export function usePushNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { mutateAsync: subscribeToApi, isPending: isSubscribing } =
    useSubscribeToPush();
  const { toast } = useToast();

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in globalThis) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const enableNotifications = async () => {
    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Not supported",
        description: "Push notifications are not supported in this browser.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        const registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const vapidKey = config.VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            throw new Error("VAPID public key not found");
          }

          const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }

        // Send subscription to backend
        await subscribeToApi(subscription.toJSON());
        toast({
          title: "Notifications enabled",
          description: "You will now receive push notifications.",
        });
      } else if (result === "denied") {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings.",
        });
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to enable notifications.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    permission,
    isSupported,
    enableNotifications,
    isSubscribing,
    isLoading: isLoading || isSubscribing,
  };
}
