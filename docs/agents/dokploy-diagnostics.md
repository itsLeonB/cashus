# Dokploy diagnostics

Use `scripts/dokploy_diagnostics.py` for read-only access checks and offline test
payloads. It needs Python 3 and curl; no Python packages are required.

## Check access

From the repo root, after the user approves read-only access:

```sh
(
  set +x
  set -a
  . ./.envrc >/dev/null 2>&1 || exit 1
  set +a
  python3 scripts/dokploy_diagnostics.py check
)
```

Required exports: `DOKPLOY_HOST` (HTTPS origin) and `DOKPLOY_TOKEN`. For Cloudflare
Access, also export both `CF_CLIENT_ID` and `CF_CLIENT_SECRET`.

The helper makes one `GET /api/project.all` request. It verifies the response
shape and reports only HTTP status, project count, a safe request ID if present,
and a failure category. It does not print project names, env values, raw bodies,
auth headers, or redirect targets. Headers go to curl through stdin, not command
arguments. Temporary responses stay in a private directory until the check ends.
It uses TLS verification, disables URL expansion, ignores user curl settings,
and follows no redirects.

A 403 with a Cloudflare server header alone does not identify the denial source.
The helper reports Access/challenge markers only when the body contains them;
otherwise it leaves the source unconfirmed. Use the request ID to inspect the
matching policy/log before retrying. A transport error does not prove an auth error.
A valid empty project list verifies the API response, not deploy permissions.

## Prepare a disposable test

This command only prints JSON. It makes no request and reads no credentials:

```sh
python3 scripts/dokploy_diagnostics.py payload \
  --application-id DISPOSABLE_APP_ID --result success
```

Use `--result failure` for a failing process. The payload uses `sleep 15` for a
successful process and `false` for a failed process. These avoid shell quoting:
Dokploy v0.31.4 splits its string command on spaces. This does not test exit 17.
Limits use explicit units: 128 MiB as `134217728` bytes and 0.25 CPU as
`250000000` nanocpus. It selects a normal one-replica service with restart disabled,
not Swarm job mode; Dokploy v0.31.4 adds UpdateConfig, which Swarm jobs reject.

Before sending any mutation, get approval for the target and shared-host use.
Verify the application ID belongs to a disposable test with no secrets, mounts,
or public ports; the payload does not clear existing settings. Use version-matched
API routes. Record the actual process/task result for that attempt, not just green
deployment status. Keep created resource IDs for cleanup approval.

## Local checks

Run `make test-scripts`. Tests use fake responses and synthetic credentials; they
make no cloud calls. CI runs the same check when the helper, tests, Makefile, or
script-check workflow changes. Live API compatibility still needs an approved test.
