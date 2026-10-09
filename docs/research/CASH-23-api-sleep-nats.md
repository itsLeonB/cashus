# CASH-23: why the `cashback` API never sleeps, and the smallest fix

Changelog: 2026-10-08 update. Folded in the user-supplied production and development config (section 2.1), resolved former open questions 3 and 4, and re-checked everything against primary sources. One earlier claim was wrong and is corrected: nats-server does not enable TCP keepalive on client sockets, so only the API-side nats.go dialer probes (4.2, 4.3). New findings: `OTEL_ENABLED=false` removes every OTel exporter in this repo (4.5), `nats:latest` resolves to v2.15.0 today (4.8), the Vision gRPC client dials at boot and can emit keepalive probes for up to 30 min (4.7), and Railway also lists "receiving traffic" as a blocker (section 3). Confidence in "OTel env change plus (b) reaches Sleeping" is lowered from about 65% to about 50% (section 9).

Changelog: 2026-10-08 second update, from facts the user verified. (1) The bare host `otel-collector:4318` resolves to the `otel-collector` private service and is the same as `otel-collector.railway.internal:4318`, so production metrics POSTs do reach the collector (4.5, former open question 4 closed). (2) PR environments are based on development, not production, so preview runs with `OTEL_ENABLED=false`; the claim in `docs/deployment/preview-environments.md` that production is cloned is stale (2.1, former open question 6 narrowed). (3) Experiment assumption: dev and preview environments receive no inbound traffic unless the user or an agent sends it, so inbound public traffic is no longer a suspect in those environments (4.7, 7.1). Still open in this area: whether Serverless is turned on in dev and in the PR environment.

Results update, 2026-10-09: the CASH-24 spike ran the experiments in section 7 in two throwaway Railway PR environments. Measured results and the answers to the five spike questions are in section 7.5, and they supersede the predictions in sections 4 to 9 wherever they differ (notably: the kernel keepalive question is settled, the Vision channel is not a 30 min blocker, and sleep restarts the process on wake). The rest of this document is the desk research as written before any run. Everything labelled "Verified" below is read from primary source and is unchanged.

Desk research only (as of 2026-10-08, before the runs): no experiment had been run, no Railway resource was touched, and no code was changed. Everything labelled "Verified" is read from primary source at the pinned version (or, for the 2026-10-08 additions, at the tag or digest named in the row). Config values in section 2.1 were supplied by the user and not read from Railway. Everything labelled "Inference" or "Prediction" is reasoning from those facts and still needs the live runs in section 7.

Sources and version pins are listed at the end (section 11). Local line numbers refer to `backend/` in this repo at `main` (4938436).

## 1. TL;DR

1. Several independent sources can keep the API awake, and any one alone is enough. The ticket's lead hypothesis (NATS PING) is real but is not the only blocker, and which blocker applies differs between production and preview.
   - OTel metrics (production only): with `OTEL_ENABLED=true` and `OTEL_METRICS_EXPORTER=otlp` the periodic reader exports every 60 s even with no data. Nothing in the repo or the supplied config sets `OTEL_METRIC_EXPORT_INTERVAL`, so the 60 s default applies. In dev and preview `OTEL_ENABLED=false` makes `InitSDK` return before any provider, reader or exporter is created, so this blocker is absent there (4.5).
   - NATS (production and preview): `ProvideNATSConn` opens the connection eagerly at boot with no options in every environment, independent of `AUTH_STATE_STORE` (that flag only decides whether a KV bucket is created). The client PINGs every 2 min, the server PINGs any silent client every 2 min, and the API-side Go dialer sends TCP keepalive probes every 15 s once the socket is idle. Correction to the earlier draft: nats-server disables TCP keepalive on its client listener, so probes come from the API side only (4.2, 4.3).
   - New candidate: the Cloud Vision gRPC client dials at boot and its channel only goes idle after 30 min, with Go's 15 s keepalive in the meantime (4.7). Unverified whether this matters.
   - Bounded, not a blocker by itself: the Postgres pool closes idle connections once they pass `ConnMaxLifetime` (default 5 m, production value unknown) (4.7).
2. Fix (a), keepalive tuning, is now feasible on paper but still not recommended. The API-side kernel keepalive can be switched off with a client dialer option, but the server still PINGs a silent client and the client's PONG is outbound, and the server `ping_interval` has no CLI flag and needs a config file on a `FROM scratch` image. That edits the `nats` service, which the ticket puts out of scope, and it does nothing for the Vision channel or the Postgres pool.
3. Fix (b), idle-close with lazy reconnect, removes the NATS socket entirely, so it is immune to PING timing and kernel keepalive. It is a medium change, not a one-liner, because `InitializeProviders` is shared with the worker and `*nats.Conn` / `jetstream.JetStream` / `jetstream.KeyValue` handles all die with the connection.
4. `nats:latest` resolves to v2.15.0 today (4.8). Ping and keepalive behaviour is identical from v2.10.0 to v2.15.0, so the exact version does not change the sleep analysis. The floating tag is a separate operational risk (4.8).
5. Recommendation: in production, OTel env change on the API service first, plus (b) scoped to the API only, and check the Vision channel in the first experiment run. Reject (a). Confidence: high on the blockers, about 50% that these changes alone reach Sleeping within 10 minutes of the last request (section 9). In preview the first thing to run is the zero-change baseline (R0 in 7.2), because OTel is already off there.

## 2. Repo facts (Verified)

| Fact | Where |
|---|---|
| `cashback` has `sleepApplication: true`, healthcheck `/ping`, one replica | `backend/.railway/railway.ts:14-22` (flag at line 19) |
| `nats` runs `nats:latest` with CLI flags only: `nats-server -js -sd /data` | `backend/.railway/railway.ts:30-36` |
| `nats:latest` is a `FROM scratch` image (no shell) with `ENTRYPOINT ["/nats-server"]` and a baked default `nats-server.conf`. `railway.ts` overrides `CMD`, so the baked config is not loaded. `latest` resolves to v2.15.0 as of 2026-10-08 (section 4.8) | https://github.com/nats-io/nats-docker/blob/0e72748d3cb553ccdb8c2da7c75ec3b767be51a5/2.15.x/scratch/Dockerfile (the release commit for v2.15.0), https://github.com/docker-library/official-images/blob/master/library/nats |
| One eager `nats.Connect(config.Global.Url)` with no options at startup; cleanup is `nc.Drain()` | `internal/provider/core_service_provider.go:104-118` |
| `jetstream.New(nc)` right after, then `NewStateStore(js)` and `NewNATSTaskQueue(js)` | `core_service_provider.go:120-156` |
| State store `nats` calls `CreateOrUpdateKeyValue` at startup (bucket `state-store`, `LimitMarkerTTL` 10 min); default is `inmemory`, and `.env.example` sets `AUTH_STATE_STORE=inmemory`. The NATS connection itself is opened by `ProvideNATSConn` before this runs and does not depend on this flag | `internal/core/service/store/state_store.go:19-35`, `internal/core/config/auth_config.go:14`, `backend/.env.example:16` |
| API only publishes via `js.Publish` (sync, waits for ack) and uses `kv.Create`/`Get`/`Delete`; no subscriptions, no watchers | `internal/adapters/core/service/queue/nats_client.go:33`, `internal/adapters/core/service/store/nats_kv_state_store.go:27,40,48` |
| `AsyncEnqueue` spawns a detached goroutine with a 5 s timeout, so a publish can start after the HTTP response is sent | `nats_client.go:44-60` |
| The wire graph is shared by API, worker and job. `CoreServices` exposes `NATSConn` and `JetStream` fields. Only the worker reads `providers.JetStream` (`subscribers.go:21`, `CreateOrUpdateStream("TASKS")`); `NATSConn` has no reader outside the provider | `internal/provider/wire_gen.go:36-60`, `internal/adapters/worker/worker.go:21`, `internal/adapters/worker/subscriber/subscribers.go:19-30` |
| OTel is initialised in `main` via `autoexport` (`NewMetricReader`, `NewLogExporter`, `NewSpanExporter`), metrics via `sdkmetric.NewMeterProvider(WithReader(reader))`, spans via `WithBatcher`, logs via `NewBatchProcessor`. No interval options are passed; `Enabled` defaults to false | `internal/core/otel/otel.go:20-90`, `internal/core/config/otel_config.go` |
| `.env.example` shows the intended OTel env (`OTEL_ENABLED=true`, endpoint `http://otel-collector.railway.internal:4318`). The actual production values were later supplied by the user and differ in the endpoint host (bare `otel-collector`, which the user confirmed resolves to the same private service as `otel-collector.railway.internal`); see section 2.1 | `backend/.env.example:73-82` |
| Other tickers in the API process (`cache.go:93`, `in_memory_state_store.go:61`, `ratelimit.go:66`) are in-memory cleanup only and make no network calls; no scheduler runs in the API (cron lives in `adapters/worker/scheduler`) | grep of `internal/` |
| `OTEL_ENABLED` defaults to false; `InitSDK` returns a no-op shutdown immediately when it is false, before `autoexport` or any provider is created. `OTEL_METRIC_EXPORT_INTERVAL` is not set anywhere in the repo (grep of the whole tree) and is not among the env names in `railway.ts` | `internal/core/otel/otel.go:23-26`, `internal/core/config/otel_config.go:3-6`, `backend/.railway/railway.ts` |
| HTTP instrumentation is `kroma-labs/sentinel-go` v0.3.4 middleware (`Tracing`, `Metrics`), which defaults to `otel.GetMeterProvider()` / `otel.GetTracerProvider()` captured when the config is built (after `InitSDK` in `main`); there is no otelgin, otelgorm or runtime instrumentation in `go.mod` or `internal/` | `internal/adapters/http/setup_sentinel.go:43-60`, `sentinel-go@v0.3.4/httpserver/metrics.go:25-56`, `middleware_tracing.go:17-38` |
| Cloud Vision client: `vision.NewImageAnnotatorClient` at boot, via `gtransport.DialPool`, which uses `grpc.DialContext` and so leaves idle mode at the end of the call (connects at boot) | `internal/core/service/ocr/ocr_service.go:23-30`, `google.golang.org/api@v0.287.1/transport/grpc/dial.go:51,380-382`, `grpc@v1.82.1/clientconn.go:269-292` |
| GCS client: `storage.NewClient` (HTTP/JSON, lazy) and Langfuse/LLM/mail/webpush are plain on-demand HTTP clients; no background goroutine or ticker in any of them | `internal/core/service/storage/storage_repository.go:36-43`, `internal/core/service/langfuse/langfuse_client.go` (no `go`/ticker) |
| Postgres: GORM + pgx v5.10.0, `Ping()` once at boot, `SetConnMaxLifetime(cfg.ConnMaxLifetime)` (default `5m`), `SetMaxIdleConns(5)`, no `ConnMaxIdleTime`; pgx uses a plain `net.Dialer{}` (Go default keepalive) | `internal/provider/datasource/sql_data_source.go:41-50`, `internal/core/config/db_config.go`, `pgx/v5@v5.10.0/pgconn/config.go:978-981` |
| `docs/deployment/preview-environments.md` says Railway clones production services into the PR environment, and the workflow only overrides `DB_*` on `cashback`/`cashback-worker`/`cashback-job`. It does not mention sleeping. The user has since verified that PR environments are based on development, not production, so the "cloned from production" wording is stale (not edited here) | `docs/deployment/preview-environments.md`, "What gets provisioned per PR" item 2 |

