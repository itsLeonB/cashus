---
name: youtrack-tickets
description: Use for reading, searching, grooming, or organizing tickets in the CASH (Cashus) YouTrack project via MCP tools (search_issues, get_issue, create_issue, update_issue, etc.). Covers backlog grooming — checking a ticket's Type is correct and its description has the required sections before moving it from Need Grooming to Open — and day-to-day ticket reading/triage. Not for changing the tracker's structure itself (custom fields, bundles, board columns) — see youtrack-admin for that.
---

# YouTrack tickets — CASH project

All operations here are scoped to `project: CASH` and go through the `mcp__youtrack__*` tools already connected in this session — never raw REST calls (that's `youtrack-admin`'s job).

## Ticket types — what each one means

| Type | Represents | Typically created by | Typically closes when |
|---|---|---|---|
| **Epic** | A large body of work spanning multiple Stories, often multiple releases. Never implemented directly. | Product/planning | All child Stories are Done |
| **Story** | A user-facing feature or capability, described from the user's perspective, independently demoable. | Product/planning, or groomed from an Epic | Acceptance criteria met, shipped |
| **Task** | Concrete technical work with no user-facing framing — refactor, chore, infra, tooling, docs. | Anyone | Definition of done met |
| **Sub-Task** | A child of a Story or Task, scoped to exactly ONE component (`backend/` or `frontend/`) — this is the unit `backend-agent`/`frontend-agent` actually implement. | Grooming (splitting a cross-cutting Story) | Its one component's deliverable is done and reviewed |
| **Bug** | A defect — something that used to work, or should work per spec, but doesn't. | Anyone | Repro no longer reproduces |
| **Spike** | Time-boxed research with no guaranteed code output — answers a question or reduces uncertainty. | Anyone facing unknowns | Timebox expires or question is answered |

## Required description sections per type

Enforce these during grooming — a ticket without them isn't ready to leave **Need Grooming**.

- **Epic**: Goal / why now · Success criteria (measurable) · Out of scope · Child stories (linked as groomed)
- **Story**: User story (`As a ___, I want ___, so that ___`) · Acceptance criteria (checklist) · Cross-cutting? link the API contract (see the `api-contract` skill) · Out of scope
- **Task**: Description (what & why) · Definition of done (checklist) · Affected component(s)
- **Sub-Task**: Parent link · Component — exactly one of `backend/` or `frontend/` · Deliverable (specific, scoped) · Definition of done
- **Bug**: Steps to reproduce · Expected behavior · Actual behavior · Environment (prod/dev/local) · Affected component(s)
- **Spike**: Question to answer · Timebox (explicit duration) · Findings / outcome (filled in after) · Follow-up ticket(s) linked

## Grooming workflow

1. `search_issues` with query `project: CASH Stage: {Need Grooming}` to list the grooming queue.
2. For each result, `get_issue` for full detail (and `get_issue_comments` if there's discussion).
3. Check: is `Type` set and correct per the table above? Does the description have every required section for that type?
4. If something's missing or wrong: `update_issue` to fix it directly (if the fix is unambiguous — e.g. wrong Type), or `add_issue_comment` asking the reporter for the missing piece, and leave it in **Need Grooming**.
5. If a **Story** touches both `frontend/` and `backend/`: create two **Sub-Task** issues (`create_issue`), one per component, each with the Component section set and linked to the parent Story via `link_issues` (`subtask of`). This is what the orchestrator (root `CLAUDE.md`) dispatches to `backend-agent`/`frontend-agent` — the Sub-Task's Deliverable section should be concrete enough to paste directly into that agent's dispatch prompt.
6. Once ready: `update_issue` to move `Stage` → `Open`.

## Reading / triage workflow

- Scope every query to `project: CASH` explicitly — don't rely on a default project.
- Before setting `Type`, `Stage`, or any enum field, call `get_issue_fields_schema` for `CASH` if you're not certain of the current valid values — they're project-specific and can change (see `youtrack-admin`).
- Use `search_issues` for lists (by assignee, type, stage), `get_issue` for full detail on one ticket, `get_issue_comments` for its discussion history.
- `manage_issue_tags` for labeling, `link_issues` for parent/child or duplicate/relates-to relationships.
