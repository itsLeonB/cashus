# Split reminders

Status: user-approved product scope and test approach. Not implemented.

## Problem Statement

When a friend pays for a shared meal but does not record it in Cashus, I cannot see my share or settle it through the app. I want to remind that friend to add the meal and split it with me.

This is not a request for the friend to repay me. The friend paid; I expect to owe them my share.

## Solution

Send a private split reminder from the friend's profile. Include a short meal description and, optionally, the meal date. Do not enter an amount.

The friend sees the reminder in Cashus and can start a filled group-expense draft or link an existing expense. The reminder completes only when the linked expense is confirmed, names that friend as payer, and includes the sender as a participant.

Both people can track open reminders on their friendship detail page and view closed reminders in collapsed history. A reminder never creates a debt or changes a balance by itself.

## User Stories

### Send a reminder

1. As a user whose friend paid for a meal, I want to send a split reminder from their profile, so that they remember to record the expense.
2. As a sender, I want to describe the meal, so that my friend knows which bill I mean.
3. As a sender, I want to add an optional meal date, so that I can distinguish similar meals.
4. As a sender, I want to send without an amount, so that the payer can enter the actual bill and shares.
5. As a sender, I want reminders to stay private between us, so that other friends cannot see them.
6. As a sender, I want to see why an anonymous friend cannot receive a reminder, so that I do not expect delivery to someone without an account.
7. As a sender, I want separate reminders for separate meals, so that one pending bill does not block another.
8. As a sender, I want the app to reject a matching open reminder, so that I do not send the same meal twice by mistake.
9. As a sender, I want safe send retries, so that a network error does not create extra reminders or alerts.

### Receive and split

10. As a recipient, I want an in-app notification when a reminder is sent, so that I notice the request.
11. As a recipient with push enabled, I want one push notification, so that I can notice the reminder outside the app.
12. As a recipient, I want a notification tap to open the matching reminder on the friend page, so that I can act on it.
13. As a recipient, I want Add bill to fill in the meal details, me as payer, and both of us as participants, so that I do not enter the same details again.
14. As a recipient, I want to enter the bill details and add other participants through the normal expense flow, so that the split reflects the meal.
15. As a recipient, I want to resume the draft linked to an open reminder, so that repeated taps do not create more drafts.
16. As a recipient, I want to link an existing eligible expense, so that I do not record a bill twice.
17. As a sender, I want the reminder to complete only after a valid confirmed split includes me, so that reading the notification does not falsely count as completion.

### Close and track

18. As a sender, I want to cancel my reminder, so that I can withdraw an incorrect or unneeded request.
19. As a recipient, I want to decline a reminder, so that an incorrect request does not stay open forever.
20. As a sender, I want to cancel and replace incorrect details rather than edit a sent reminder, so that my friend works from a fixed request.
21. As either person, I want open reminders to close if either person blocks the other or removes the friendship, so that reminders do not continue after contact ends.
22. As a recipient, I want a started bill draft to survive reminder closure, so that my expense work is not lost.
23. As a sender, I want an in-app update when my friend completes or declines the reminder, so that I know its outcome without an extra reminder push alert.
24. As either person, I want open reminders first and closed reminders in collapsed history on the friend page, so that I can find pending work and check past outcomes.
25. As either person, I want completion to remain final after later expense changes, so that a finished reminder does not unexpectedly reopen.
26. As either person, I want a clear unavailable state if a linked expense is deleted, so that the reminder does not lead to a broken page.

## Acceptance Criteria

### Sending and access

- [ ] An authenticated user can send a split reminder from an active real friend's profile.
- [ ] Anonymous friends cannot receive one; the profile explains why.
- [ ] Only the sender and recipient can read the reminder. Other users cannot list, fetch, or change it by guessing identifiers.
- [ ] The description is required and cannot be blank. The meal date is optional. No amount is requested.
- [ ] Sent description and date cannot be edited. The sender can cancel and create a replacement.
- [ ] Multiple different meals can remain open between the same two people.
- [ ] A second open reminder with the same sender, recipient, normalized description, and meal date is rejected. Ignore extra spaces and letter case in descriptions. An absent date matches another absent date.
- [ ] Send retries cannot create duplicate records or duplicate notification events.
- [ ] A reminder is available in-app once saved. Delivery does not depend on push permission or push success.

