export default {
  APP_NAME: "Cashus" as const,
  APP_VERSION: "0.1.0" as const,
  APP_ENV: import.meta.env.VITE_APP_ENV || ("development" as const),
  SITE_URL: import.meta.env.VITE_SITE_URL || "https://cashus.online",
  API_BASE_URL:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  FARO_COLLECTOR_URL: import.meta.env.VITE_FARO_COLLECTOR_URL,
  FLAGSMITH_ENVIRONMENT_ID: import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID,
  SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || "support@cashus.app",
  SUBSCRIPTION_PURCHASE_ENABLED:
    import.meta.env.VITE_SUBSCRIPTION_PURCHASE_ENABLED === "true",
  TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  USERJOT_PROJECT_ID: import.meta.env.VITE_USERJOT_PROJECT_ID,
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
} as const;
