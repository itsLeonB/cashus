# Split reminders API — CASH-28

Shared contract for SR-01 and later slices, revised after user review. SR-01 ships send, open list, and retrieve only. Routes use `/api/v1`; frontend client paths omit that prefix. Use existing response envelopes and error bodies.

## Fields

Reminder: `{id, friendshipId, senderProfileId, recipientProfileId, description, mealDate, status, createdAt, updatedAt, closedAt, expenseId}`. IDs are UUIDs. The database reminder ID defaults to `uuidv7()`. Nullable fields serialize as null. Store one nullable `expenseId` for both draft resume and confirmed completion; the expense status distinguishes them. No `draftExpenseId`, `duplicate_description`, or `idempotency_key` column.

All date/time columns use `timestamptz`. API times are RFC3339 UTC. `mealDate` is null or an RFC3339 timestamp with an explicit timezone. Normalize to UTC microseconds (truncate finer fractions), with UTC years 0001–9999. Reject date-only strings. The form keeps its date picker and sends local midnight as an ISO timestamp; render the local date rather than slicing UTC text. Different timezones may show different days.

Description is immutable: trim and collapse Unicode whitespace, require 1–200 Unicode characters. No amount. For duplicate checks, compare lowercase descriptions in Go, ordered sender/recipient, and equal meal instants (two null timestamps match). Keep only the display description in storage; no duplicate-key column or database meal-uniqueness index. Check for an existing OPEN matching meal and return 409. No persistent replay or exactly-once send guarantee is required; retries may create duplicates. Keep the friendship lock needed for closure safety, but add no sender-wide retry lock or key machinery.

Statuses: `OPEN`, `CANCELLED`, `DECLINED`, `COMPLETED`, `FRIENDSHIP_CLOSED`. Only OPEN is actionable. Draft association leaves status OPEN. Terminal states never reopen.

## Routes

- `POST /friendships/{friendshipID}/split-reminders`: body `{description, mealDate?}`, mealDate nullable. No Idempotency-Key header. Return 201 Reminder. Only an authenticated member of an active REAL friendship can send; recipient is the other member. Anonymous target: 409. Same OPEN meal found by application check: 409. Different meals can coexist. Sending creates no debt, balance change, or expense.
- `GET /friendships/{friendshipID}/split-reminders`: 200 Reminder[], all OPEN sent/received reminders, newest first; id descending breaks timestamp ties. Empty array when none.
- `GET /split-reminders/{reminderID}`: 200 Reminder.
- Later: `GET /friendships/{friendshipID}/split-reminders/history?limit=20&before=<UUID>`: 200 `{items: Reminder[], nextCursor: UUID|null}`, terminal records only in list order, exclusive cursor; limit 1–100. Cursor outside accessible history: 404.
- Later: `POST /split-reminders/{reminderID}/cancel`, empty body, sender only: 200 Reminder, OPEN → CANCELLED.
- Later: `POST /split-reminders/{reminderID}/decline`, empty body, recipient only: 200 Reminder, OPEN → DECLINED.
- Later: `POST /split-reminders/{reminderID}/draft`, empty body, recipient only: 200 `{reminder: Reminder, expenseId: UUID}`. Atomically create one recipient-owned draft or resume the draft referenced by expenseId. Prefill description/meal time, recipient payer and both participants, no amount. Remain OPEN. Deleting a draft clears expenseId; later use may create a new draft.
- Later: `POST /split-reminders/{reminderID}/expense`, body `{expenseId: UUID}`, recipient only: 200 Reminder, OPEN → COMPLETED. Expense must be confirmed, recipient payer, sender participating, and accessible; otherwise 409. At most one reminder per expense. Normal confirmation of the associated draft performs the same completion in the expense transaction and creates no extra debt. Deleting/editing a completed expense never reopens the reminder; clear a deleted expense reference and show unavailable.

## Access, errors, and transitions

All routes require authentication (401). Reads/actions check participant identity and current active friendship. Unknown IDs, outsiders, blocked/removed friendships: 404, without revealing existence. Wrong actor on an otherwise accessible later action: 403. Invalid fields/UUID/timestamp: 422 with useful field errors. Invalid transitions and duplicate OPEN meals: 409. Server/database failure: 500.

No Idempotency-Key validation or retry-key storage. Each POST is a fresh send subject to the ordinary application duplicate check. Later cancel/decline/link repeats succeed only for the same result/expense; conflicting terminal results return 409. Draft creation serializes per reminder. No PATCH for sent details.

## Friendship and notifications

There is no public friendship block/remove action in the current app. Do not add a database deletion trigger or speculative closure hook in SR-01. Missing friendships deny reminder reads/actions through current access checks; direct SQL deletion does not change reminder status. When real friendship block/remove support is added, that feature must close OPEN reminders in both directions as FRIENDSHIP_CLOSED in its transaction, serialize with sends, and prevent later recreation from restoring old access. That future lifecycle integration is not implemented in SR-01.

Existing anonymous-profile merges preserve ownership/references and cannot enable sends to anonymous friends. No new general profile-merge flow is required.

Persist reminders independently of notification read state and push delivery. Do not create a separate reminder-event table, event trigger, or outbox. CASH-32 owns lifecycle publication through the existing NATS pattern after successful database commit, followed by subscribers that insert in-app notifications and attempt push. Its publisher must cover creation and status transitions, including closure; never publish rolled-back changes. Delivery deduplication uses reminder ID plus transition in existing notification facilities. Separate reminder records are separate sends. No guarantee across a crash between commit and publish; publication failure must not undo saved state. SR-01 does not implement notification delivery or new NATS wiring.

## UI and verification

Friend detail page: labelled send form, both sent/received OPEN reminders, clear roles/details/status, useful accessible errors, refresh list on success. ANON friends show an explanation instead of send controls. No amount. Disable in-flight submissions and retain failed input. No UUID generation or retry-key tracking in the form/client. Retain the prepared timestamp while retrying unchanged input so timezone changes do not change a pending submission's meal time.

Test send/list/retrieve, validation, privacy, lowercase/space/null-timestamp duplicate checks, repeated/concurrent requests under the revised non-idempotent contract, and access denial for missing friendships plus existing merge safety. Test labels, keyboard submission, failed input retention, pending guard, date conversion/local rendering, and friend-page entry point. Generate backend OpenAPI and frontend types. No new dependencies.

Manual cancellation/decline, history UI, bill creation/linking, and notifications remain later slices. No scheduled alerts, resend action, public reminders, or amounts. SR-01 has no duplicate-deletion UI; SR-02 owns cancellation.