### Delivery and display

- [ ] Sending creates an in-app notification and attempts one push through the existing system when the recipient has enabled push.
- [ ] No scheduled reminders, repeat alerts, or resend action exist.
- [ ] Notification links open the matching reminder on the friendship detail page, subject to current access rights.
- [ ] Both people see sent and received open reminders on that page.
- [ ] Reading a notification does not close or complete its reminder. Reading must not make an open reminder disappear from the friend page.
- [ ] Closed reminders appear in collapsed history while the friendship page remains accessible.
- [ ] Sender and recipient roles, meal details, status, and allowed actions are clear.

### Expense flow and completion

- [ ] Add bill opens a draft filled with the description, the date if supplied, the recipient as payer, and both people as participants.
- [ ] The recipient uses the existing expense flow to enter bill details and add other participants under existing rules.
- [ ] Returning to an open reminder resumes its linked draft rather than creating a new one.
- [ ] The recipient can link an existing expense they are allowed to use. Linking does not grant access to an otherwise private expense.
- [ ] The reminder completes only when the linked expense is confirmed, names the recipient as payer, and includes the sender as a participant.
- [ ] A draft, an unconfirmed expense, an expense with another payer, or an expense without the sender cannot complete the reminder.
- [ ] Expense confirmation keeps its existing debt and balance behavior. The reminder does not create a second debt.
- [ ] Completion is final. Later expense edits or deletion do not reopen the reminder.
- [ ] A deleted linked expense displays as unavailable without changing the completed status.

### Closure and safety

- [ ] Only the sender can cancel an open reminder; only the recipient can decline it or take its bill actions.
- [ ] Cancellation and decline close the reminder for both people.
- [ ] Blocking or removing the friendship closes all open reminders in either direction and prevents further reminder actions.
- [ ] A friendship ending does not grant continued access to its former friend page or reminder history.
- [ ] Closing a reminder never deletes its linked expense or draft, changes a balance, or undoes an existing split.
- [ ] If a draft is later confirmed after its reminder closes, the reminder remains closed with its original outcome.
- [ ] Competing completion and closure actions result in one final outcome; closed reminders cannot be completed or acted on later.
- [ ] Completion or decline creates an in-app outcome notification for the sender, without an extra reminder push. Existing expense notifications keep their own behavior.
- [ ] Reminder writes, access checks, duplicate checks, and state changes are enforced by the server, not only the UI.

## Implementation Decisions

### Existing modules and boundaries

- Extend friendship detail, group expenses, and notifications. Do not add a separate reminders inbox or a new main navigation entry.
- Model a split reminder separately from a notification. Notifications have read state; reminders have a lifecycle that must survive notification reads.
- Store sender, recipient, description, optional meal date, lifecycle outcome, timestamps, and an optional linked expense. A reminder has no amount and is not a debt transaction.
- Represent open, completed, cancelled, declined, and friendship-ended outcomes distinctly. Preserve the outcome for history.
- Keep the current distinction between friendship identity and profile identity when checking access and creating expense participants.
- Reuse existing authentication, friendship checks, expense validation and confirmation, notification delivery, push permission handling, and UI components.
- Make duplicate checks, draft creation or reuse, and competing terminal actions safe under retries and concurrent requests.
- Persist reminder state without depending on push delivery. Push failure must not cause a client retry to send a second logical reminder.
- Keep notification content and links private. A saved notification must not bypass a later block or friendship removal.
- If linked profiles move during an existing profile merge, reminder ownership and links must remain valid. This does not enable sending reminders to anonymous friends.
- Use existing request validation and error conventions. Define field limits and the duplicate-normalization rule consistently in the API and UI before implementation.

