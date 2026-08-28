# Cashus Monorepo

Two independently-developed apps living in one repo:

- `frontend/` — React/Vite SPA. See `frontend/CLAUDE.md` for stack, structure, and conventions.
- `backend/` — Go API (Gin + GORM). See `backend/CLAUDE.md` for stack, structure, and conventions.

## This session's role: orchestrator, not implementer

The root session does not edit files inside `frontend/` or `backend/` directly. Instead, delegate to the matching subagent:

- Anything touching `backend/` → dispatch the `backend-agent` subagent.
- Anything touching `frontend/` → dispatch the `frontend-agent` subagent.

Root-level changes (this file, root `Makefile`, `.github/`, `README.md`, root `scripts/`) are fine to make directly — they aren't owned by either component agent.

Each subagent's first action is to read its own component's `CLAUDE.md` in full, then work exclusively within its one directory. See `.claude/agents/backend-agent.md` / `.claude/agents/frontend-agent.md` for the exact scoping instructions — there is no directory-sandboxing mechanism in this harness, so scoping is prompt-enforced, not structurally guaranteed.

## Single-component task

Dispatch the one matching agent. No worktree isolation needed unless you're also running something else in parallel against the same files.

## Cross-cutting feature (touches both frontend/ and backend/)

Diverging API assumptions between two independently-working agents is the main failure mode here. Prevent it with a contract-first, then-parallel-worktree-dispatch recipe:

1. **Design the API contract yourself, first, as a concrete written artifact** — exact endpoint routes, HTTP methods, request body shape, response body shape, status codes. Do this before dispatching anyone. This is the one piece of cross-cutting design the orchestrator owns directly rather than delegating.
2. **Dispatch both agents in the same response, in parallel** — one `Agent` tool call for `backend-agent`, one for `frontend-agent`, both issued in the same turn. Give both the *identical* contract text in their prompts, plus each one's own slice of the feature description.
3. **Use `isolation: "worktree"` on both dispatches.** Running two implementation subagents in parallel is normally unsafe (they can conflict editing the same working tree) — worktree isolation is what makes it safe here: `backend-agent` and `frontend-agent` never touch each other's files, but each still needs its own working tree to run its own build/test/lint commands without racing the other.
4. After both return, review and integrate their worktree branches back into the main branch.

Each component keeps its own build/test commands and conventions in its own `CLAUDE.md` — read the relevant one (or let the matching subagent read it) before working in that directory.

## Post-implementation review

After `backend-agent` or `frontend-agent` finishes *implementing* something (not for pure exploration/read-only tasks), the orchestrator dispatches one code-review subagent per component that was actually changed — e.g. `pr-review-toolkit:code-reviewer`, prompted to look only at the diff under that component's directory.

1. **One review pass per component, ever, per feature.** Never re-dispatch the reviewer after fixes are applied to check its own fixes — that's how review↔fix loops become endless. One review, one fix pass, done.
2. **Findings go to the implementation subagent, not the orchestrator.** It wrote the code — it's the one that fixes or consciously dismisses each finding. The orchestrator doesn't triage findings itself.
3. **Doubt escalates to the orchestrator, not back to the reviewer.** If the implementation subagent disagrees with a finding, or isn't sure whether applying it is correct, it stops and reports the specific finding + its concern to the orchestrator instead of re-arguing with the reviewer or guessing. The orchestrator decides, then tells the implementation subagent how to proceed.
4. For a cross-cutting feature, this happens independently for each side after both implementation subagents return from their worktrees — same one-shot rule, once per component, not once for the whole feature.
