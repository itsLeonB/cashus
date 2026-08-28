import { defineRailway, github, image, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const cashbackRepo = github("itsLeonB/cashus", { rootDirectory: "backend", checkSuites: false });

  const natsVolume = volume("nats-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "asia-southeast1-eqsg3a", sizeMB: 5000 });
  const cashbackWorker = service("cashback-worker", {
    source: cashbackRepo,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/backend/Dockerfile.worker", watchPatterns: ["/backend/**"] },
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { limitOverride: { containers: { cpu: 0.5, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 3 },
    env: { ADMIN_AUTH_HASH_COST: preserve(), ADMIN_AUTH_ISSUER: preserve(), ADMIN_AUTH_SECRET_KEY: preserve(), ADMIN_AUTH_TOKEN_DURATION: preserve(), APP_BUCKET_NAME_EXPENSE_BILL: preserve(), APP_BUCKET_NAME_TRANSFER_METHODS: preserve(), APP_CLIENT_URLS: preserve(), APP_ENV: preserve(), APP_PORT: preserve(), APP_REGISTER_VERIFICATION_URL: preserve(), APP_RESET_PASSWORD_URL: preserve(), APP_TIMEOUT: preserve(), AUTH_COOKIE_DOMAIN: preserve(), AUTH_COOKIE_SAME_SITE: preserve(), AUTH_COOKIE_SECURE: preserve(), AUTH_HASH_COST: preserve(), AUTH_ISSUER: preserve(), AUTH_REFRESH_TOKEN_DURATION: preserve(), AUTH_SECRET_KEY: preserve(), AUTH_STATE_STORE: preserve(), AUTH_TOKEN_DURATION: preserve(), AUTH_TURNSTILE_SECRET_KEY: preserve(), DB_CONN_MAX_LIFETIME: preserve(), DB_HOST: preserve(), DB_MAX_IDLE_CONNS: preserve(), DB_MAX_OPEN_CONNS: preserve(), DB_NAME: preserve(), DB_PASSWORD: preserve(), DB_PORT: preserve(), DB_USER: preserve(), FLAG_CLIENT_KEY: preserve(), FLAG_SUBSCRIPTION_PURCHASE_ENABLED: preserve(), GOOGLE_SERVICE_ACCOUNT: preserve(), LANGFUSE_BASE_URL: preserve(), LANGFUSE_PUBLIC_KEY: preserve(), LANGFUSE_SECRET_KEY: preserve(), LLM_API_KEY: preserve(), LLM_BASE_URL: preserve(), LLM_MODEL: preserve(), MAIL_API_KEY: preserve(), MAIL_SENDER_MAIL: preserve(), MAIL_SENDER_NAME: preserve(), NATS_STATE_STORE_BUCKET: preserve(), NATS_URL: preserve(), OAUTH_GOOGLE_CLIENT_ID: preserve(), OAUTH_GOOGLE_CLIENT_SECRET: preserve(), OAUTH_GOOGLE_REDIRECT_URL: preserve(), OTEL_ENABLED: preserve(), OTEL_EXPORTER_OTLP_ENDPOINT: preserve(), OTEL_EXPORTER_OTLP_PROTOCOL: preserve(), OTEL_GO_X_CARDINALITY_LIMIT: preserve(), OTEL_LOGS_EXPORTER: preserve(), OTEL_METRICS_EXPORTER: preserve(), OTEL_RESOURCE_ATTRIBUTES: preserve(), OTEL_SERVICE_NAME: preserve(), OTEL_TRACES_EXPORTER: preserve(), PAYMENT_CANCEL_URL: preserve(), PAYMENT_SERVER_KEY: preserve(), PAYMENT_SUCCESS_URL: preserve(), PAYMENT_WEBHOOK_SECRET: preserve(), PUSH_VAPID_PRIVATE_KEY: preserve(), PUSH_VAPID_PUBLIC_KEY: preserve(), PUSH_VAPID_SUBJECT: preserve() },
  });
  const cashback = service("cashback", {
    source: cashbackRepo,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/backend/Dockerfile", watchPatterns: ["/backend/**"] },
    healthcheck: "/ping",
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { limitOverride: { containers: { cpu: 0.5, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 3, sleepApplication: true },
    domains: ["api.cashus.online"],
    env: { ADMIN_AUTH_HASH_COST: preserve(), ADMIN_AUTH_ISSUER: preserve(), ADMIN_AUTH_SECRET_KEY: preserve(), ADMIN_AUTH_TOKEN_DURATION: preserve(), APP_BUCKET_NAME_EXPENSE_BILL: preserve(), APP_BUCKET_NAME_TRANSFER_METHODS: preserve(), APP_CLIENT_URLS: preserve(), APP_ENV: preserve(), APP_PORT: preserve(), APP_REGISTER_VERIFICATION_URL: preserve(), APP_RESET_PASSWORD_URL: preserve(), APP_TIMEOUT: preserve(), AUTH_COOKIE_DOMAIN: preserve(), AUTH_COOKIE_SAME_SITE: preserve(), AUTH_COOKIE_SECURE: preserve(), AUTH_HASH_COST: preserve(), AUTH_ISSUER: preserve(), AUTH_REFRESH_TOKEN_DURATION: preserve(), AUTH_SECRET_KEY: preserve(), AUTH_STATE_STORE: preserve(), AUTH_TOKEN_DURATION: preserve(), AUTH_TURNSTILE_SECRET_KEY: preserve(), DB_CONN_MAX_LIFETIME: preserve(), DB_HOST: preserve(), DB_MAX_IDLE_CONNS: preserve(), DB_MAX_OPEN_CONNS: preserve(), DB_NAME: preserve(), DB_PASSWORD: preserve(), DB_PORT: preserve(), DB_USER: preserve(), FLAG_CLIENT_KEY: preserve(), FLAG_SUBSCRIPTION_PURCHASE_ENABLED: preserve(), GOOGLE_SERVICE_ACCOUNT: preserve(), LANGFUSE_BASE_URL: preserve(), LANGFUSE_PUBLIC_KEY: preserve(), LANGFUSE_SECRET_KEY: preserve(), LLM_API_KEY: preserve(), LLM_BASE_URL: preserve(), LLM_MODEL: preserve(), MAIL_API_KEY: preserve(), MAIL_SENDER_MAIL: preserve(), MAIL_SENDER_NAME: preserve(), NATS_STATE_STORE_BUCKET: preserve(), NATS_URL: preserve(), OAUTH_GOOGLE_CLIENT_ID: preserve(), OAUTH_GOOGLE_CLIENT_SECRET: preserve(), OAUTH_GOOGLE_REDIRECT_URL: preserve(), OTEL_ENABLED: preserve(), OTEL_EXPORTER_OTLP_ENDPOINT: preserve(), OTEL_EXPORTER_OTLP_PROTOCOL: preserve(), OTEL_GO_X_CARDINALITY_LIMIT: preserve(), OTEL_LOGS_EXPORTER: preserve(), OTEL_METRICS_EXPORTER: preserve(), OTEL_RESOURCE_ATTRIBUTES: preserve(), OTEL_SERVICE_NAME: preserve(), OTEL_TRACES_EXPORTER: preserve(), PAYMENT_CANCEL_URL: preserve(), PAYMENT_SERVER_KEY: preserve(), PAYMENT_SUCCESS_URL: preserve(), PAYMENT_WEBHOOK_SECRET: preserve(), PUSH_VAPID_PRIVATE_KEY: preserve(), PUSH_VAPID_PUBLIC_KEY: preserve(), PUSH_VAPID_SUBJECT: preserve() },
  });
  const otelCollector = service("otel-collector", {
    source: github("itsLeonB/cashus", { rootDirectory: "/backend/otel" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/backend/otel/Dockerfile", watchPatterns: ["/backend/otel/**"] },
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { limitOverride: { containers: { cpu: 0.5, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 3 },
    env: { GRAFANA_OTLP_ENDPOINT: preserve(), GRAFANA_OTLP_TOKEN: preserve() },
  });
  const nats = service("nats", {
    source: image("nats:latest"),
    start: "nats-server -js -sd /data",
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { limitOverride: { containers: { cpu: 0.5, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 3 },
    volumeMounts: { "/data": natsVolume },
  });
  const cashbackJob = service("cashback-job", {
    source: cashbackRepo,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/backend/Dockerfile.job", watchPatterns: ["/backend/**"] },
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { limitOverride: { containers: { cpu: 0.5, memoryBytes: 500000000 } }, restartPolicyType: "NEVER", sleepApplication: true },
    env: { ADMIN_AUTH_HASH_COST: preserve(), ADMIN_AUTH_ISSUER: preserve(), ADMIN_AUTH_SECRET_KEY: preserve(), ADMIN_AUTH_TOKEN_DURATION: preserve(), APP_BUCKET_NAME_EXPENSE_BILL: preserve(), APP_BUCKET_NAME_TRANSFER_METHODS: preserve(), APP_CLIENT_URLS: preserve(), APP_ENV: preserve(), APP_PORT: preserve(), APP_REGISTER_VERIFICATION_URL: preserve(), APP_RESET_PASSWORD_URL: preserve(), APP_TIMEOUT: preserve(), AUTH_COOKIE_DOMAIN: preserve(), AUTH_COOKIE_SAME_SITE: preserve(), AUTH_COOKIE_SECURE: preserve(), AUTH_HASH_COST: preserve(), AUTH_ISSUER: preserve(), AUTH_REFRESH_TOKEN_DURATION: preserve(), AUTH_SECRET_KEY: preserve(), AUTH_STATE_STORE: preserve(), AUTH_TOKEN_DURATION: preserve(), AUTH_TURNSTILE_SECRET_KEY: preserve(), DB_CONN_MAX_LIFETIME: preserve(), DB_HOST: preserve(), DB_MAX_IDLE_CONNS: preserve(), DB_MAX_OPEN_CONNS: preserve(), DB_NAME: preserve(), DB_PASSWORD: preserve(), DB_PORT: preserve(), DB_USER: preserve(), FLAG_CLIENT_KEY: preserve(), FLAG_SUBSCRIPTION_PURCHASE_ENABLED: preserve(), GOOGLE_SERVICE_ACCOUNT: preserve(), LANGFUSE_BASE_URL: preserve(), LANGFUSE_PUBLIC_KEY: preserve(), LANGFUSE_SECRET_KEY: preserve(), LLM_API_KEY: preserve(), LLM_BASE_URL: preserve(), LLM_MODEL: preserve(), MAIL_API_KEY: preserve(), MAIL_SENDER_MAIL: preserve(), MAIL_SENDER_NAME: preserve(), NATS_STATE_STORE_BUCKET: preserve(), NATS_URL: preserve(), OAUTH_GOOGLE_CLIENT_ID: preserve(), OAUTH_GOOGLE_CLIENT_SECRET: preserve(), OAUTH_GOOGLE_REDIRECT_URL: preserve(), OTEL_ENABLED: preserve(), OTEL_EXPORTER_OTLP_ENDPOINT: preserve(), OTEL_EXPORTER_OTLP_PROTOCOL: preserve(), OTEL_GO_X_CARDINALITY_LIMIT: preserve(), OTEL_LOGS_EXPORTER: preserve(), OTEL_METRICS_EXPORTER: preserve(), OTEL_RESOURCE_ATTRIBUTES: preserve(), OTEL_SERVICE_NAME: preserve(), OTEL_TRACES_EXPORTER: preserve(), PAYMENT_CANCEL_URL: preserve(), PAYMENT_SERVER_KEY: preserve(), PAYMENT_SUCCESS_URL: preserve(), PAYMENT_WEBHOOK_SECRET: preserve(), PUSH_VAPID_PRIVATE_KEY: preserve(), PUSH_VAPID_PUBLIC_KEY: preserve(), PUSH_VAPID_SUBJECT: preserve() },
  });

  return project("cashus-backend", {
    resources: [cashbackWorker, cashback, otelCollector, nats, cashbackJob, natsVolume],
  });
});