### 2.1 Runtime config supplied by the user (2026-10-08, not verified against Railway)

| Variable | Production | Development (preview environments inherit from this) |
|---|---|---|
| `AUTH_STATE_STORE` | `nats` | `nats` |
| `OTEL_ENABLED` | `true` | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` | same |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | same |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment=production,service.instance.id=railway-prod` | `deployment.environment=development,service.instance.id=railway-dev` |
| `OTEL_GO_X_CARDINALITY_LIMIT` | `256` | same |
| `OTEL_LOGS_EXPORTER`, `OTEL_METRICS_EXPORTER`, `OTEL_TRACES_EXPORTER` | `otlp` | `otlp` (ignored while `OTEL_ENABLED=false`, 4.5) |
| `nats` image | `nats:latest` | `nats:latest` |

Preview inheritance (resolved 2026-10-08): the user verified that PR environments are based on development, not production, so a PR environment runs with the development column above (`OTEL_ENABLED=false`, `AUTH_STATE_STORE=nats`, `nats:latest`). `docs/deployment/preview-environments.md` still says Railway clones the production services into the PR environment; that sentence is stale and the user's check wins. Railway's own page does not say what a PR environment copies (section 3), so this rests on the user's verification, not on a primary doc. Not supplied: `DB_CONN_MAX_LIFETIME`, `OTEL_SERVICE_NAME`, `NATS_URL`, and whether Serverless is on in dev and in the PR environment's `cashback`.

Traffic assumption for the experiments (user, 2026-10-08): dev and preview environments receive no inbound traffic unless the user or an agent sends it. Inbound public traffic is therefore not an unknown in those environments; any request in a run is one we sent.

## 3. Railway semantics (Verified)

Source: https://docs.railway.com/deployments/serverless (the old URL `/reference/app-sleeping` renders the same page, now titled "Serverless").

- Inactivity is "any outbound packets, which could include network requests, database connections, or even NTP. Once a service stops sending packets it is considered inactive after 5 minutes. Inactivity is sampled on an interval rather than measured continuously, so in practice a service sleeps somewhere between 5 and 10 minutes after its last outbound traffic." (section "Inactive service detection")
- Listed blockers include telemetry, open database connections, and "Making requests to other services in the same project over the private network". Private-network traffic "won't appear in the metrics tab. However, it's still counted as outbound traffic". (same section)
- "Inbound requests are not measured directly, but anything your service sends in response to them is". (section "Caveats")
- Wake: "A service is woken when it receives traffic from the internet or from another service in the same project through the private network." (section "Waking a service up")
- "Serverless is applied to a container when that container is created. Enabling it on a running service does not affect the container already running; the service must be deployed before it takes effect." (section "Applying the setting")
- The first request after sleep has extra latency and "may return a 502 Bad Gateway response". (section "Caveats")
- The healthcheck is deploy-time only: "not used for continuous monitoring as it is only called at the start of the deployment". `/ping` therefore does not keep the API awake. Source: https://docs.railway.com/deployments/healthchecks
- The same list of blockers also contains, verbatim: "Keeping active database connections open, such as a database connection pooler.", "Making requests to other Railway services over the public internet.", "Making requests to external services over the public internet.", "Receiving traffic from other services in the same project over the private network.", "Receiving traffic from other Railway services over the public internet.", "Receiving traffic from external services over the public internet." (re-verified 2026-10-08, same page and section). So inbound traffic is listed as a blocker as well.
- Tension in the docs, not resolved here: the blocker list says receiving traffic keeps a service awake, while the Caveats section says inbound requests "are not measured directly, but anything your service sends in response to them is". Either reading leaves NATS exchanges counted, because every server PING draws a client PONG. It also means public internet traffic to `api.cashus.online` (scanners, uptime monitors, frontend polling) counts in production, where it cannot be controlled. In dev and preview the user states there is no inbound traffic except what the user or an agent sends (2.1), so the experiments only need to avoid sending any during the observation window.
- Telemetry is named as a blocker ("Frameworks that report telemetry to their respective services, such as Next.js."), but only as an example; the page gives no cadence.
- Private networking: the docs give the form `SERVICE_NAME.railway.internal` (example `http://api.railway.internal:PORT`) and say "Each environment has its own isolated network." They say nothing about bare service names (`otel-collector`), search domains, idle connections or keepalives. Source: https://docs.railway.com/networking/private-networking and https://docs.railway.com/networking/private-networking/how-it-works. The docs do not cover the bare form; the user has confirmed that `otel-collector` resolves to the private service `otel-collector`, identical to `otel-collector.railway.internal` (user-verified, not a Railway-documented guarantee). Either way the request counts as private-network outbound traffic (above).
- Environments: "PR Environments are temporary. They are created when a Pull Request is opened on a branch and are deleted as soon as the PR is merged or closed." and "Focused PR Environments only deploy services affected by files changed in the pull request." The page does not say what is copied from the base environment or whether Serverless settings carry over. The repo's own `preview-environments.md` says production is cloned, but the user verified the PR environment is based on development (2.1). Source: https://docs.railway.com/environments. If focused PR environments are enabled, a PR that touches only `backend/**` may still skip `nats`, so confirm it is deployed in the PR environment.
- Docker image services: "For unversioned tags such as `nginx:latest`, Railway redeploys the existing tag to pull the latest digest", and Railway "automatically monitors Docker images for new versions" with optional automatic updates on a schedule and maintenance window; updates trigger a redeployment, "which may cause brief downtime for services with attached volumes". The page does not say whether an ordinary redeploy or restart re-pulls a floating tag. Source: https://docs.railway.com/services.
- Not documented: whether sleep stops and restarts the process or freezes it, and whether kernel TCP keepalive probes or their ACKs count as "outbound packets". Both matter below. TCP keepalive, persistent connections and preview environments are not mentioned on the Serverless page at all.

## 4. What generates outbound traffic (Verified from source, then Inference)

### 4.1 OTel (Verified)

| Signal | Behaviour | Source |
|---|---|---|
| Metrics | `PeriodicReader` ticks every 60 s (`defaultInterval = 60000 ms`, override `OTEL_METRIC_EXPORT_INTERVAL`, value in milliseconds). Every tick calls `collectAndExport`, which calls `exporter.Export` with no emptiness check | `otel/sdk/metric@v1.45.0/periodic_reader.go:24-25,194-210,242-262`, `env.go:17,24-38` |
| Metrics, wire level | `otlpmetrichttp` `Export` transforms and always calls `UploadMetrics`, which POSTs the (possibly empty) `ExportMetricsServiceRequest` | `otlpmetrichttp@v1.44.0/exporter.go:71-78`, `client.go:147-165` |
| Metrics, repo wiring | `autoexport` builds `NewPeriodicReader` with only producer options, so env intervals apply; `OTEL_METRICS_EXPORTER=none` yields a no-op reader | `contrib/exporters/autoexport@v0.69.0/metrics.go:104-136,157-159` |
| Traces | `BatchSpanProcessor` schedule delay 5 s, but `exportSpans` only exports `if l := len(bsp.batch); l > 0` | `otel/sdk@v1.45.0/trace/batch_span_processor.go:25,exportSpans` |
| Logs | `BatchProcessor` polls every 1 s (`dfltExpInterval`), but `EnqueueExport` returns early for zero records | `otel/sdk/log@v0.20.0/batch.go:19`, `exporter.go:236-240` |
| Logger bridge | `ezutil/v2` `otel.Init` emits a record per log call; no periodic log source exists in the API | `ezutil/v2@v2.4.0/otel/otel.go` |

Defaults per the specification, which the SDK versions pinned in `backend/go.mod` match (`sdk` v1.45.0, `sdk/metric` v1.45.0, `sdk/log` v0.20.0): `OTEL_METRIC_EXPORT_INTERVAL` 60000 ms, `OTEL_METRIC_EXPORT_TIMEOUT` 30000 ms, `OTEL_BSP_SCHEDULE_DELAY` 5000 ms, `OTEL_BSP_EXPORT_TIMEOUT` 30000 ms, `OTEL_BLRP_SCHEDULE_DELAY` 1000 ms, `OTEL_BLRP_EXPORT_TIMEOUT` 30000 ms, `OTEL_SDK_DISABLED` false. Spec: https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/configuration/sdk-environment-variables.md. SDK constants: `sdk/metric@v1.45.0/periodic_reader.go:23-26` and `env.go:13-17`, `sdk@v1.45.0/trace/batch_span_processor.go:23-28`, `sdk/log@v0.20.0/batch.go:16-27`. The SDK reads each env var only when the corresponding processor or reader is constructed.

