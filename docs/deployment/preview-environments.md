# Preview deployment pipelines

CASH-10. When a PR is opened against any branch, `.github/workflows/preview-environments.yml`
provisions a temporary preview stack and tears it down when the PR closes/merges. The
dev/staging environment is never touched.

## What gets provisioned per PR

1. **Neon** — a database branch named `preview/pr-<number>`, forked from the `production`
   branch. Owned entirely by the workflow (create on open/reopen, delete on close).
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
   value is baked into the build. Vercel expires the preview deployment on its own when
   the branch is deleted.

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
| `RAILWAY_TOKEN` | Railway → cashus-backend project → Settings → Tokens (project-scoped) |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `frontend/.vercel/project.json` after `vercel link`, or Vercel project settings |
| `VERCEL_PROJECT_ID` | same as above |

It also offers to flip Railway's **PR Deploys** setting on for you (there's no CLI flag for
it — it's a `projectUpdate` GraphQL mutation, or a dashboard toggle if you'd rather do it
by hand). This step doesn't get repeated per PR; it's a one-time project setting.

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

- **Workflow times out waiting for a Railway environment**: PR Deploys isn't enabled on
  the Railway project, or Railway hasn't finished creating it yet — check
  `railway environment list --ephemeral --json` for the project.
- **Workflow times out waiting for a Railway domain**: the `cashback` service failed to
  build/deploy in the PR environment — check `railway logs --service cashback
  --environment pr-<n>`.
- **Frontend preview still hits the old API URL**: the branch-scoped `VITE_API_BASE_URL`
  only applies to Vercel deployments *of that branch*; check the deployment the workflow
  linked on the PR, not an older one from before the workflow ran.
