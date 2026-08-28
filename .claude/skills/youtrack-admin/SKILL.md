---
name: youtrack-admin
description: Use for changing the YouTrack tracker's own structure — custom fields, enum/state bundles and their values, project field attachments, default values, and Agile board columns. Uses the REST API directly via curl, never the MCP tools (which don't expose admin operations). Assumes $YOUTRACK_TOKEN is already set in the environment — never search for a token or ask the user for one.
allowed-tools: Bash(curl:*), Bash(jq:*)
---

# YouTrack admin — REST API

This is for reconfiguring the tracker itself (fields, bundles, board columns, project settings) — not for reading or grooming tickets (see `youtrack-tickets` for that, via MCP).

Base URL: `https://youtrack.cashus.online/api`. Auth: `-H "Authorization: Bearer $YOUTRACK_TOKEN"` on every call — the token is always present in this environment, don't check for it or prompt for it.

## Preflight discipline — always GET before you POST

This is a live, shared system with no dry-run and no undo. Before any mutation:
1. GET the current state of whatever you're about to change (project custom fields, bundle values, board columnSettings).
2. Check whether the resource you're about to touch is shared with other projects (`GET /api/admin/projects?fields=id,shortName,name`, then check each project's `/customFields` for the same bundle id). YouTrack auto-scopes some bundles per-project by convention (state/Stage bundles are usually named `"<ProjectName>Stage<uuid>"` and are project-exclusive) but enum bundles (e.g. the default "Types", "Priorities") are shared across every project that attaches that field unless you deliberately create a project-specific one.
3. Default to creating a new project-scoped bundle rather than mutating a shared one, unless explicitly told the change should apply tracker-wide.

## Key endpoints

| Operation | Call |
|---|---|
| Get project | `GET /api/admin/projects/{key}` |
| List a project's custom fields | `GET /api/admin/projects/{key}/customFields?fields=id,field(id,name),bundle(id,name,$type),$type` |
| Attach a field to a project | `POST /api/admin/projects/{key}/customFields` — body `{"$type": "<Type>ProjectCustomField", "field": {"id": "..."}, "bundle": {"id": "...", "$type": "..."}}` |
| Update a project field (bundle / defaults) | `POST /api/admin/projects/{key}/customFields/{projectCustomFieldId}` — partial body, only the changed keys |
| List/create enum bundle | `GET/POST /api/admin/customFieldSettings/bundles/enum` |
| List/create state bundle values | `GET/POST /api/admin/customFieldSettings/bundles/{enum|state}/{bundleId}/values` |
| Update/delete one bundle value | `POST` (update) or `DELETE` `.../values/{valueId}` |
| List agile boards | `GET /api/agiles?fields=id,name,projects(shortName),columnSettings(...)` |
| Get/update one board | `GET/POST /api/agiles/{id}` |
| Reorder one column | `POST /api/agiles/{id}/columnSettings/columns/{columnId}` — body `{"ordinal": N}` |
| Your own user id (for default Assignee) | `GET /api/users/me?fields=id,login,fullName` |

## Gotchas (all confirmed by hand — don't relearn these the hard way)

1. **Renaming/updating an existing bundle value** is `POST .../values/{id}` with just the changed field (e.g. `{"name": "New Name"}`) — not PATCH, not PUT.
2. **New bundle values append with an auto ordinal.** To get a specific order, `POST .../values/{id}` with an explicit `{"ordinal": N}` on each value afterward.
3. **`defaultValues` needs an explicit `$type`** on the referenced element (`EnumBundleElement`, `StateBundleElement`, `User`) — id alone throws a cryptic `java.lang.InstantiationException`.
4. **New Agile board columns reference the bundle value by `name`, not `id`.** `AgileColumnFieldValue.id` is read-only; POSTing `{"fieldValues": [{"id": "..."}]}` fails with "Invalid entity type" — use `{"fieldValues": [{"name": "..."}]}` instead.
5. **New columns always append at the end**, regardless of where you place them in the submitted array. To position one, `POST /api/agiles/{id}/columnSettings/columns/{columnId}` with `{"ordinal": N}` directly — resubmitting the whole array in a different order does *not* reorder existing columns.
6. **Every write should be followed by a GET-based verification** (or use `?fields=...` on the write response itself) — don't assume a 200 means the shape you expected.

## Example: giving a project its own exclusive Type list

(This is exactly what was done for CASH — reuse this pattern for any project that needs its own Type/Priority list instead of the shared one.)

```bash
# 1. Create a project-scoped bundle
curl -s -H "Authorization: Bearer $YOUTRACK_TOKEN" -H "Content-Type: application/json" \
  -X POST "https://youtrack.cashus.online/api/admin/customFieldSettings/bundles/enum?fields=id,name" \
  -d '{"name": "<Project>Type"}'

# 2. Add values (repeat per value)
curl -s -H "Authorization: Bearer $YOUTRACK_TOKEN" -H "Content-Type: application/json" \
  -X POST "https://youtrack.cashus.online/api/admin/customFieldSettings/bundles/enum/{bundleId}/values?fields=id,name,ordinal" \
  -d '{"name": "Epic"}'

# 3. Point the project's existing Type field at the new bundle
curl -s -H "Authorization: Bearer $YOUTRACK_TOKEN" -H "Content-Type: application/json" \
  -X POST "https://youtrack.cashus.online/api/admin/projects/{KEY}/customFields/{projectCustomFieldId}" \
  -d '{"bundle": {"id": "{newBundleId}", "$type": "EnumBundle"}}'

# 4. Set a default (note the explicit $type)
curl -s -H "Authorization: Bearer $YOUTRACK_TOKEN" -H "Content-Type: application/json" \
  -X POST "https://youtrack.cashus.online/api/admin/projects/{KEY}/customFields/{projectCustomFieldId}" \
  -d '{"defaultValues": [{"id": "{valueId}", "$type": "EnumBundleElement"}]}'
```
