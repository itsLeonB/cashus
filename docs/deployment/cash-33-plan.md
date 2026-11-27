# CASH-33: agreed release and preview scope

Source: [CASH-33](https://youtrack.rleonb.com/issue/CASH-33) and its latest owner
choices. Those choices replace older plans on `docs/cash-33-refined-plan` that
required separate database roles, exact-SHA builds, or migration-success gates.

## Delivery order

1. [CASH-34](https://youtrack.rleonb.com/issue/CASH-34): independent migrator,
   parallel backend release requests, and verified owner-run production adoption.
2. [CASH-35](https://youtrack.rleonb.com/issue/CASH-35): manual full-stack preview
   lifecycle with OpenTofu. Depends on CASH-34 and provider research CASH-38.
3. [CASH-36](https://youtrack.rleonb.com/issue/CASH-36): automatic eligible-PR
   lifecycle. Depends on verified CASH-35 integration.

CASH-37 closed with research findings and explicit unverified checks. Its closure
is not proof of successful migrations or production adoption.

## CASH-34 contract

Use separate Dokploy applications for API, worker, and migrator. Keep a dedicated
`backend/Dockerfile.migrate`; asset sync is not a release prerequisite. Dokploy
builds images from Git. Release Actions send requests only; they do not build
release images or execute migrations.

All three applications build the configured branch HEAD (`main` in production).
Send their deployment requests together, with no migration-success dependency.
Record the requested SHA separately from any observed built revision. A branch
can move between builds; equal component SHAs are not required or assured.

Use Goose database locking, verified direct TLS connections, finite waits, and
nonzero process exits on failure. Preserve migration history. Do not run down
migrations or repair failed history automatically. Require schema changes that
work with both the old and new apps. Incompatible changes need a separate
approved maintenance plan.

API/worker can start before migrations finish or after they fail. This can cause
startup failures or outages, including on a fresh database. The owner accepts
this risk. A green Dokploy deployment record does not prove process success.
Require explicit retry or compatible app rollback after a failed release.

Reuse the existing database role/password for all three workloads. The shared
role has broad permissions; separate and restricted runtime roles are deferred.
See [CASH-34 release and adoption](cash-34-release.md) for the owner checklist,
completion evidence, and remaining checks. Code approval authorizes no live changes.

## Later preview work (not part of CASH-34)

Use independent Dokploy applications, Neon branches, Vercel builds, Cloudflare
DNS, and one encrypted remote OpenTofu state per PR. Preserve DB/NATS data and
stable URLs across updates. No Compose conversion, reset, or idle expiry.

Previews retain copied production records and use the inherited production DB
role/password. A separate DB host does **not** isolate credentials: preview code
may access live production if reachable. The owner accepts this risk. This is the
only approved production-secret exception. Never log the password or rotate/drop
the shared role during cleanup.

Reuse Dokploy's existing Infisical Secrets Provider and preview-only scope. Merge
allowed production defaults, all preview keys, then generated PR settings. Keep
management credentials and other production secrets out of app builds, runtime,
state, and logs. Use secret references. Do not add a second secret store or new
backend preview guards.

Public previews rely on app authentication only. Copied mail/push recipients and
shared test storage remain accepted risks; test keys alone do not prove delivery
isolation. Shared resources remain owner-managed and outside PR cleanup.

Later automation admits same-repo writer PRs when ready, not forks or bots.
Returning to draft retains resources. Serialize same-PR operations; recheck current
PR state before writes or cleanup. Preserve state on failure. Cleanup targets only
verified owned resources for closed PRs, even after branch deletion. Report observed
failures and unknown completion honestly; never infer readiness from allocation.
