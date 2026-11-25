# SR-03: Create a bill from a split reminder

Publication: approved draft; not published to YouTrack.
Target: project CASH, Type Story. The ready-for-agent role maps to Stage Open.
Blocked by: SR-01.

## User story

As the friend who paid, I want to start or resume a bill from a reminder, so that I can record the meal and assign the sender their share.

## What to build

Add an Add bill action to an open received reminder. Start or resume one linked group-expense draft, use the existing expense flow, and complete the reminder only after a valid confirmed split.

## Acceptance criteria

- [ ] Only the recipient of an open reminder can take its bill actions.
- [ ] Fill a new draft with the description, the meal date if supplied, the recipient as payer, and both people as participants.
- [ ] Use existing expense rules for entering amounts and items, adding participants, and confirming. Do not bypass validation or change debt rules.
- [ ] Repeated or concurrent Add bill actions resume one linked draft rather than create multiple drafts.
- [ ] Creating or resuming a draft does not change balances.
- [ ] Reading a reminder or saving a draft does not complete it.
- [ ] Complete only when the linked expense is confirmed, names the recipient as payer, and includes the sender as a participant.
- [ ] Reject completion for an unconfirmed expense, wrong payer, missing sender, inaccessible expense, or closed reminder.
- [ ] Normal expense confirmation creates the normal debt once. Reminder completion creates no additional debt.
- [ ] If a reminder closes during drafting, preserve the draft. Later confirmation does not change the reminder's closed outcome.
- [ ] Completion and closure racing with each other produce one final reminder outcome.
- [ ] Keep completion final after later expense edits or deletion. A deleted linked expense shows as unavailable rather than causing a broken page.
- [ ] Expose a single completion event for the notification slice without requiring delivery success for completion.
- [ ] Verify the two-user API path from reminder to draft to confirmed split, including retries, access, invalid completion attempts, balance effects, and closure races.
- [ ] Verify draft-prefill, resume, completion, and unavailable-expense states in the UI.

## Cross-cutting and API contract

Both backend and frontend. Use the shared contract from SR-01 and existing expense confirmation rules. Link the contract before component dispatch and create component-scoped Sub-Tasks.

## Blocked by

- SR-01: provides reminders, access rules, lifecycle boundaries, friendship closure, and the shared contract.

SR-02 is not a blocker: this slice can test closed-state behavior using the friendship closure delivered in SR-01. Manual cancel and decline must use the same terminal-state rules when the slices are integrated.

## Out of scope

Selecting an existing expense, notification delivery, manual completion, automatic balance changes outside normal expense confirmation, and reopening completed reminders.
