# Preview deployment pipelines

CASH-10. When a PR is opened against any branch, `.github/workflows/preview-environments.yml`
provisions a temporary preview stack and tears it down when the PR closes/merges. The
dev/staging environment is never touched.

Only same-repository PRs get a preview. A `pull_request` workflow run for a fork PR (or a
Dependabot PR) doesn't have access to repo secrets, so the workflow deliberately skips
provisioning for those rather than failing on empty credentials — it does not switch to
`pull_request_target`, which would run this workflow (and hand out secrets) against
unreviewed PR code.

## What gets provisioned per PR

1. **Neon** — a database branch named `preview/pr-<number>`, forked from the `production`
   branch. Owned entirely by the workflow: deleted and recreated fresh from `production` on
   every open/reopen/synchronize (the underlying action returns an existing branch as-is
   rather than resetting it, so without this the branch would keep stale schema/data across
   pushes), and deleted again on close. Reuses the role and database that already exist on
   `production` (`NEON_ROLE_NAME` / `NEON_DATABASE_NAME` below) — branching copies them, so
   the action just looks up their connection details rather than creating new ones.
2. **Railway** — an ephemeral "PR environment" that Railway itself auto-creates once
   **PR Deploys** is enabled on the `cashus-backend` project (Project → Settings →
   Environments). The workflow's only job here is to push that PR's Neon credentials
   (`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`) onto the `cashback`,
   `cashback-worker`, and `cashback-job` services in that environment — Railway clones
   them from production otherwise, which would point the preview backend at the
   production database. Railway deletes the environment automatically on PR close/merge.
3. **Vercel** — preview deployments are already automatic (git integration, enabled by
   default). The workflow scopes `VITE_API_BASE_URL` to the PR's git branch (Preview env
   var, branch-scoped) so the frontend preview talks to *that PR's* Railway API instead of
   whatever default is configured, then builds and deploys via the Vercel CLI so the new
   value is baked into the build. On close, the workflow explicitly deletes that branch's
   preview deployment(s) via the Vercel API — Vercel does *not* do this itself; closing a
   PR only removes the deployment's "active" protection, after which it's still subject to
   the project's ordinary retention policy rather than being deleted right away.

The workflow comments the three resulting URLs on the PR (updating the same comment on
each push) so reviewers don't have to hunt for them.

## One-time setup

Run the wizard once:

```bash
./scripts/setup-preview-environments.sh
```

It walks through, and sets as GitHub Actions repo secrets:

| Secret | Where it comes from |
|---|---|
| `NEON_API_KEY` | Neon console → Account Settings → API keys |
| `NEON_PROJECT_ID` | Neon console → cashus project → Settings → General |
| `NEON_ROLE_NAME` | Neon console → `production` branch → Roles & Databases (must already exist) |
| `NEON_DATABASE_NAME` | same tab — matches `DB_NAME` in `backend/.env.example` |
| `RAILWAY_API_TOKEN` | Railway → Account Settings → Tokens — **must be account-scoped**, not a project token (see below) |
| `RAILWAY_PROJECT_ID` | Railway → cashus-backend project → Settings → General |
| `RAILWAY_ENVIRONMENT_ID` | Railway → cashus-backend project → any persistent environment's name/ID (e.g. `development`) |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `frontend/.vercel/project.json` after `vercel link`, or Vercel project settings |
| `VERCEL_PROJECT_ID` | same as above |

It also offers to flip Railway's **PR Deploys** setting on for you (there's no CLI flag for
it — it's a `projectUpdate` GraphQL mutation, or a dashboard toggle if you'd rather do it
by hand). This step doesn't get repeated per PR; it's a one-time project setting.

**Why `RAILWAY_API_TOKEN` has to be account-scoped**: Railway project tokens are pinned to
the single environment they were created for — confirmed against a live run, where a
project token could only ever list the one environment it was scoped to, never the PR
environments Railway creates on the fly. The workflow needs to find and act on whichever
environment Railway just created for a given PR, which only an account-scoped token can
see. That's broader access than this workflow strictly needs (it can see every project on
the account, not just `cashus-backend`); if that's a concern, use a Railway account
dedicated to CI rather than a personal one.

**Why `RAILWAY_PROJECT_ID`/`RAILWAY_ENVIRONMENT_ID` are needed too**: unlike a project
token, an account token carries no implicit project/environment context, so the workflow
runs `railway link --project ... --environment ...` before its first Railway command.
Any persistent environment works for this — it only bootstraps project context; from
there, `railway environment list` already returns every environment in that *project*
(the PR's included), and every later Railway CLI call passes `--environment` explicitly.

## Why the workflow deploys Vercel itself instead of relying purely on git integration

`VITE_*` variables are baked in at Vite build time, and Vite build happens on Vercel's
side. To get the *correct* backend URL (this PR's Railway environment, not a static
default) into that build, the value has to be set before the build runs — so the workflow
sets the branch-scoped env var and then drives the build itself via the Vercel CLI
(`vercel pull` → `vercel build` → `vercel deploy --prebuilt`), rather than trusting
whichever build Vercel's git integration already kicked off (which fires before the
Railway environment/URL exists). Vercel's own git-integration preview build still exists
alongside it; the workflow's deployment is the one with the correct API URL, and its link
is what gets commented on the PR.

## Troubleshooting

- **Workflow times out waiting for a Railway environment**: either PR Deploys isn't enabled
  on the Railway project, Railway hasn't finished creating it yet, or `RAILWAY_API_TOKEN` is
  a project token rather than an account token (see above) and genuinely can't see it — the
  timeout's error output includes the last `railway environment list --json` the workflow
  saw, which is the fastest way to tell these apart.
- **Workflow times out waiting for a Railway domain**: the `cashback` service failed to
  build/deploy in the PR environment — check its logs from the Railway dashboard link Railway
  posts as a PR comment.
- **Frontend preview still hits the old API URL**: the branch-scoped `VITE_API_BASE_URL`
  only applies to Vercel deployments *of that branch*; check the deployment the workflow
  linked on the PR, not an older one from before the workflow ran.
- **Neon branch creation fails with a role/database error**: `NEON_ROLE_NAME` or
  `NEON_DATABASE_NAME` doesn't match an existing role/database on the `production` branch —
  re-check them in the Neon console's Roles & Databases tab.
- **No preview on a PR from a fork**: expected — see the fork/Dependabot note above. There's
  no built-in workaround that doesn't involve exposing secrets to unreviewed code.
