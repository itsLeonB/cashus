import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import config from "@/config/config";

declare global {
  var uj:
    | {
        q: unknown[];
        init: (projectId: string, options?: Record<string, unknown>) => void;
        identify: (user: {
          id: string | number;
          email: string;
          firstName?: string;
          lastName?: string;
          avatar?: string;
        }) => void;
        showWidget: () => void;
        hideWidget: () => void;
        getWidgetState: () => { isOpen: boolean; section: string | null };
      }
    | undefined;
}

export function useUserJotTracker() {
  const { user } = useAuth();
  const initialized = useRef<boolean>(false);

  useEffect(() => {
    const projectId = config.USERJOT_PROJECT_ID;

    if (!projectId) {
      console.error("UserJot: VITE_USERJOT_PROJECT_ID is missing");
      return;
    }

    if (initialized.current) {
      return;
    }

    globalThis.uj?.init(projectId, {
      widget: true,
      position: "right",
      theme: "auto",
      trigger: "custom",
    });

    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current || !user || !globalThis.uj) return;

    const fullName = typeof user.name === "string" ? user.name.trim() : "";
    const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [""];
    const lastName = rest.join(" ");

    globalThis.uj.identify({
      id: user.id || user.userId,
      email: user.email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      avatar: user.avatar,
    });
  }, [user]);

  useEffect(() => {
    const handlePopState = () => {
      const state = globalThis.uj?.getWidgetState();
      if (state?.isOpen) {
        globalThis.uj?.hideWidget();
      }
    };

    globalThis.addEventListener("popstate", handlePopState);
    return () => {
      globalThis.removeEventListener("popstate", handlePopState);
    };
  }, []);
}