Result (Verified): spans and logs are event-driven and only follow real requests, so they are compatible with sleeping. Metrics are not: one POST per 60 s forever. `Shutdown` also flushes (`periodic_reader.go` `Shutdown`), so a graceful stop still exports once.

Inference: with `OTEL_ENABLED=true` and `OTEL_METRICS_EXPORTER=otlp`, the API can never be quiet for 5 minutes, independent of NATS. Fixing NATS alone will not make it sleep. The ticket's note "other API services without OTel do sleep" is consistent with this.

### 4.2 NATS client (Verified, nats.go v1.52.0)

- Defaults: `DefaultPingInterval = 2m`, `DefaultMaxPingOut = 2`, `DefaultTimeout = 2s`, `DefaultReconnectWait = 2s`, `DefaultMaxReconnect = 60`, `DefaultDrainTimeout = 30s` (`nats.go:55-67`). `ProvideNATSConn` passes no options, so all defaults apply.
- Configured with `nats.PingInterval(d)` (`nats.go:1194-1200`) and `nats.MaxPingsOutstanding(n)` (`nats.go:1204-1210`).
- The client timer is started on connect only `if nc.Opts.PingInterval > 0` (`nats.go:2757-2763`). It is never reset by other traffic. Every tick sends `PING` unconditionally and re-arms (`processPingTimer`, `nats.go:5774-5795`).
- Each tick increments `pout`; only a received `PONG` zeroes it (`nats.go:4026-4036`). The connection is declared stale when `pout > MaxPingsOut` (`nats.go:5783-5790`), so detection time is about `(MaxPingsOut+1) * PingInterval`.
- On a server `PING` the client immediately sends `PONG` (`processPing`, `nats.go:4020-4023`). That PONG is an outbound packet the client cannot suppress.
- Default dialer is `&net.Dialer{Timeout: ...}` with no `KeepAlive` (`nats.go:1833-1837`, used at `2339-2349`; unchanged in v1.54.0, where it is at `nats.go:1989`). In Go a zero `KeepAlive` enables kernel keepalive with 15 s idle, 15 s interval, 9 probes (`go1.26 src/net/dial.go:18-27`; the same constants are present at `go1.27.1`; the Dockerfile builds the API with Go 1.26.7). These probes originate in the API container's kernel, repeat for as long as the socket is idle and the peer answers, and are not controlled by NATS PING settings.
- Client-side switch: `nats.Dialer(&net.Dialer{Timeout: <t>, KeepAlive: -1})` (`nats.go:1493-1500`, deprecated in favour of `SetCustomDialer` but still honoured, and `Timeout` must then be set by the caller because the default dialer is only created when `Opts.Dialer == nil`). Go documents a negative `KeepAlive` as disabling keepalive.
- Reconnect behaviour with the defaults the repo uses: on a lost connection nats.go retries every `ReconnectWait` (2 s plus jitter) up to `MaxReconnect` (60) attempts, about 2 min, and then closes the connection permanently once the server pool is empty (`nats.go:371-378`, `3220-3236`, `3418-3424`, v1.52.0). No `ClosedHandler` or re-creation logic exists in `ProvideNATSConn`, so a NATS outage longer than about 2 min leaves the API with a closed connection until the process restarts (4.8). `RetryOnFailedConnect` is not set, so a NATS outage at boot fails API startup.
- Release scan: nats.go v1.52.0 to v1.54.0 release notes (https://github.com/nats-io/nats.go/releases) mention reconnect fixes (v1.51.0, v1.54.0) and server-version support (v1.52.0 targets 2.14, v1.54.0 adds 2.15 fields and CI against v2.15.0) but nothing about ping, keepalive or idle behaviour. `processPingTimer` and the `PingInterval > 0` start condition are unchanged in v1.54.0 (`nats.go:5993-6013`, `2931`).

### 4.3 NATS server (Verified, nats-server v2.15.0)

- Defaults: `DEFAULT_PING_INTERVAL = 2m`, `DEFAULT_PING_MAX_OUT = 2`, RTT re-measure interval `1h` (`server/const.go:120,123,224`).
- Server ping timer (`processPingTimer`, `server/client.go:5842-5900`): for ordinary clients it skips the PING if client data or a client PING arrived within `pingInterval` ("Delaying PING due to remote client data or ping", line 5873-5874) unless `needRTT` (never measured or last measured over 1 h ago). Otherwise it sends `PING` and closes the client with "Stale Connection" after more than `ping_max` unanswered (line 5887).
- `lastIn` is updated by any message or subscription change (`client.go:1653`) and by a client `PING` (`client.go:2774`). So the client's 2 min PINGs suppress the server's; if the client stops pinging, the server starts pinging the idle client every `ping_interval` and the client's PONG is outbound traffic.
- `ping_interval` and `ping_max` are config-file keys (`server/opts.go:1385` and the `ping_max` case next to it). `ConfigureOptions` (`opts.go:6223`) defines no ping-related CLI flag. Docs: "In the presence of client traffic, such as messages or client side pings, the server will not send pings. Therefore it is recommended to keep this value bigger than what clients use." Default `2m`, reloadable. Source: https://docs.nats.io/running-a-nats-service/configuration (section "ping_interval and ping_max").
- Correction (2026-10-08): the earlier draft said accepted client sockets get Go's default 15 s keepalive. That is wrong. `server.go:2968` is the profiler listener. The client listener is created by `getServerListener` -> `natsListen` (`server.go:2802,2874-2879`), which uses `natsListenConfig = &net.ListenConfig{KeepAlive: -1}` (`server/util.go:267-275`, with the comment "The NATS protocol has its own L7 PING/PONG keepalive system and the Go defaults are inappropriate for IoT deployment scenarios"). So nats-server sends no TCP keepalive probes to clients. This is identical in v2.10.0, v2.12.0, v2.14.0 and v2.15.0 (`util.go` `natsListenConfig` and `DEFAULT_PING_INTERVAL = 2 * time.Minute` / `DEFAULT_PING_MAX_OUT = 2` in `const.go` checked at each tag). Only the API-side dialer probes (4.2). The server's own kernel still ACKs those probes.
- Monitoring: `-m <port>` exposes `/connz` with per-connection `last_activity`, `idle`, `rtt`, `in_msgs`, `out_msgs` (`server/monitor.go:122-130`; CLI flag `-m` at `opts.go` flag list). Not enabled today.

### 4.4 JetStream and KV (Verified, nats.go v1.52.0 `jetstream/`)

- `jetstream.New` allocates a struct holding the `*nats.Conn` and spawns no goroutine (`jetstream.go:470-491`). `js.Publish` is a sync request/ack (`publish.go:161-168`). `kv.Get`, `kv.Create`, `kv.Delete` are one-shot requests (`kv.go:1004`). The only goroutines in `kv.go` and `jetstream.go` are lister/watch helpers the repo does not call.
- Idle heartbeats exist only for consumers and watchers, and the API has neither. The first request creates one wildcard response subscription (`nats.go:4587-4600`), which is a one-time SUB and is silent afterward.
- Conclusion (Inference from the above): JetStream and KV add no periodic traffic. Idle NATS traffic from the API is only client PING, server PING and the client's PONG, plus the API kernel's TCP keepalive probes.

### 4.5 What `OTEL_ENABLED=false` does in this repo (Verified)

- Config: `OTel.Enabled` (`required:"true" default:"false"`, prefix `OTEL`, so the variable is `OTEL_ENABLED`) in `internal/core/config/otel_config.go:3-6`.
- `main` calls `otel.InitSDK(ctx, config.Global.OTel)` right after `config.Load()` and before `http.Setup` (`cmd/http/main.go`). When `Enabled` is false, `InitSDK` returns `func(context.Context) error { return nil }, nil` as its first statement (`internal/core/otel/otel.go:23-26`). Nothing below it runs: no `autoprop` propagator, no `autoexport.NewMetricReader` / `NewLogExporter` / `NewSpanExporter`, no `sdkmetric.NewMeterProvider`, no periodic reader, no `BatchSpanProcessor`, no log `BatchProcessor`, no goroutines.
- Therefore `OTEL_METRICS_EXPORTER`, `OTEL_TRACES_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_*`, `OTEL_RESOURCE_ATTRIBUTES` and `OTEL_GO_X_CARDINALITY_LIMIT` are never read in dev and preview. The repo does not read `OTEL_SDK_DISABLED`; it is not needed.
- What still exists, all inert: the global tracer, meter and logger providers stay the OTel API no-op delegates; `otel.Tracer` stays `noop.NewTracerProvider().Tracer("")` (`otel.go:21`); `ezutil/v2` `otel.Init` still builds a logger whose `otelWriter` emits to the global (no-op) logger, plus stdout (`ezutil/v2@v2.4.0/otel/otel.go`); sentinel-go's `Tracing` and `Metrics` middleware (section 2) bind to the no-op providers; Google client libraries add `otelgrpc` / `otelhttp` handlers (`api@v0.287.1/transport/grpc/dial.go:380-384`) that also bind to the no-op global providers.
- Result (Verified by code reading): with `OTEL_ENABLED=false` no outbound traffic to `otel-collector` is generated in dev or preview, and `OTEL_*_EXPORTER=otlp` does not create any exporter. `OTEL_METRIC_EXPORT_INTERVAL` is not set anywhere in the repo or in the supplied config, so in production the 60 s default applies.
- Bare hostname `http://otel-collector:4318` in production (resolved 2026-10-08): the user confirmed it resolves to the private service `otel-collector` and is the same as `otel-collector.railway.internal:4318`. Railway documents only the `.railway.internal` form (section 3), so this is user-verified rather than doc-backed. Consequence (Inference): every 60 s a real OTLP POST reaches the collector over the private network, which Railway counts as outbound traffic even though it is hidden from the metrics tab (section 3). The fallback worry in the earlier draft, a failing DNS lookup, does not apply.

### 4.6 `OTEL_GO_X_CARDINALITY_LIMIT` and `service.instance.id` (Verified)

- Cardinality: `sdk/metric@v1.45.0/config.go:82,208-218` reads `OTEL_GO_X_CARDINALITY_LIMIT` when the `MeterProvider` config is built; `WithCardinalityLimit` documents the env var as the backward-compatible way to set it (`config.go:172-188`). The SDK default became 2000 in the v1.44.0 changelog ("now applies a default cardinality limit of 2000 ... Set `WithCardinalityLimit(0)` or the deprecated `OTEL_GO_X_CARDINALITY_LIMIT=0` environment variable to preserve unlimited cardinality. Note that support for `OTEL_GO_X_CARDINALITY_LIMIT` may be removed in a future release", https://github.com/open-telemetry/opentelemetry-go/blob/v1.45.0/CHANGELOG.md, section 1.44.0/0.66.0). So `256` is honoured at the pinned version and lowers the cap from 2000. It bounds per-instrument series count (memory and backend cost) and has no effect on export cadence or on whether a request is sent, so it is irrelevant to sleep. The comment in `backend/.env.example` saying the SDK default is 0 (unlimited) is stale for v1.45.0 (not edited here). Risk to note: if a future SDK drops the deprecated env var, the cap silently reverts to 2000.
- `service.instance.id`: a resource attribute parsed from `OTEL_RESOURCE_ATTRIBUTES` by the `fromEnv` detector (`sdk@v1.45.0/resource/env.go:20`, `resource.go:249-265`). It labels exported telemetry only and generates no traffic. With a single replica the fixed value `railway-prod` is stable across restarts and wakes, which keeps one metric series identity across process lifetimes (cumulative counters reset on restart; Inference). Irrelevant to sleep. The SDK would otherwise generate a random UUID only when its experimental resource flag is on (`resource.go:258-260`).

### 4.7 Other periodic or persistent outbound sources in the API process (Verified in code, effect on Railway Inference)

| Source | What it does | Cadence | Bounded? |
|---|---|---|---|
| Cloud Vision gRPC channel | `ProvideOCRClient` runs at boot for every process built from the shared wire graph. `gtransport.DialPool` calls `grpc.DialContext`, which "calls NewClient and then exits idle mode" (`grpc@v1.82.1/clientconn.go:269-292`), so the channel connects to `vision.googleapis.com` at boot. Go's 15 s TCP keepalive applies (`grpc@v1.82.1/dialoptions.go:488-491`). The channel idle timeout defaults to 30 min (`dialoptions.go:729`, `WithIdleTimeout` at `771-785`), after which grpc-go closes the connection and reconnects only on the next RPC | probes every 15 s while connected; no gRPC keepalive pings by default (`keepalive.ClientParameters` is opt-in, `dialoptions.go:571-575`); unverified whether Google-side HTTP/2 PINGs occur | yes, up to 30 min after boot or the last OCR call, only if Railway counts kernel keepalive probes. If wake restarts the process this repeats on every wake and defeats a 10 min target (Inference) |
| Postgres pool (pgx v5.10.0 via GORM) | `Ping()` at boot, then pooled connections with Go-default keepalive (`pgconn/config.go:978-981`). `database/sql` closes free connections older than `ConnMaxLifetime` from its cleaner goroutine, which re-checks at that interval (`database/sql/sql.go:1095-1181`, go1.26.3) and never reopens without a request. Default `DB_CONN_MAX_LIFETIME` is `5m` (`db_config.go`); no `ConnMaxIdleTime` is set | probes every 15 s per idle connection, plus a Terminate message when closed | yes, roughly 5-10 min after the connection was created if the lifetime is 5m. The real production and preview values are `preserve()`d and unknown; `0` would keep idle sockets open indefinitely (unverified) |
| GCS client | `storage.NewClient` uses the HTTP/JSON transport, created lazily with no goroutine. The "gRPC client-side metrics exported to Cloud Monitoring by default" feature in `storage@v1.66.0/doc.go:402-408` applies to the gRPC client only | none | n/a |
| Langfuse, LLM, mail, webpush | plain HTTP calls on demand; no ticker or goroutine in the Langfuse client | none | n/a |
| In-process tickers | `cache.go:93`, `in_memory_state_store.go:61`, `ratelimit.go:66` (1-minute cleanups, in memory only) | none outbound | n/a |
| Scheduler / cron | `robfig/cron` lives in `internal/adapters/worker/scheduler` and runs in `cashback-worker`, not the API | n/a | n/a |
| Healthcheck | deploy-time only (section 3) | none | n/a |
| Log shipping | `OTEL_LOGS_EXPORTER` is a batch processor that only exports when a record exists; with OTel off there is none. Logs also go to stdout, which Railway collects outside the container's network path (Inference) | event-driven | n/a |
| Feature flags | `FLAG_CLIENT_KEY` is parsed into config (`internal/core/config/flags.go`) but no flag client or poller exists in `internal/` | none | n/a |
| Inbound public traffic | scanners, uptime monitors and the frontend hitting `api.cashus.online`. Railway lists "Receiving traffic from external services over the public internet" as a blocker (section 3). In dev and preview the user states there is none beyond what the user or an agent sends (2.1), so it is ruled out there by assumption; in production it is real and uncontrollable | external | production: cannot be controlled; dev and preview: none by assumption |

Not audited: custom `http.Transport` settings (default `http.DefaultTransport` closes idle keep-alive connections after 90 s; whether the repo's clients use it was not checked), and the Neon side (compute auto-suspend after inactivity is a Neon setting and was not read).

### 4.8 `nats:latest` today (Verified, with the deployed version still open)

- Resolution: Docker Hub `library/nats:latest` is the manifest list with digest `sha256:cd3fcd4ecdda44e3a66728a5334af0a959bc3979b32810e033d1c547241cd0f4`, last updated 2026-09-18T04:57:16Z, the same digest as tags `2.15.0`, `2.15` and `2` (https://hub.docker.com/v2/repositories/library/nats/tags/latest, queried 2026-10-08). The Linux part of that list is the `scratch` variant (amd64 layer about 7.3 MB). The official-images entry for `nats` at GitCommit `0e72748d3cb553ccdb8c2da7c75ec3b767be51a5` lists `SharedTags: 2.15.0, 2.15, 2, latest` for the Linux scratch variant (https://github.com/docker-library/official-images/blob/master/library/nats). That commit's Dockerfile copies `nats-server` from `nats:2.15.0-alpine3.22`.
- Latest non-prerelease nats-server: v2.15.0, published 2026-09-17T13:30:47Z (https://api.github.com/repos/nats-io/nats-server/releases/latest). Pre-releases `v2.15.1-RC.2` and `v2.14.8-RC.2` (2026-10-06) exist, so the next `latest` is expected to be a 2.15.x patch. Do not read the `main` branch Dockerfile of nats-docker for "what is latest": it already points at `2.15.1-RC.2`.
- What is actually deployed: unverified. Railway pulls the digest at deploy time (section 3), so it is whatever `latest` was at the last `nats` deploy in each environment. The server prints its version at startup (`Version: x.y.z` in the deploy log); read it there.
- Ping, keepalive and idle behaviour: no change found. `DEFAULT_PING_INTERVAL = 2m` and `DEFAULT_PING_MAX_OUT = 2` are identical at v2.10.0, v2.12.0, v2.14.0, v2.15.0 and `main`; `natsListenConfig{KeepAlive: -1}` is present at all four tags; the release notes for v2.14.0, v2.14.7, v2.15.0 and v2.15.1-RC.2 contain no ping, keepalive, idle or stale-connection entries (https://github.com/nats-io/nats-server/releases). v2.15.0 is built with Go 1.27.1; the server's own sockets are not affected by Go's default keepalive since the listener disables it. The nats.go pinned in `backend/go.mod` is v1.52.0 and does not change ping behaviour through v1.54.0 (4.2).
- v2.15.0 behaviour changes that could matter: streams default to 1000 consumers unless `max_consumers` or `default_max_consumers` is set (the repo's `TASKS` stream and the API's KV usage are far below that, since the API creates no consumers or watchers); metalayer scale/move changes (single node, not relevant). Source: https://docs.nats.io/release-notes/upgrade-to-2.15 and the v2.15.0 release notes.
- Floating-tag risks (Inference unless cited):
  - Silent major or minor bumps. `latest` will move to 2.15.x patches soon and eventually to a new minor or major on whichever redeploy or Railway auto-update re-pulls it. The upgrade guide recommends downgrading to v2.14.7 or higher only, and says scale/move operations started on 2.15 do not complete after a downgrade, so rollback is not free once the `/data` JetStream store has been opened by a newer server (https://docs.nats.io/release-notes/upgrade-to-2.15).
  - Client/server skew. The API pins nats.go v1.52.0 (built against server 2.14 features); the latest client is v1.54.0 with CI against v2.15.0. The NATS protocol and JetStream API are designed to be backward compatible, so skew is expected to work, but the client will not use newer server features and the pairing is untested by upstream CI. Unverified beyond release notes.
  - Redeploy downtime. Railway notes that an image update triggers a redeploy that "may cause brief downtime for services with attached volumes" (section 3), and `nats` has a volume. Because the API's nats.go gives up after about 2 min of reconnect attempts (4.2) and nothing re-creates the connection, a long enough NATS redeploy can leave the API publishing into a closed connection until it restarts. That is a reliability issue independent of sleeping, and it is exactly what fix (b) would also cure for the API.
  - Config surface. The Railway start command `nats-server -js -sd /data` bypasses the baked `nats-server.conf`; a future image that changes ENTRYPOINT or default flags would change behaviour without a repo change.
- Sleep implications of the NATS server itself: the `nats` service has no `sleepApplication` in `railway.ts`, so it never sleeps and its own traffic is irrelevant to its state. It matters only as a peer: its PINGs and the API's PONGs are the traffic that counts for the API (4.3). The `cashback-worker` also holds a permanent connection to the same server; that does not touch the API's container.
- Mitigation: pin the tag (for example `nats:2.15.0`, or a digest) so redeploys cannot change the version; this is a one-line `railway.ts` change on a service the ticket fences off, so it is a recommendation, not part of this work.

### 4.9 Ranked attribution (Inference)

| Rank | Source | Cadence | Applies in | Confidence it blocks sleep |
|---|---|---|---|---|
| 1 | OTLP metrics POST to the collector over the private network (bare host confirmed to resolve, 4.5) | every 60 s | production only (`OTEL_ENABLED=true`) | high |
| 2 | NATS client PING and the server's PONG/ACK | every 2 min | production and preview | high |
| 3 | Server PING and the client's PONG if client pings stop | every 2 min | production and preview | high |
| 4 | API-side kernel TCP keepalive probes on the NATS socket (server side has none, 4.3) | every 15 s once idle 15 s | production and preview | unknown, depends on whether Railway counts kernel keepalive probes (section 8) |
| 5 | Vision gRPC channel dialed at boot, with Go 15 s keepalive, idle-closed after 30 min | every 15 s, up to 30 min after boot or last OCR call | production and preview | unknown, same dependency as rank 4; can defeat a 10 min target after every boot or wake |
| 6 | Postgres pooled connections (keepalive until closed by `ConnMaxLifetime`) | every 15 s, about 5-10 min after creation if lifetime is 5m | production and preview | low to unknown; real `DB_CONN_MAX_LIFETIME` not supplied |
| 7 | Inbound public traffic to the API domain | external | production only; none in dev and preview by the user's assumption | production: unknown, must be observed, not inferred |

## 5. Fix (a): keepalive tuning

What it would take: client `nats.PingInterval(>=11m)` (with a lower `MaxPingsOutstanding` if stale detection should stay bounded) plus server `ping_interval` of at least 11-15 min in a config file.

Findings:

1. Client-only is ineffective (Verified chain): without client PINGs, `lastIn` goes stale, so the server PINGs every `ping_interval`, and the client's PONG is outbound (`client.go:5873-5887`, `nats.go:4020-4023`).
2. The server side needs a config file, not a flag (`opts.go:6223` flag list has no ping flag). The image is `FROM scratch` with no shell, so the file must come from a Dockerfile `COPY` or from the `/data` volume, and `nats` is declared out of scope in the ticket. A global `ping_interval` of 15 min also slows server-side dead-client detection for the always-on worker to `(ping_max+1) * 15 min`, though the worker's own 2 min client PINGs still bound it from the client side.
3. Kernel keepalive (Verified existence, Unknown effect). Corrected 2026-10-08: only the API side probes, because nats-server disables keepalive on client sockets (4.3). `ping_interval` does nothing about the API's probes, but they can be disabled client-side with `nats.Dialer(&net.Dialer{Timeout: <t>, KeepAlive: -1})` (4.2). So the "cannot work at all if keepalive counts" argument no longer holds for the NATS socket; the remaining kernel-keepalive risk for (a) comes from the Vision channel and the Postgres pool (4.7), which (a) does not touch.
4. Hourly RTT PING (`const.go:224`) is harmless (one exchange per hour while awake).
5. Stale detection: with a PING interval above 10 min the client cannot detect a half-open socket on its own; it depends on TCP keepalive (about 2.5 min) and on publish errors. After a wake the first publish may hit a dead or server-closed connection.
6. Railway private-network idle behaviour for long-lived TCP is undocumented (the private-networking pages describe internal DNS only and do not mention idle connections or keepalives, re-checked 2026-10-08: https://docs.railway.com/networking/private-networking/how-it-works). This is an extra unknown.

Verdict (revised 2026-10-08): feasible on paper, still not recommended. With the client dialer switch the full recipe is client `PingInterval(>=11m)` plus `Dialer{KeepAlive: -1}` plus a server `ping_interval` of 11-15 min or more from a config file. It still depends on four independent behaviours lining up (client timer, server config on an out-of-scope service, no proxy idle drop on the private network, clean reconnect after wake), the margin over the documented 5-10 min window is only about 2x, and it does nothing about the Vision channel or the Postgres pool. Because the kernel-keepalive question no longer sits on the NATS socket, a cheaper stepping stone exists for the experiments: R5 and R6 in 7.2 now test the recipe without the dialer problem, and R6 no longer decides the fate of (a) alone.

## 6. Fix (b): lazy connect plus idle close

### 6.1 What depends on a live connection today

- Startup: `ProvideNATSConn` (eager, in every environment) -> `ProvideJetStream` -> `ProvideStateStore` (does `CreateOrUpdateKeyValue` immediately, which is the case in production and dev because `AUTH_STATE_STORE=nats`) -> `ProvideTaskQueue` (`core_service_provider.go:104-156`, `wire_gen.go:36-60`). A NATS outage currently fails API boot; with a lazy connection it would instead fail the first publish or OAuth call.
- `CoreServices` exposes `NATSConn` and `JetStream`; the worker uses `JetStream` for `CreateOrUpdateStream` and consumers (`subscribers.go:19-30`). The worker needs an always-on connection, so the lazy behaviour must apply only to the API's `natsClient` and `natsKVStateStore`, leaving the worker's path unchanged. Otherwise `InitializeProviders` (shared by `cmd/http`, `cmd/worker`, `cmd/job`) would regress the worker.
- Handle lifetime (Verified): `Close()` makes later calls fail with `ErrConnectionClosed` (`nats.go:6042-6055`). The `jetstream.JetStream` and `jetstream.KeyValue` handles hold the closed `*nats.Conn` and cannot be reused (`jetstream.go:484-488`). They must be re-created per connection: `jetstream.New(nc)` (no I/O) and `js.KeyValue(ctx, bucket)` (`kv.go:506`, one STREAM.INFO request) or `CreateOrUpdateKeyValue`.
- Cleanup (Verified): `Drain()` is asynchronous, runs `drainConnection` in a goroutine bounded by `DrainTimeout` 30 s and skips the response mux subscription (`nats.go:6182-6201`, `6077-6150`). For the idle path `Close()` is the simpler choice because the API has no subscriptions and every publish is already acked before it returns. Keep `Drain()` for process shutdown.

### 6.2 Minimal design sketch (not implemented)

A small holder type used only by the API-side adapters. Sketch, not final code:

```go
type lazyNATS struct {
    mu       sync.Mutex
    url      string
    idle     time.Duration
    nc       *nats.Conn
    js       jetstream.JetStream
    kv       jetstream.KeyValue
    inflight int
    lastUse  time.Time
    timer    *time.Timer
}

// acquire connects on demand and pins the connection until release.
func (l *lazyNATS) acquire(ctx context.Context) (jetstream.JetStream, jetstream.KeyValue, func(), error)
// release decrements inflight, stamps lastUse, and arms the idle timer.
// closeIfIdle runs under mu: closes only if inflight == 0 and time.Since(lastUse) >= idle.
```

Concurrency rules the design must hold:
- All state under one mutex; `acquire` increments `inflight` before returning and cancels or ignores the timer.
- The `inflight` counter protects `AsyncEnqueue`'s detached goroutine and any request mid-`js.Publish`; a bare idle timer would close under it.
- `closeIfIdle` must re-check `inflight == 0` and `time.Since(lastUse) >= idle` under the lock. A stale `time.AfterFunc` callback that already fired while a newer acquire/release happened would otherwise close a freshly used connection (`Timer.Stop` returning false does not cancel a queued callback).
- `acquire` must treat `l.nc == nil || l.nc.IsClosed()` as "reconnect" (`nats.go:6055`), covering a connection nats.go closed itself after exhausting reconnects.
- On `nats.Connect` failure, return the error to the caller without caching; default `Connect` fails fast (no `RetryOnFailedConnect`).
- Idle window: Railway needs 5-10 min of silence after the last outbound packet, and closing the socket sends a FIN at `idle` after last use. Total time to Sleeping is roughly `idle + (5..10 min)`, so against the ticket's "Sleeping within 10 minutes" target keep `idle` short (start at 30-60 s) and measure.

Blast radius estimate (Inference): new `lazyNATS` type (about 80 lines plus a race test), edits to `natsClient`, `natsKVStateStore`, `NewStateStore` (bucket bound per connection rather than at boot), the providers and a `wire` regen, and updates to `nats_kv_state_store_test.go` and any mocks. Worker path unchanged.

### 6.3 Reconnect cost on the first request (Inference from protocol, not measured)

- `nats.Connect`: DNS for `nats.railway.internal`, TCP handshake (1 RTT), server sends `INFO`, client sends `CONNECT` + `PING`, server answers `PONG` (1 RTT). Default connect `Timeout` is 2 s (`nats.go:59`). Plus `js.KeyValue` or `CreateOrUpdateKeyValue` (1 RTT) on KV paths. A publish already costs 1 RTT for its ack today. So roughly 3 extra round trips on the private network. Intra-region RTT is expected to be small, but no number is claimed here.
- Dominant cost on wake is Railway's own cold boot (container start, plus `InitializeProviders`, DB connect, etc. if the process restarts). The ticket wants latency recorded with and without the NATS connect step; the experiment plan does that.

### 6.4 If wake means "process restarts"

Unknown (see section 3). If sleeping stops the container and a wake starts a fresh process, then lazy first-connect gives nothing at wake (startup runs again either way) and only the idle-close half of (b) matters. If sleeping freezes the process, a stale socket and timers resume after wake and the reconnect path is exercised. Experiment E1 settles this first.

## 7. Experiment plan (preview environment only; every item below is a prediction, not a measurement)

Rules from the ticket: preview environment only (https://github.com/itsLeonB/cashus/blob/main/docs/deployment/preview-environments.md), and record each run's Railway sleep state, timestamps and config in the report.

### 7.1 Setup

- Free check before any change: if a development (or existing preview) `cashback` service has Serverless on, look at its state in the dashboard now. Dev runs with `OTEL_ENABLED=false` and, by the user's assumption, gets no inbound traffic (2.1), so "Active forever" there points at NATS, the Vision channel or the pool rather than OTel or inbound traffic, and "Sleeping" would contradict the analysis. This is the cheapest and cleanest evidence available. Serverless on dev is not confirmed (2.1).
- Open a throwaway PR so Railway creates a PR environment. The PR environment is based on development (user-verified, 2.1), so it should carry the development values from 2.1; a quick look at its variables is enough. Confirm that `nats` was deployed (focused PR environments may skip it, section 3), and in the `cashback` service settings that Serverless is on. Serverless applies only to containers created after the setting, so redeploy before every run (Railway docs, "Applying the setting").
- No env var today disables NATS or sets `PingInterval`, so bisecting NATS needs a throwaway branch with env-gated knobs, never merged: `EXP_NATS_CLOSE_AFTER=<dur>` (call `nc.Close()` that long after boot), `EXP_NATS_PING_INTERVAL=<dur>` (pass `nats.PingInterval`), `EXP_NATS_NO_KEEPALIVE=1` (pass `nats.Dialer(&net.Dialer{Timeout: 2 * time.Second, KeepAlive: -1})`), `EXP_SKIP_VISION=1` (skip `ProvideOCRClient`'s dial), and a startup log line with PID and boot timestamp. Inbound public traffic is itself listed as a blocker (section 3). Dev and preview get none unless the user or an agent sends it (2.1), so the only rule is: after the one request that starts the observation window, send nothing (no health pokes, no frontend tab on the PR deployment).
- Observation without shell or tcpdump (the API image is distroless static):
  - Railway dashboard: service status (Sleeping or Active) with wall-clock time, and the deployment log's last and first timestamps around sleep and wake.
  - NATS server view: in the preview environment only, start the `nats` service with `-DV` (debug+trace) to log every PING and PONG per connection with timestamps, and with `-m 8222` for `/connz` (`last_activity`, `idle`, `rtt`) if reachable via private network or `railway ssh` on a sidecar. Expected log shape: per-connection lines for `PING`, `PONG` and "Delaying PING due to remote client data or ping". Not enabled in production.
  - Collector view (only for runs that turn OTel on, which preview does not do by default): set `OTEL_ENABLED=true` and the endpoint in the PR environment, make sure a collector exists there, and add a `debug` exporter (`verbosity: basic`) in `backend/otel/config.yaml` on the PR branch; arrival times of metric batches show whether the 60 s POSTs continue (the collector's `interval` and `batch` processors add up to about 60-70 s of smoothing, so compare cadence, not exact seconds).
- Record `AUTH_STATE_STORE` for each run. Production and dev are both `nats` (2.1), so the KV bucket is created at boot in preview; the code default is `inmemory`, which would never touch the KV. Also record `DB_CONN_MAX_LIFETIME` for each run, since it bounds the Postgres pool probes (4.7).
- Observation window: Vision's channel idle timeout is 30 min (4.7), so runs that test it need a 45 min horizon instead of +15 min.

### 7.2 Run matrix

Each run: deploy, send one request (for example `GET /ping` plus one authenticated enqueue), then send nothing. Record time of last request, state at +5, +10, +15 min, and the time Sleeping appears.

| Run | Config | Prediction (from sections 4-5) |
|---|---|---|
| R0 | Zero-change baseline in a PR environment: dev values (`OTEL_ENABLED=false`), NATS eager, Vision eager | Stays Active (NATS PING at 2 min, keepalive probes, Vision channel). If it sleeps, the analysis is wrong in a way that matters; stop and re-read 4.7 |
| E0 | Production-like: `OTEL_ENABLED=true`, endpoint pointing at a collector in the PR environment, NATS eager | Stays Active. Collector sees metric batches every ~60 s; NATS log shows a PING/PONG about every 2 min |
| E1 | Wake model probe: any run that reaches Sleeping, then one request | Boot log line with a new PID/timestamp means restart-on-wake; no new boot line and an old PID means freeze/resume. Decides how much a lazy first connect matters (6.4), and whether the Vision channel (4.7) re-opens on every wake |
| R1 | Dropped 2026-10-08: it only applied if the PR environment inherited production, and the user verified it inherits development, so R0 is the baseline | n/a |
| R2 | E0 with `OTEL_METRICS_EXPORTER=none` only, NATS eager | Stays Active (same reason). Shows traces/logs do not block |
| R3 | R0 plus `EXP_NATS_CLOSE_AFTER=30s` and `EXP_SKIP_VISION=1`, `DB_CONN_MAX_LIFETIME=1m`, 45 min horizon | Sleeps within 10 min; if not, something outside OTel, NATS, Vision and the pool blocks it (inbound traffic, an unaudited client), which would change the plan |
| R3b | R3 without `EXP_SKIP_VISION` | Isolates the Vision channel: if R3 sleeps and R3b does not until about 30-40 min, the idle-timeout path is the blocker and keepalive probes are counted |
| R4 | E0 with `OTEL_METRIC_EXPORT_INTERVAL=1800000`, `EXP_NATS_CLOSE_AFTER=30s`, `EXP_SKIP_VISION=1` | Sleeps. Confirms metrics interval is the only OTel blocker |
| R5 | R0 plus `EXP_NATS_PING_INTERVAL=30m`, `EXP_NATS_NO_KEEPALIVE=1`, `EXP_SKIP_VISION=1`, `DB_CONN_MAX_LIFETIME=1m`, server default | Stays Active: server PINGs the silent client every 2 min and the client PONGs (4.3) |
| R6 | R5 plus server `ping_interval: 30m` via a config file in the preview `nats` service | Sleeps if no other blocker remains. Decisive for whether fix (a) is feasible at all; no longer depends on the server's keepalive, which does not exist (4.3) |
| R8 | R6 with `EXP_NATS_NO_KEEPALIVE` unset (API keepalive probes on, everything else quiet) | Active iff Railway counts kernel keepalive probes (compare with R6). This is the decisive test for open question 1 |
| R7 | Candidate: `OTEL_METRIC_EXPORT_INTERVAL=1800000` plus the real (b) implementation with `idle=30-60s`, `AUTH_STATE_STORE=nats`, and whatever R3b says about Vision | Sleeps within about `idle + 5..10 min` |

### 7.3 Success-criteria measurements (R7 only)

- Sleeping within 10 minutes of last request: record exact times. With `idle=60s` the worst case is about 11 min, so shorten `idle` if it misses.
- Wake correctness: after Sleeping, from outside, run (1) a call that enqueues a task and confirm the worker consumes it, and (2) the OAuth state round-trip (`Store` on login redirect, `VerifyAndDelete` on callback) with `AUTH_STATE_STORE=nats`. Record separately any 502 on the first request (documented by Railway) from real enqueue or KV failures.
- Latency: at least 20 cold starts (each needs 10+ min asleep, so about 3-4 hours). Log, per request, timestamps for request received, `nats.Connect` done, KV bound, publish acked, response sent. Compute the cold-start p95 total, and the connect-step share by comparing against a run with `EXP_NATS_CLOSE_AFTER` unset (NATS already connected, only OTel changed, if it sleeps). With 20 samples the p95 is the second-highest value, so state it as a rough estimate.

### 7.4 Recording template (one row per run)

| Run | Branch/commit | Env diff vs baseline | Redeployed at | Last request at | Active at +5 / +10 / +15 min | Sleeping first seen at | NATS log notes | Collector log notes | Boot line on wake (PID) |
|---|---|---|---|---|---|---|---|---|---|

### 7.5 Results (CASH-24 spike, run 2026-10-09)

Method: two draft PRs labelled `do-not-merge` created Railway PR environments `cashus-pr-68` (branch `exp/cash-23-knobs`, the env-gated knobs from 7.1 plus a collector `debug` exporter) and `cashus-pr-69` (branch `exp/cash-23-trackb`, the knobs plus a `nats` image built from `FROM nats:2.15.0` with `ping_interval: "30m"`). Every run was one redeploy, exactly one `GET /ping` about 20 s after the deploy went healthy, and then no traffic. Railway's `DeploymentStatus` (via `railway api`) and `railway service status --json` were polled once a minute for up to 60 min. `SLEEPING` was the only sleep signal used (`status=SLEEPING, stopped=true` in the CLI). Pinned CLI `@railway/cli@5.49.3`, `nats` 2.15.0 in every run. Verdict bands from the ticket: 11 min or less pass, 11 to 15 slow, 15 to 60 late sleep, never fail.

| Run | Env | Env diff (variables accumulate between runs, so the value shown is what was set for that run) | Sleeping first seen | Verdict |
|---|---|---|---|---|
| R0 | 68 | none (dev values: `OTEL_ENABLED=false`, `AUTH_STATE_STORE=nats`, `DB_CONN_MAX_LIFETIME=5m`) | never (60 min) | fail |
| R5 | 69 | `EXP_NATS_PING_INTERVAL=30m`, `EXP_NATS_NO_KEEPALIVE=1`, `EXP_SKIP_VISION=1`, `DB_CONN_MAX_LIFETIME=1m`; server default ping | never (60 min) | fail |
| R3 | 68 | `EXP_NATS_CLOSE_AFTER=30s`, `EXP_SKIP_VISION=1`, `DB_CONN_MAX_LIFETIME=1m` | 7 min (7 min 48 s after the request) | pass |
| R3b | 68 | R3 with `EXP_SKIP_VISION=0` | 13 min | slow |
| R6 | 69 | R5 plus server `ping_interval: "30m"` | 7 min | pass |
| R8 | 69 | R6 with `EXP_NATS_NO_KEEPALIVE=0` (API kernel keepalive on) | never (60 min) | fail |
| R2 | 68 | OTel on, `OTEL_METRICS_EXPORTER=none`, NATS eager, Vision on, pool 5m | never (60 min) | fail |
| E0 | 68 | R2 with `OTEL_METRICS_EXPORTER=otlp` | never (60 min) | fail |
| R4 | 68 | E0 plus `OTEL_METRIC_EXPORT_INTERVAL=1800000`, NATS closed at 30 s, Vision skipped, pool 1m | 10 min 40 s | pass |
| R4c | 68 | R4 with `OTEL_METRIC_EXPORT_INTERVAL=60000` (control) | never (64 min of wall time, 61 polls) | fail |
| E1 | 68 | piggybacked on R3: one `GET /ping` after Sleeping | n/a | restart on wake |

Answers to the five questions:

1. Does a zero-change PR environment stay Active? Yes. R0 never reached Sleeping in 60 min, so the analysis holds and the dev config (`OTEL_ENABLED=false`) is not enough on its own.

2. Do NATS, the Vision channel and the Postgres pool each block sleep? NATS blocks, and it takes three changes to release it. R2 (NATS open, metrics off) and R5 (client ping and kernel keepalive off, server default ping) both stayed Active because nats-server PINGs a silent client every 2 min and the client's PONG is outbound traffic. R6 (server `ping_interval: "30m"`, client `PingInterval` 30m, client keepalive off) slept at 7 min, and R3 (connection closed at 30 s) slept at 7 min 48 s. Vision is not a long blocker: R3b slept at 13 min, not 30 to 40 min, although one sample each cannot explain why it was about 5 to 6 min later than R3 (Railway samples inactivity over a 5 to 10 min window, so treat the gap as noise or a small Vision effect, not a measured cost). The Postgres pool was not isolated: every sleeping run had `DB_CONN_MAX_LIFETIME=1m`, and the runs with `5m` (R0, R2, E0) also had NATS open, so a pool lifetime of 5 min is untested on its own.

3. Do kernel TCP keepalive probes count? Yes. R6 and R8 are identical except for the API-side Go dialer keepalive (15 s probes on the NATS socket): R6 (off) slept at 7 min, R8 (on) never did in 60 min. One open tension: R3b kept the Vision gRPC channel configured and still slept at 13 min, even though that channel has its own 15 s keepalive and a 30 min idle timeout, so either the channel was not actually connected until the first RPC or its probes behave differently from the NATS socket. That was not tested.

4. Does `OTEL_METRIC_EXPORT_INTERVAL` unblock sleep when OTel is on? Yes. R4 (30 min interval, NATS closed, Vision skipped, pool 1m) slept at 10 min 40 s, just inside the pass band, and R4c (identical but a 60 s interval) never did in 64 min. E0 shows metric batches arriving at the collector about once a minute (alternating one-metric and four-metric batches 10 s apart) and R2 shows none with the exporter off. Caveat: the collector `debug` exporter at `basic` verbosity does not print resource attributes, so attribution rests on that on/off comparison. Traces and logs from the single request also reached Grafana, labelled `deployment.environment=preview`.

5. Does sleep stop and restart the process or freeze and resume it? It stops it, and a wake starts a fresh process. After R3 slept, one `GET /ping` returned HTTP 200 and a new `EXP boot` line appeared (`ts=2026-10-09T08:34:20Z`, after the original `08:25:56Z`). The PID is 1 both times because the container's init is PID 1, so the boot timestamp is the discriminator. Startup, including the NATS connect and Vision dial, therefore runs on every wake, and a lazy first connect buys nothing at wake; only the idle-close half of fix (b) matters. Cold-start latency was not measured.

Consequences for the recommendation: fix (b) (idle-close the API's NATS connection) plus the OTel interval change is supported by R3 and R4. Fix (a) is feasible but needs three coordinated changes (a quoted `ping_interval: "30m"` in a `nats` config file, the client `PingInterval`, and `Dialer{KeepAlive: -1}`), edits the out-of-scope `nats` service, and does nothing for any other long-lived idle socket, since kernel keepalive probes count. The residual risks to check in R7 are the Postgres pool lifetime (run with the real value, not 1 m) and the Vision channel (R3b slept at 13 min, slightly outside the 10 min target).

Limits: one sample per run (only R3b and R4 were within a few minutes of a band edge), and nothing was retried. `nats` was 2.15.0 in every run. R6 required switching the `nats` service source to the branch Dockerfile by hand in the Railway dashboard, because `railway service files upload` needed an SSH key and `environment edit` reported "No changes to apply". An unquoted `ping_interval: 30m` is rejected by nats-server 2.15.0 ("should be converted to a duration"); it must be a quoted string.

## 8. Open questions (cannot be settled from desk research)

Resolved on 2026-10-08, kept here for traceability: the actual production and preview values of `OTEL_*` and `AUTH_STATE_STORE` (former question 3, now section 2.1, user-supplied and not read from Railway), what `nats:latest` resolves to (former question 4, v2.15.0 today with unchanged ping and keepalive logic from v2.10.0 to v2.15.0, section 4.8), whether the bare `otel-collector` host resolves (it does, user-verified, 4.5), whether PR environments inherit production or development (development, user-verified, 2.1), and inbound traffic in dev and preview (none by the user's assumption, 2.1). What remains of those is listed below as items 4 to 6.

1. Does Railway count kernel TCP keepalive probes (and their ACKs) as "outbound packets"? Narrowed from the earlier draft: only the API side probes the NATS socket (4.3), but the same question applies to the Vision channel and the Postgres pool (4.7). The ticket's evidence that Postgres is "ruled out" does not settle this: the production database is Neon (`docs/deployment/preview-environments.md`), and Neon's server-side idle suspend could close those sockets, ending their probes, so those services' sleeping is not proof that live-socket probes are uncounted. Railway's blocker list includes "Keeping active database connections open" (section 3), which hints that idle sockets might count. Decided by R6 against R8.
2. Sleep model: stop/restart or freeze/resume? Decided by E1. It determines whether the Vision channel (and NATS connect) is re-created on every wake, which changes how much a lazy first connect buys (6.4).
3. Which blockers exist beyond OTel and NATS in the API as it runs today? The Vision gRPC channel (30 min idle timeout) and the Postgres pool (real `DB_CONN_MAX_LIFETIME` unknown) are unverified (4.7). Inbound traffic is not a suspect in dev and preview by the user's assumption (2.1). Decided by R0, R3 and R3b.
4. Closed 2026-10-08: the bare host `http://otel-collector:4318` resolves to the private `otel-collector` service (user-verified, 4.5). Optional sanity check only: confirm production `cashback` metrics arrive in Grafana or the collector's log.
5. Which `nats` version is actually running in production and in the PR environment? `latest` is v2.15.0 today, but Railway pulls the digest at deploy time and the docs do not say whether a plain redeploy re-pulls (section 3). Read the `Version:` line from the `nats` deploy log in each environment. Also confirm that the PR environment deploys `nats` at all (focused PR environments).
6. Narrowed 2026-10-08: the PR environment is based on development (user-verified), so it carries the development values (2.1). What remains is whether Serverless is on in dev and in the PR environment's `cashback`; read the service settings.
7. Railway's docs list "Receiving traffic ..." as a blocker but also say inbound requests "are not measured directly" (section 3). Whether a bare inbound packet that draws no reply counts is undocumented; it does not change the NATS analysis because every server PING draws a PONG, and it is moot in dev and preview where there is no inbound traffic (2.1). It only matters for production.

What to run to settle it, in order (all in a PR environment, one change at a time, redeploy before each run, no inbound traffic):

1. Free checks, no code: items 5 and 6 above; and the state of dev `cashback` today (7.1).
2. R0 (zero change). Expected Active. Then E1 on the first run that reaches Sleeping.
3. R3 and R3b (NATS closed after 30 s, Vision skipped or not, short pool lifetime, 45 min horizon). Settles item 3.
4. R6 then R8 (client ping and server `ping_interval` at 30 min, with and without client keepalive). Settles item 1 and whether fix (a) is feasible.
5. E0 and R4 only if production-like OTel needs confirming; R7 last, against the success criteria in 7.3.

## 9. Recommendation

1. Production: do the OTel env change first on the `cashback` API service only (no code): set `OTEL_METRIC_EXPORT_INTERVAL` to a value well above the sleep window (start at `1800000`, 30 min) so the 60 s metric POST stops, or `OTEL_METRICS_EXPORTER=none` if R4 shows the interval still blocks. Cost: API metrics are exported far less often (loss of up to one interval at sleep, mitigated by the shutdown flush if sleep delivers SIGTERM). Traces and logs remain event-driven and need no change. Preview and dev need nothing here, because `OTEL_ENABLED=false` already removes the exporters (4.5).
2. All environments: implement (b) for the API only, as sketched in 6.2, leaving `ProvideNATSConn`/`JetStream` untouched for the worker. Run R3b before committing to a 10 min target: if the Vision channel blocks, add a small second change (create the Vision client lazily, or pass a short `grpc.WithIdleTimeout` through `option.WithGRPCDialOption`; the option exists at `grpc@v1.82.1/dialoptions.go:771-785` but its minimum and exact effect on keepalive probes were not verified).
3. Do not implement (a). It is now feasible on paper (client `Dialer{KeepAlive: -1}` plus `PingInterval` plus a server config file), but it edits the out-of-scope `nats` service, has about 2x margin, and does not touch the Vision channel or the pool. Keep it as a fallback if R6 and R8 show it works and (b) turns out harder than estimated.
4. Separate from sleeping, worth a line in the follow-up ticket: pin the `nats` image tag (4.8) and decide whether the API should survive a NATS outage longer than about 2 min (it currently cannot, 4.2); (b) fixes the latter for the API as a side effect.

Why (b) over (a): it removes the socket, so it does not depend on ping timing, server config, kernel keepalive, or private-network idle behaviour. It touches only the repo's own code, not the `nats` service the ticket fences off. Cost: a medium-sized refactor and changed boot semantics.

Confidence (revised 2026-10-08):

| Claim | Confidence |
|---|---|
| OTel metrics POST every 60 s and block sleep in production | high (source-verified; production `OTEL_ENABLED=true` now confirmed by the user, no `OTEL_METRIC_EXPORT_INTERVAL` set, so the 60 s default applies) |
| `OTEL_ENABLED=false` removes all OTel exporters and traffic in dev and preview | high (code read, 4.5) |
| NATS client and server PING block sleep, in production and preview | high (source-verified; connection is eager and option-less in every environment) |
| Only the API side runs TCP keepalive on the NATS socket | high (source-verified at v2.10.0, v2.12.0, v2.14.0, v2.15.0; correction of the earlier draft) |
| `nats:latest` behaves the same for ping and keepalive as v2.15.0 | high for v2.10.0 to v2.15.0; the deployed version itself is unverified |
| (a) is fragile | high; it is no longer infeasible by construction |
| OTel env change plus (b) reach Sleeping within 10 min of the last request | about 50% (was about 65%). Residual risks: Vision channel up to 30 min after boot or wake if keepalive probes count (roughly even odds that they count, so it is the largest single risk), the pool if `DB_CONN_MAX_LIFETIME` is large or 0, inbound public traffic in production only (none in dev and preview by assumption), and the unknown wake model. The bare `otel-collector` host resolving (user-verified) leaves the OTel analysis unchanged |
| Cold start within 3 s p95 | not assessable without R7; likely dominated by Railway cold boot |

What the experiments must confirm: R0 (preview baseline), R3 and R3b (no third blocker, Vision), R6 and R8 (kernel keepalive and fix (a)), E1 (wake model), R4 (OTel interval, production only), R7 (success criteria).

## 10. Drafts

### 10.1 "Findings / outcome" text for CASH-23 (to be updated with measured data after experiments)

> **Status: desk research complete (updated 2026-10-08 with production and dev config), experiments pending.** Source: `docs/research/CASH-23-api-sleep-nats.md`.
>
> **Which sources block sleep (from source code, to be confirmed by bisect):**
> 1. OTel metrics (production only). The Go SDK `PeriodicReader` exports every 60 s even with no data (`sdk/metric@v1.45.0 periodic_reader.go`), and `otlpmetrichttp` POSTs unconditionally. Production has `OTEL_ENABLED=true` and no `OTEL_METRIC_EXPORT_INTERVAL`, so this alone prevents sleeping. Traces and logs only export when there is data. Dev and preview have `OTEL_ENABLED=false`, which makes `InitSDK` return before any exporter is created, so there is no OTel traffic there.
> 2. NATS (all environments). The connection is opened eagerly at boot with no options. nats.go PINGs every 2 min unconditionally (`nats.go:5774`), and nats-server PINGs any silent client every `ping_interval` (2 min, `client.go:5842`), so the client must answer with an outbound PONG. The API-side Go dialer also sends 15 s TCP keepalive probes; nats-server disables keepalive on its client listener (`util.go:267`). `nats:latest` is v2.15.0 today and this logic is unchanged from v2.10.0.
> 3. Candidate, unverified: the Vision gRPC client dials at boot and stays connected until a 30 min idle timeout, with Go's 15 s keepalive in between. The Postgres pool is bounded by `ConnMaxLifetime`.
> 4. Not blockers: JetStream publish and KV calls add no periodic traffic; the `/ping` healthcheck is deploy-time only; in-API tickers are in-memory.
>
> **Fix (a) keepalive tuning: not recommended.** Client-only tuning does not work because the server PINGs idle clients. Server `ping_interval` has no CLI flag and needs a config file on a scratch image, which touches the out-of-scope `nats` service. The API's kernel TCP keepalive can be switched off client-side, so (a) is feasible on paper, but it still edits the `nats` service and leaves the Vision channel and pool untouched.
>
> **Fix (b) idle-close and lazy reconnect: recommended**, API-only (the worker keeps its permanent connection). The handles `JetStream` and `KeyValue` must be re-created per connection. Needs a mutex, an in-flight counter and an idle timer that rechecks `lastUse`.
>
> **Plus an env-only OTel change on the production API service** (`OTEL_METRIC_EXPORT_INTERVAL` of 30 min or more). Confidence that both changes reach Sleeping within 10 min: about 50%, mainly because of the Vision channel and the unknown wake model.
>
> **Open:** [fill after runs] sleep state per run (R0, E0, R3, R3b, R6, R8, R7), wake model (restart vs freeze), whether kernel keepalive counts, whether the Vision channel and the pool block, deployed `nats` version, first-request p95 with and without the NATS connect step, OAuth state round-trip result.

### 10.2 Proposed follow-up ticket

Title: Let the cashback API service sleep: idle-close NATS connection and slow OTel metrics export

Description bullets:
- Context: CASH-23 findings; two confirmed blockers (OTel metrics every 60 s in production, permanent NATS connection in all environments) and one candidate (Vision gRPC channel, 30 min idle timeout).
- Config change (no code): on the `cashback` service only, set `OTEL_METRIC_EXPORT_INTERVAL` (start 1800000) and redeploy; verify in a preview environment first.
- Code change (API only): add a lazy NATS holder with mutex, in-flight counter, idle timer (re-check `lastUse`), re-create `jetstream.New` and the KV handle per connection, close with `Close()` on idle and `Drain()` on process shutdown; leave `ProvideNATSConn`/`ProvideJetStream` for worker and job unchanged; update `NewStateStore` to bind the bucket per connection; regenerate wire.
- Behaviour change to document: API boot no longer fails when NATS is down; the failure surfaces on first publish or KV call.
- Tests: race test for acquire/idle-close/reconnect, update `nats_kv_state_store_test.go` and mocks, `make lint test build-all`.
- Acceptance: Sleeping within 10 min of last request in a preview env; first request after wake enqueues and OAuth state round-trips; cold-start p95 within 3 s with the connect step recorded; no change to worker, `nats` or `otel-collector`.
- Open decision: idle window `N` (start 30-60 s), whether to keep metrics at 30 min intervals or turn them off on the API, and whether the Vision client needs to be lazy or given a short idle timeout (decided by R3b).
- Optional hygiene: pin the `nats` image tag (currently `nats:latest`, resolves to v2.15.0 on 2026-10-08).
- Adjusted by the CASH-24 results (section 7.5): the OTel interval change is confirmed as an independent blocker (R4 against R4c), so it is not optional; NATS is confirmed as a blocker and closing the connection (R3) is enough; Vision is not a 30 min blocker (R3b slept at 13 min) so making it lazy is optional and only needed if R7 misses 10 min; the Postgres pool lifetime is untested alone, so R7 should run with the real `DB_CONN_MAX_LIFETIME` and the acceptance check should record it; sleep restarts the process on wake, so lazy first connect is not needed, only idle-close. Acceptance should allow for Railway's 5 to 10 min inactivity sampling (R3 slept at 7 min 48 s, R4 at 10 min 40 s).

## 11. Sources and pins

- Railway: https://docs.railway.com/deployments/serverless (sections "Applying the setting", "Inactive service detection", "Waking a service up", "Caveats"; re-read 2026-10-08); https://docs.railway.com/environments; https://docs.railway.com/services; https://docs.railway.com/networking/private-networking/how-it-works; https://docs.railway.com/deployments/healthchecks; https://docs.railway.com/networking/private-networking; https://docs.railway.com/networking/public-networking/specs-and-limits.
- nats.go v1.52.0 (pinned in `backend/go.mod`): https://github.com/nats-io/nats.go/tree/v1.52.0 (`nats.go`, `jetstream/jetstream.go`, `jetstream/kv.go`, `jetstream/publish.go`). Read from the local module cache copy of that tag.
- nats-server v2.15.0 (latest release at research time; `nats:latest` floats): https://github.com/nats-io/nats-server/tree/v2.15.0/server (`client.go`, `const.go`, `opts.go`, `server.go`, `monitor.go`). `processPingTimer` was diffed against `main` (7f6b195) and is identical.
- nats-server docs: https://docs.nats.io/running-a-nats-service/configuration (`ping_interval`, `ping_max`).
- nats-docker (image layout): https://github.com/nats-io/nats-docker/blob/0e72748d3cb553ccdb8c2da7c75ec3b767be51a5/2.15.x/scratch/Dockerfile (commit `Release v2.15.0`; the `main` branch already references 2.15.1-RC.2). Tag resolution: https://hub.docker.com/v2/repositories/library/nats/tags/latest and https://github.com/docker-library/official-images/blob/master/library/nats. Releases: https://github.com/nats-io/nats-server/releases (v2.15.0, 2026-09-17; v2.15.1-RC.2, 2026-10-06), upgrade guide https://docs.nats.io/release-notes/upgrade-to-2.15. `util.go` `natsListenConfig` (`KeepAlive: -1`) and `const.go` ping defaults were checked at tags v2.10.0, v2.12.0, v2.14.0, v2.15.0.
- nats.go v1.54.0 (latest at research time, not pinned): https://github.com/nats-io/nats.go/releases (v1.52.0 to v1.54.0 release notes) and `nats.go` at that tag for the dialer and `processPingTimer`.
- OpenTelemetry specification: https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/configuration/sdk-environment-variables.md (`OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_METRIC_EXPORT_TIMEOUT`, `OTEL_BSP_*`, `OTEL_BLRP_*`, `OTEL_SDK_DISABLED`). OpenTelemetry Go changelog for the cardinality default: https://github.com/open-telemetry/opentelemetry-go/blob/v1.45.0/CHANGELOG.md (section 1.44.0/0.66.0).
- Google and gRPC clients read from the local module cache: `google.golang.org/grpc` v1.82.1 (`clientconn.go`, `dialoptions.go`), `google.golang.org/api` v0.287.1 (`transport/grpc/dial.go`), `cloud.google.com/go/vision/v2` v2.14.0, `cloud.google.com/go/storage` v1.66.0 (`doc.go`, `metrics.go`), `github.com/kroma-labs/sentinel-go` v0.3.4 (`httpserver/metrics.go`, `middleware_tracing.go`), Go 1.26.3 `database/sql/sql.go`.
- OpenTelemetry Go: `go.opentelemetry.io/otel/sdk` v1.45.0 (`trace/batch_span_processor.go`), `sdk/metric` v1.45.0 (`periodic_reader.go`, `env.go`), `sdk/log` v0.20.0 (`batch.go`, `exporter.go`), `exporters/otlp/otlpmetric/otlpmetrichttp` v1.44.0 (as resolved in `go.mod`), `contrib/exporters/autoexport` v0.69.0 (`metrics.go`). Read from the local module cache.
- Go standard library `net/dial.go` (Go 1.26; image builds with `golang:1.26.7`) for default keepalive constants; pgx v5.10.0 `pgconn/config.go:978-981` (default dialer relies on Go keepalive).
- YouTrack CASH-23 for scope, timebox, experiment rules and success criteria.