### Cross-cutting work and API contract

This Story affects both backend and frontend. No endpoint paths, wire schemas, migration details, or API contract were agreed in the interview.

Before implementation dispatch:

1. Design and link one concrete API contract covering list and history, send, retrieve, cancel, decline, start or resume a draft, and link an expense.
2. Include authorization, validation, lifecycle transitions, retry behavior, duplicate conflicts, and HTTP status codes in that contract.
3. Define how expense confirmation completes eligible linked reminders and how friendship closure stops further actions.
4. Split the Story into one backend Sub-Task and one frontend Sub-Task. Give both the same contract.
5. Regenerate the existing OpenAPI and frontend types when implementing contract changes.

Do not treat this product spec as an endpoint contract or dispatch separate component implementations before the contract exists.

## Testing Decisions

### Agreed test boundary

Use the public HTTP API as the main test boundary for the reminder lifecycle. Add small UI checks for entry, validation, allowed actions, and notification navigation. The user approved this approach.

Prefer existing test tools. Do not add a test framework for this feature. Test externally visible behavior, persisted outcomes, access rights, and balance effects rather than private helper calls or the order of internal method calls.

### Coverage

- Test the full two-user flow: send, list, read notification, start draft, resume draft, confirm split, complete reminder, inspect history, and receive the outcome update.
- Test account eligibility, absent friendships, other-user access, role-specific actions, and access after blocking or removal.
- Test required description, optional date, normalized duplicates, different meals, retries, and concurrent sends.
- Test linking an eligible existing expense and rejecting unconfirmed expenses, incorrect payers, missing senders, and unauthorized expenses.
- Test cancel and decline before and after draft creation, friendship closure in both directions, and completion racing with closure.
- Test that draft creation and reminder closure do not change balances; normal expense confirmation changes them once.
- Test that later expense changes do not reopen completion and that deleted expenses show as unavailable.
- Test push disabled, no subscription, delivery failure, and repeated delivery attempts without duplicate logical alerts.
- Test notification reads separately from reminder completion, and notification links against current access rights.
- Check the UI with keyboard navigation and clear field labels, errors, statuses, and anonymous-friend explanations.

### Prior art

Existing group-expense handler tests cover Huma input validation. Group-expense and friendship-request service tests use testify and repository mocks for service behavior. Frontend notification-persistence tests use Bun and check navigation context storage.

Reuse these tools and setup patterns, but do not mistake schema-only tests or mocked repository calls for coverage of persisted API lifecycle behavior. Add the smallest HTTP-level fixture needed to exercise that behavior; keep push delivery outside the test boundary with a controlled test replacement.

## Out of Scope

- Implementation in this task.
- Requests for repayment or changes to existing expense, debt, and settlement rules.
- Sending reminders to anonymous friends, non-friends, or groups of recipients.
- Amounts or proposed shares in a reminder.
- Public profile reminders.
- Scheduled or recurring alerts, manual resends, and extra outcome push notifications.
- Editing sent reminder details.
- A separate reminders inbox, home-screen reminder section, or new navigation page.
- Automatic meal matching beyond the stated duplicate comparison.
- Manual completion without a valid confirmed split.
- Deleting expenses when a reminder closes, or reopening completed reminders after expense changes.
- A new test framework, notification platform, or dependency chosen only for this feature.

## Further Notes

- The glossary term is **split reminder**. Do not call it a payment request or a friend request.
- The user confirmed the product scope and test boundary in this session.
- This spec records confirmed scope; implementation details not agreed above remain design work, not hidden requirements.
- No ADR is needed for the product decisions captured here.
- Tracker target: CASH, Type Story. The requested ready-for-agent role maps to Stage Open, not a tag. Link the required cross-cutting API contract before treating the Story as ready for component dispatch.
- YouTrack publication is blocked by project-server approval in this session. No issue was created and no tracker state was changed.
