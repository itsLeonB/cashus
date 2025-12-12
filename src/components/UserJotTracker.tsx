import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

declare global {
  interface Window {
    uj?: {
      q: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      init: (projectId: string, options?: any) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      identify: (user: any) => void;
    };
  }
}

export function UserJotTracker() {
  const { profile } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    const projectId = import.meta.env.VITE_USERJOT_PROJECT_ID;

    if (!projectId) {
      console.error("UserJot: VITE_USERJOT_PROJECT_ID is missing");
      return;
    }

    if (initialized.current) {
      return;
    }

    window.uj?.init(projectId, {
      widget: true,
      position: "right",
      theme: "auto",
      trigger: "default",
    });

    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current || !profile || !window.uj) return;

    const fullName =
      typeof profile.name === "string" ? profile.name.trim() : "";
    const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [""];
    const lastName = rest.join(" ");

    window.uj.identify({
      id: profile.id || profile.userId,
      email: profile.email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      avatar: profile.avatar,
    });
  }, [profile]);

  return null;
}
