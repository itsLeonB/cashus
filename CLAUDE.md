# Cashus Monorepo

Two independently-developed apps living in one repo:

- `frontend/` — React/Vite SPA. See `frontend/CLAUDE.md` for stack, structure, and conventions.
- `backend/` — Go API (Gin + GORM). See `backend/CLAUDE.md` for stack, structure, and conventions.

## Dispatch policy: when to delegate, when to act directly

The root session may edit files inside `frontend/` or `backend/` directly for a **small, single-component change** — one that stays within one file or one layer, adds no new dependency, and touches no migration or API-contract shape. Dispatch to the matching subagent for everything else:

- Anything touching both `frontend/` and `backend/` → cross-cutting recipe below.
- A **large** single-component change (crosses layers, adds a dependency, touches a migration, or is otherwise a big chunk of work) → dispatch the matching subagent (`backend-agent` / `frontend-agent`).
- **Mid-task reclassification**: if a change you started directly turns out to cross the small-change line, stop and dispatch to the matching subagent instead of continuing solo — hand it a short written summary of what you've found/done so far in the dispatch prompt, since the subagent starts cold and can't see your work.

Root-level changes (this file, root `Makefile`, `.github/`, `README.md`, root `scripts/`) are always direct — they aren't owned by either component agent.

A dispatched subagent's first action is to read its own component's `CLAUDE.md` in full, then work exclusively within its one directory. See `.claude/agents/backend-agent.md` / `.claude/agents/frontend-agent.md` for the exact scoping instructions — there is no directory-sandboxing mechanism in this harness, so scoping is prompt-enforced, not structurally guaranteed.

### Acting directly on a small change

- Read the component's own `CLAUDE.md` in full first, same as a subagent would.
- Follow the same Serena-primary tool-selection rule the subagents follow (see the tool table in `.claude/agents/backend-agent.md` / `frontend-agent.md`) — it applies here too, not only inside dispatched subagents.
- Bash: `cd backend && <command>` / `cd frontend && <command>` — don't assume shell cwd, same as the subagents.
- Serena/Read/Edit/Grep paths stay prefixed with `backend/` or `frontend/`, same self-enforcement the subagents use.
- Run the component's verification commands before calling it done — `make lint`/`vulncheck`/`test`/`build-all` for backend, `bun lint`/`bun test` (+ `bun run build` if plausible) for frontend — same bar as a dispatched subagent, just run in-session.
- Skip the dedicated post-implementation review dispatch by default — see the escape hatch under Post-implementation review below.

## Large single-component task

Dispatch the one matching agent. No worktree isolation needed unless you're also running something else in parallel against the same files.

## Cross-cutting feature (touches both frontend/ and backend/)

Diverging API assumptions between two independently-working agents is the main failure mode here. Prevent it with a contract-first, then-parallel-worktree-dispatch recipe:

1. **Design the API contract yourself, first, as a concrete written artifact** — exact endpoint routes, HTTP methods, request body shape, response body shape, status codes. Do this before dispatching anyone. This is the one piece of cross-cutting design the orchestrator owns directly rather than delegating. Before drafting, use Graphify (`mcp__claude_ai_Graphify__*`, indexes this whole monorepo as one repository) to survey both sides of the boundary: `graphify_rank_files` / `query_graph` to locate the existing handlers/components a new endpoint would touch, `graphify_impact` to see what else depends on them. Graphify is read-only recon here, not an editing tool.
2. **Dispatch both agents in the same response, in parallel** — one `Agent` tool call for `backend-agent`, one for `frontend-agent`, both issued in the same turn. Give both the *identical* contract text in their prompts, plus each one's own slice of the feature description.
3. **Use `isolation: "worktree"` on both dispatches.** Running two implementation subagents in parallel is normally unsafe (they can conflict editing the same working tree) — worktree isolation is what makes it safe here: `backend-agent` and `frontend-agent` never touch each other's files, but each still needs its own working tree to run its own build/test/lint commands without racing the other.
4. After both return, review and integrate their worktree branches back into the main branch.

Each component keeps its own build/test commands and conventions in its own `CLAUDE.md` — read the relevant one (or let the matching subagent read it) before working in that directory.

## Post-implementation review

After `backend-agent` or `frontend-agent` finishes *implementing* something (not for pure exploration/read-only tasks), the orchestrator dispatches one code-review subagent per component that was actually changed — e.g. `pr-review-toolkit:code-reviewer`, prompted to look only at the diff under that component's directory.

**Escape hatch for small direct changes**: if the orchestrator implemented the change directly (no subagent dispatch), skip this by default — passing verification commands plus your own read of the diff is the bar. Dispatch a review anyway if you're unsure about a specific piece of it; that's a judgment call, not a fixed threshold.

1. **One review pass per component, ever, per feature.** Never re-dispatch the reviewer after fixes are applied to check its own fixes — that's how review↔fix loops become endless. One review, one fix pass, done.
2. **Findings go to the implementation subagent, not the orchestrator.** It wrote the code — it's the one that fixes or consciously dismisses each finding. The orchestrator doesn't triage findings itself.
3. **Doubt escalates to the orchestrator, not back to the reviewer.** If the implementation subagent disagrees with a finding, or isn't sure whether applying it is correct, it stops and reports the specific finding + its concern to the orchestrator instead of re-arguing with the reviewer or guessing. The orchestrator decides, then tells the implementation subagent how to proceed.
4. For a cross-cutting feature, this happens independently for each side after both implementation subagents return from their worktrees — same one-shot rule, once per component, not once for the whole feature.

## Agent skills

### Issue tracker

Issues live in YouTrack, project `CASH`, not GitHub — read/write via the `youtrack-tickets` skill (MCP), tracker structure changes via `youtrack-admin` (REST). See `docs/agents/issue-tracker.md`.

### Triage labels

Mapped to CASH's `Stage` field (`Need Grooming`/`Open`) plus a `wontfix` tag — no agent/human split, some roles collapse. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
