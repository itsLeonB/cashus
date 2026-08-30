# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual `Stage` values (and tags) used in the CASH YouTrack project — there's no exact 1:1 match, so some roles collapse together or fall back to a tag.

| Role in mattpocock/skills | CASH equivalent                          | Meaning                                                    |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `needs-triage`              | `Stage: Need Grooming`                    | Not yet groomed — Type/description not yet verified          |
| `needs-info`                | `Stage: Need Grooming` + a comment asking for the missing info | Waiting on reporter; still sits in the grooming queue |
| `ready-for-agent`           | `Stage: Open`                             | Groomed and ready to work (no agent/human split in CASH)     |
| `ready-for-human`           | `Stage: Open`                             | Same as above — CASH doesn't distinguish agent- vs human-ready |
| `wontfix`                   | tag `wontfix`                             | Will not be actioned — not a `Stage` value, apply via `manage_issue_tags` |

Notes:

- `Stage` is a project-scoped field on CASH (bundle `CashusStage...`); its full value set is `Need Grooming`, `Open`, `Develop`, `Review`, `Done`. Only `Need Grooming` and `Open` are relevant to triage — `Develop`/`Review`/`Done` are post-triage workflow states.
- Since `ready-for-agent` and `ready-for-human` both map to `Open`, a skill that needs to distinguish them (e.g. deciding whether to dispatch an agent) should look at other signals — e.g. whether the ticket is a properly-scoped `Sub-Task` per `youtrack-tickets`' grooming rules — rather than relying on `Stage` alone.
- Applying/removing the `wontfix` tag: use `manage_issue_tags` via the `youtrack-tickets` skill.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding value/tag from this table via the `youtrack-tickets` skill's MCP tools.
