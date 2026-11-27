# CASH-34: backend release and production adoption

**Status: local implementation checks pass except vulncheck; production adoption
is not verified.**
No live changes are authorized by this document. Keep CASH-34 open until the owner
approves the target/steps, runs the checklist, and records the results below.

Scope: [CASH-34](https://youtrack.rleonb.com/issue/CASH-34).
Decisions: [CASH-33 plan](cash-33-plan.md).

## Release behavior

API, worker, and migrator remain separate Git-backed Dokploy applications. They
build the configured branch HEAD, not a pinned commit. All three deployment
requests start together. There is no migration-success gate. Dokploy may queue or
schedule the builds at different times; requests sent together do not imply
simultaneous builds, activation, or equal revisions.

The migrator is independent of administrative asset sync. API and worker can
start before schema changes finish or remain active after migration failure.
This can cause startup failures or outages, even on a fresh database. The owner
accepts that risk. Every migration must work with both running and new app code.
An incompatible change needs a separate approved maintenance plan.

Use the existing database role/password for API, worker, and migrator. The owner
reported that `cashus_owner` owns app tables, belongs to `neon_superuser`, can
create databases/roles, and bypasses RLS. Separate migration/runtime roles and
restricted runtime grants are deferred. A different preview DB host does not
prevent these credentials from accessing live production if reachable. Never
log the password, rotate/drop the shared role during cleanup, or change production
settings through preview tooling.

## Local migrator commands and configuration

From the repo root:

```sh
make -C backend build-migrate
make -C backend migrate
make -C backend test-migrate
```

`test-migrate` owns disposable local PostgreSQL18 containers with generated TLS
certificates; it needs Docker and does not use production DB configuration.
`migrate` runs the executable with no arguments. Supply its environment explicitly;
do not depend on the full application's config or asset-sync setup.

Required exports: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
`DB_SSL_MODE` defaults to and must equal `verify-full`. `DB_SSL_ROOT_CERT` can
specify a trusted CA file; mount it read-only in the container when needed. Use a
direct TCP host. Known Neon `-pooler` hostnames are rejected; the program cannot
detect every proxy from its hostname. No URL/DSN or password belongs in command
arguments or logs.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MIGRATE_CONNECT_TIMEOUT` | `10s` | Connection/ping wait |
| `MIGRATE_LOCK_TIMEOUT` | `60s` | Goose advisory-lock wait and PostgreSQL lock wait |
| `MIGRATE_STATEMENT_TIMEOUT` | `5m` | PostgreSQL statement limit |
| `MIGRATE_TIMEOUT` | `15m` | Whole migration run, including lock waits |

All durations must be between `1s` and `24h`. Choose limits for the reviewed
migration; a long valid migration can fail if its statement/whole-run limit is
too short. This is a failure to inspect, not permission to raise limits blindly.
The process handles SIGINT/SIGTERM through cancellation. Successful runs report
version, applied count, and `exit_status=0`; failures report safe stage/version/
SQLSTATE identifiers and exit 1 without printing raw driver/SQL errors.

Build the dedicated image with backend as its context:

```sh
docker build -f backend/Dockerfile.migrate -t cashus-migrate:local backend
```

The image embeds existing SQL files and runs `/migrate` as a non-root user. It
needs no application assets or migration directory mount. Pass required DB
variables through an approved secret mechanism; do not bake them into the image.
Administrative `make -C backend job` now runs asset sync without migrations.

## Prepare Dokploy (owner approval required)

1. Verify the target project/environment, three application IDs, repository, and
   branch. Confirm database and messaging prerequisites exist before release
   requests. Use `main` for production. Use GitHub source, build path `/backend`,
   Dockerfile build type, and Docker context `.` on each app. Dockerfiles are
   `Dockerfile`, `Dockerfile.worker`, and `Dockerfile.migrate` respectively.
2. Set the migrator to a normal replicated service, one replica, with
   `restartPolicySwarm: {"Condition":"none"}`, `modeSwarm: null`, and no command
   override. Use the image entrypoint. Do not use `ReplicatedJob`: the researched
   Dokploy version injects UpdateConfig, which Swarm jobs reject.
3. Set only required DB configuration on the migrator. Use the same DB credentials
   as API/worker and a direct TLS endpoint, not a transaction pooler. Keep secrets
   in the existing secret system; never copy passwords into this document or logs.
4. Review and disable old independent deployment triggers that would bypass the
   three-app request path. Do not change unrelated administrative job triggers.
   Confirm no asset-sync or legacy migration job runs as a release prerequisite.
5. Validate the no-restart path with the **actual migrator image** on an approved
   disposable database before enabling production triggers. Record success,
   nonzero failure, unchanged redeploy, task IDs, and absence of a restart loop.

## Request a release

The script requires Python 3 and curl. It uses verified HTTPS, no redirects,
finite request waits, private temporary response files, and credentials through
stdin to curl, not command arguments. It never prints API response bodies.
Required exports are `DOKPLOY_HOST` (HTTPS origin) and `DOKPLOY_TOKEN`; Cloudflare
Access needs both `CF_CLIENT_ID` and `CF_CLIENT_SECRET`, or neither. Do not use
shell tracing. App metadata can contain secrets; do not capture raw responses.

First inspect the offline plan. It makes no network calls and reads no credentials:

```sh
python3 scripts/dokploy_release.py \
  --branch main --requested-sha "$(git rev-parse HEAD)" \
  --api-id API_ID --worker-id WORKER_ID --migrator-id MIGRATOR_ID
```

After the owner approves the target and release, run the same command with
`--execute`. It checks all app settings before the first write, then sends three
`POST /api/application.deploy` requests concurrently. It does not change settings,
build images, run SQL, wait for migration success, or automatically retry. It
requires all apps to share the same environment, GitHub repository, and branch.

Each JSON result separates `requested_sha` from `observed_revision: null`.
`request_status: accepted` means HTTP request acceptance only. All results retain
`process_status: unknown`. A transport failure may occur after the server queues
a request, so `failed_or_unknown` does not prove nothing happened.

Exit 0 means all requests were accepted; exit 1 means validation or a request
failed/has an unknown result; exit 130 means interruption. Inspect all apps after
an interruption or partial failure before an explicit retry. The script leaves
existing releases intact and never cancels deployments or rolls back the database.

### GitHub Actions setup (disabled until adoption)

`.github/workflows/backend-release.yml` sends the same three requests on backend
pushes to `main` or a manual run on `main`. It uses no migration-success dependency
and performs no release-image builds or migration execution in Actions. Existing
CI image scans are separate from release-image delivery.

Set repository variables `DOKPLOY_API_ID`, `DOKPLOY_WORKER_ID`, and
`DOKPLOY_MIGRATOR_ID`. Put `DOKPLOY_HOST`, `DOKPLOY_TOKEN`, and optional Cloudflare
Access credentials in the `production` GitHub environment secrets. Use a token
with only the access needed to read those app settings and request deployment.
Keep management credentials out of builds and containers.

Leave repository variable `BACKEND_RELEASE_ENABLED` unset/false until the owner
completes adoption. Set it to `true` only with separate approval. The workflow
uses the `production` environment so its configured approval rules apply. It
serializes request runs without cancelling an in-flight run. GitHub may replace
pending runs; branch-HEAD releases do not promise one deployment per commit.
A queued run can request a newer branch revision than its audit SHA.

## Observe completion; do not infer success

CASH-37 researched Dokploy v0.31.4, source commit
`37b34768a00b6fb7b19a0db4dcae64c8fff9dfc8`. Its recorded disposable tests showed:

- Normal one-replica service, restart condition `none`: `sleep 15` reached task
  `Complete`; `false` reached `Failed` with nonzero exit 1; unchanged redeploy
  produced a fresh task. These were simple commands, not this migrator image.
- Deployment status `done` did not prove process success. The inspected API
  exposed task state/error, not a numeric exit field or reliable release-to-task
  mapping. Exit 17 was not verified for an independent Application.
- A transient additional running task appeared during testing. Absence of a
  restart loop for the real image remains an adoption check, not a proven fact.

For each release, retain the requested branch/SHA, request time, deployment IDs,
service/task/container IDs, and any actually observed built revision. Do not
report a title's SHA as an observed revision. If no safe mapping exists, record
completion as unknown and inspect with approved host access.

With approved Docker access, inspect the **specific task/container**, not merely
the latest app deployment: `docker service ps --no-trunc SERVICE`, then
`docker inspect TASK_ID` for `Status.State`, `Status.Err`, and
`Status.ContainerStatus.ExitCode`; inspect the exact container's logs where
available. Confirm timestamps/task IDs match the attempt. Treat logs as sensitive;
record only safe migration/version/result fields. Do not paste full inspect data,
env, connection strings, or unrestricted logs into a ticket.

Require a completed process with exit 0 and the expected final migration version
before claiming migration success. Check API health and worker behavior separately.
If task records/logs have expired or cannot be matched, report unknown, not success.

## Owner-run production adoption checklist

1. **Inventory, read only:** confirm target DB and direct host, certificate-verified
   TLS, PostgreSQL version, executable `uuidv7()`, `pg_trgm` version and extension
   privileges. Record current Goose history and ownership/grants. Owner-reported
   research found PG18.7, pg_trgm1.6, and 41 nonzero versions through
   `20260904090000`; the repo also had `20260905090000`. Recheck current facts;
   never stamp, renumber, or silently repair history. Verify a usable backup/PITR
   recovery point without changing live data.
2. **Disposable rehearsal:** run full migrations on a fresh PostgreSQL18 DB and
   a representative existing schema/history. Check no-op, nonzero failure,
   bounded waits, concurrent serialization, and explicit retry with intact history.
   Verify shared-role API/worker access and unrelated asset sync still work.
3. **Review the change window:** list pending migrations and prove compatibility
   with both app revisions. Review the no-restart configuration, timeouts, secret
   references, trigger changes, and recovery steps. Obtain separate approval for
   the named production apps/database and exact changes before writes.
4. **Adopt and observe:** the owner configures the migrator and approved triggers,
   requests all three deployments together, and records actual migration process
   results, DB version, API health, and worker behavior. Do not run asset sync as
   a release step. Do not rotate shared credentials or introduce new roles here.
5. **Verify and record:** confirm no restart loop, successful no-op redeploy, all
   three workloads' shared-role access, and no secret leakage. Enable the release
   workflow only after approval. Fill in the record below; keep the Story open
   while any required live check remains unverified.

## Recovery

A failed request, failed migration, or unknown completion requires inspection,
not automatic retry. The API/worker may already run new code. Record each app's
observed state/revision and the last confirmed migration version. Check for still
running migration tasks and DB locks before another attempt; do not kill another
release's process blindly.

After identifying the cause, explicitly retry the migrator or the three-app
release. Goose history must remain unchanged for failed transactional migrations;
nontransactional SQL can leave partial objects and needs a reviewed forward repair.
Never mark a failed migration complete or automatically run down migrations.
A compatible application rollback is an owner action; it does not undo schema
changes. If compatibility is not clear, stop for an approved maintenance plan.

Do not drop the shared role, change production settings through preview cleanup,
or restore a database without a separately approved data recovery plan.

## Local verification (not production acceptance)

`make -C backend lint` and `make -C backend build-all` pass. The dedicated image
build passed, and missing DB config caused a nonzero container exit without
credentials in output. No live Dokploy run of that image was performed.

`make -C backend test-migrate` passes all CLI integration checks: fresh full
42-version history, no-op, genuine 41-version existing history with a seeded
profile, failed migration and retry, concurrent locking and finite lock timeout,
and config validation/secret redaction. The lock test uses Goose v3.27.3's public
advisory key and observes its retry query; changes to Goose may need a test update.
The existing-history fixture is representative schema/data, not a production copy.

`make test` at the repo root passes the backend suite, 65 frontend tests, and
22 offline script tests. The script checks cover concurrent requests, branch
updates, preflight rejection, partial failures, interruption after requests start,
and explicit retry. These use a fake HTTP boundary, not a live Dokploy release.

`make -C backend vulncheck` fails: govulncheck reports 19 reachable vulnerabilities
from five modules and the Go standard library. Dependencies and toolchain pins
remain unchanged in this work. Findings include OpenTelemetry advisories
[GO-2026-6975](https://pkg.go.dev/vuln/GO-2026-6975),
[GO-2026-6974](https://pkg.go.dev/vuln/GO-2026-6974), and Go TLS/HTTP advisories.
Dependency/toolchain fixes need separate work; do not report all checks green.

## Adoption record

| Check | Result / evidence |
| --- | --- |
| Approved production target, steps, owner, time | Not approved or executed in this implementation |
| Fresh and representative existing DB tests | Local PG18 TLS CLI tests pass; no production-data clone tested |
| Live direct TLS, history, ownership, extensions | Owner-reported metadata only; current target not verified |
| Real Dokploy migrator exit/redeploy/no-restart | Not verified; CASH-37 used simple test commands |
| Parallel production triggers and app health | Not enabled or verified |
| Shared-role API/worker/migrator live access | Not verified for the new migrator |
| Final adoption / CASH-34 closure | Blocked pending owner-run checks |

## Source evidence

[CASH-37 findings and owner comment](https://youtrack.rleonb.com/issue/CASH-37)
are the source for earlier live observations; this implementation did not repeat
them. Version-pinned Dokploy source:

- [Application API](https://github.com/Dokploy/dokploy/blob/37b34768a00b6fb7b19a0db4dcae64c8fff9dfc8/apps/dokploy/server/api/routers/application.ts)
- [Swarm config and default UpdateConfig](https://github.com/Dokploy/dokploy/blob/37b34768a00b6fb7b19a0db4dcae64c8fff9dfc8/packages/server/src/utils/docker/utils.ts#L644-L714)
- [Service builder](https://github.com/Dokploy/dokploy/blob/37b34768a00b6fb7b19a0db4dcae64c8fff9dfc8/packages/server/src/utils/builders/index.ts#L146-L280)
- [Branch clone path](https://github.com/Dokploy/dokploy/blob/37b34768a00b6fb7b19a0db4dcae64c8fff9dfc8/packages/server/src/utils/providers/github.ts#L224-L238)
