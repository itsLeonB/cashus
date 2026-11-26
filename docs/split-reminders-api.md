# Split reminders API — CASH-28

This is the shared contract for SR-01 and later slices. Only send, open list, and retrieve ship in SR-01. Routes below use `/api/v1`; frontend client paths omit that prefix. Use existing endpoint response envelopes and error format.

## Identity and fields

IDs are UUIDs; times are RFC3339 UTC. A reminder is `{id, friendshipId, senderProfileId, recipientProfileId, description, mealDate, status, createdAt, updatedAt, closedAt, draftExpenseId, expenseId}`. Nullable fields always serialize as null. `mealDate` is null or a valid calendar date `YYYY-MM-DD` (years 0001–9999). No amount field exists. Description is immutable: trim and collapse Unicode whitespace before storage, require 1–200 Unicode characters after normalization. Duplicate key uses the lowercase normalized description and mealDate (null equals null), plus ordered sender and recipient. Sender and recipient must differ.

Statuses: `OPEN`, `CANCELLED`, `DECLINED`, `COMPLETED`, `FRIENDSHIP_CLOSED`. Only OPEN is actionable. Draft association leaves status OPEN. Terminal states never reopen.

## Routes

- `POST /friendships/{friendshipID}/split-reminders`: body `{description, mealDate?}`; mealDate may be null. Required `Idempotency-Key` UUID header. Return 201 with Reminder, including replays of a successful send. Only the authenticated member of an active REAL friendship can send; recipient is the other member. Anonymous friendships return 409. Reject a second OPEN duplicate with 409. Different meals can coexist.
- `GET /friendships/{friendshipID}/split-reminders`: return 200 with Reminder[], all OPEN reminders in both directions, newest first (id descending breaks timestamp ties), empty array when none. No side effects.
- `GET /split-reminders/{reminderID}`: return 200 with Reminder.
- Later: `GET /friendships/{friendshipID}/split-reminders/history?limit=20&before=<UUID>` returns 200 `{items: Reminder[], nextCursor: UUID|null}`. Terminal records only, same order as list, exclusive cursor, limit 1–100; cursor must belong to the same accessible history or return 404.
- Later: `POST /split-reminders/{reminderID}/cancel`, empty body, sender only; return 200 Reminder, OPEN → CANCELLED.
- Later: `POST /split-reminders/{reminderID}/decline`, empty body, recipient only; return 200 Reminder, OPEN → DECLINED.
- Later: `POST /split-reminders/{reminderID}/draft`, empty body, recipient only; return 200 `{reminder: Reminder, draftExpenseId: UUID}`. Create one recipient-owned expense draft or resume the existing one atomically; prefill description/date, no amount. Remain OPEN. A deleted draft clears draftExpenseId; retry may create a fresh draft.
- Later: `POST /split-reminders/{reminderID}/expense`, body `{expenseId: UUID}`, recipient only; return 200 Reminder, OPEN → COMPLETED. Expense must be a posted, recipient-owned expense with sender participating; otherwise 409. Associate at most one reminder per expense. Posting the associated draft performs the same completion in the expense transaction. Deleting or editing a completed expense does not reopen a reminder; retain reminder and clear a deleted expense reference.

## Permission and error rules

All routes require authentication (401). Every read and write checks both participant identity and current active friendship. Unknown IDs, outsiders, removed or blocked friendships return 404, including history and replay. Never reveal existence by returning a different error for outsiders. Wrong actor on an otherwise accessible later action returns 403. Invalid UUID, header, description, or date returns 422 using field errors. Missing Idempotency-Key returns 422. Duplicate OPEN meal, anonymous target, changed idempotency payload, or invalid transition returns 409; database/server failures return 500. Use existing application error bodies with useful human-readable messages. Successful sends never create expenses, debts, balances, or notifications as a prerequisite.

## Retry and transaction rules

Scope idempotency key to authenticated sender, persist it with the reminder (not a cache); exact normalized send payload plus friendship must match. Same key and payload returns the same id/status even if terminal, but only while current friendship remains accessible. Different payload with the same key returns 409. No expiry in SR-01. A new key for an OPEN duplicate returns 409. Enforce both uniqueness rules at the database, including concurrent requests. Later cancel/decline/link actions repeat successfully only for the same resulting action/expense; conflicting terminal states return 409. Draft creation must serialize per reminder. No PATCH for sent meal fields.

## Friendship and event boundaries

Blocking or removing a friendship closes all OPEN reminders in both directions as FRIENDSHIP_CLOSED in the same transaction and denies subsequent read/action access. Recreating a friendship never restores old access or reopens old records. Serialize send with closure so neither can leave OPEN reminders after removal. Use the existing friendship lifecycle; where no public removal/block endpoint exists, provide and test the shared transaction boundary rather than inventing a new public API.

Profile merges must preserve reminder participant ownership, current friendship references, and idempotency records. Do not infer permission from an anonymous profile; sends still require REAL membership. Resolve merge duplicate collisions by keeping the earliest OPEN reminder and closing the other as FRIENDSHIP_CLOSED, never deleting audit records.

Persist independently of notification/read/push state. Define transaction-local lifecycle boundaries for created, cancelled, declined, completed, and friendship-closed changes; later delivery consumes committed changes and deduplicates by reminder ID plus transition. SR-01 requires no push, queue dependency, scheduled alert, resend, history UI, cancel/decline UI, or expense creation/linking implementation.

## SR-01 UI and checks

On the friendship detail page show a labelled send form and both sent/received OPEN reminders, with role, description, date when supplied, and status. For ANON friends show an explanation instead of send controls. No amount input. Keep one UUID idempotency key for retries of the same submission; use a new key when the payload changes or a successful submission finishes. Disable in-flight submission, retain input on failure, show useful accessible errors, and refresh the open list after success. Use existing house controls, keyboard access and associated labels.

Test send/list/retrieve, auth and guessed IDs, validation, whitespace/case/null-date duplicates, idempotent retries and changed payload, concurrent sends, closure and merges. Test frontend entry point, labels, keyboard form submission and errors. Generate backend OpenAPI for implemented routes and frontend types from it.
