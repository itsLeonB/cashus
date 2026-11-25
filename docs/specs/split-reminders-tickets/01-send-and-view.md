# SR-01: Send and view split reminders

Publication: approved draft; not published to YouTrack.
Target: project CASH, Type Story. The ready-for-agent role maps to Stage Open.
Blocked by: None (can start immediately).

## User story

As a user whose friend paid for a meal, I want to send and track a private split reminder, so that my friend remembers to record the bill.

## What to build

Send a reminder from a real friend's profile and show it to both people on their friendship detail page. Include a required meal description and optional meal date, but no amount. Make this path safe under retries, duplicate sends, and changes to the friendship.

First define the shared API contract for the whole approved feature. Do this before dispatching component implementation work. This ticket does not require a separate refactor.

## Acceptance criteria

- [ ] Record one shared contract covering send, list, history, retrieve, cancel, decline, start or resume a draft, and link an expense. Include request and response shapes, errors, status codes, permissions, state transitions, field limits, and retry rules.
- [ ] The contract covers expense-driven completion and friendship-driven closure, so later tickets do not make separate API assumptions.
- [ ] An authenticated user can send from an active real friend's profile. Anonymous friends show an explanation instead.
- [ ] Require a nonblank description, allow an optional meal date, and request no amount. Validate on the server and show useful UI errors.
- [ ] Only the sender and recipient can list or read reminders. Other users cannot gain access through guessed identifiers.
- [ ] Both people can see open sent and received reminders on their friendship detail page, with clear roles, meal details, and status.
- [ ] Sent details are immutable. Multiple different meals can remain open.
- [ ] Reject a second open reminder with the same sender, recipient, normalized description, and meal date. Ignore extra spaces and letter case; two absent dates match.
- [ ] Concurrent sends and retries create one logical reminder. Sending never changes a balance or creates a debt.
- [ ] Blocking or removing the friendship closes open reminders in both directions and prevents further access or actions. Closed reminders do not reopen when contact resumes.
- [ ] Existing profile merges preserve valid reminder ownership and references without enabling sends to anonymous friends.
- [ ] Persist reminders independently from notification read state and push delivery. Provide the lifecycle and event boundaries that later slices use.
- [ ] Verify the send/list path, validation, privacy, normalization, retries, concurrent duplicate sends, and friendship closure through API tests. Check form labels, keyboard access, errors, and the friend-page entry point.

## Cross-cutting and API contract

Both backend and frontend. This ticket owns the initial shared contract; attach its final reference before component dispatch. Use exactly that contract on both sides and update generated API artifacts with implemented endpoints. Create one component-scoped Sub-Task per side when grooming for implementation.

## Blocked by

None (can start immediately). Contract design is the first action within this ticket.

## Out of scope

Manual cancellation or decline, closed-history UI, bill creation or linking, and notification delivery belong to later slices. No scheduled alerts, resend action, public reminders, amounts, or new dependencies.
