# Issue tracker: YouTrack

Issues and specs for this repo live in the **CASH** project on YouTrack (`https://youtrack.cashus.online`), not on GitHub. GitHub is still used for the repo itself and for PRs/code review — YouTrack is the system of record for planning and triage.

## Conventions

- **Read/search/create/update tickets, comment, tag, link**: use the `youtrack-tickets` skill, which drives the `mcp__youtrack__*` MCP tools, always scoped to `project: CASH`.
- **Change tracker structure** (custom fields, bundles/enum values, board columns): use the `youtrack-admin` skill instead, which talks to the YouTrack REST API directly via `curl` (`$YOUTRACK_TOKEN`). Never use REST for ordinary ticket reads/writes — that's the MCP tools' job.
- **Ticket types**: Epic, Story, Task, Sub-Task, Bug, Spike — each with required description sections. See `youtrack-tickets` SKILL.md for the full table; skills that create tickets should follow it.
- **Workflow state** lives in the `Stage` field (values: `Need Grooming`, `Open`, `Develop`, `Review`, `Done`), not GitHub-style open/closed.

## When a skill says "publish to the issue tracker"

Create a YouTrack issue in `project: CASH` via the `youtrack-tickets` skill (`create_issue`), with `Type` set correctly and the required description sections for that type filled in.

## When a skill says "fetch the relevant ticket"

`get_issue` (and `get_issue_comments` if there's discussion) via the `youtrack-tickets` skill, scoped to `project: CASH`.

## Pull requests as a triage surface

Not applicable — YouTrack has no PR concept of its own. Code review happens on GitHub PRs as normal; triage/planning stays entirely in YouTrack tickets.
