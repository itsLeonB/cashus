# SR-02: Cancel, decline, and view reminder history

Publication: approved draft; not published to YouTrack.
Target: project CASH, Type Story. The ready-for-agent role maps to Stage Open.
Blocked by: SR-01.

## User story

As either person in a split reminder, I want to close an unneeded request and inspect its outcome, so that pending work stays clear.

## What to build

Let the sender cancel an open reminder and the recipient decline it. Show closed reminders in collapsed history on the friendship detail page, with open reminders first. Correct sent details by cancelling and sending a replacement.

## Acceptance criteria

- [ ] The sender can cancel an open reminder; the recipient can decline it. Enforce roles on the server as well as in the UI.
- [ ] Either action closes the reminder for both people with a distinct outcome.
- [ ] A closed reminder cannot be edited, completed, or used to start further reminder actions. Retries do not change its final outcome.
- [ ] Cancelling permits a replacement reminder for the meal; it does not edit the original.
- [ ] Both people can inspect collapsed closed history while the friendship remains accessible. Open reminders appear first.
- [ ] History distinguishes cancelled, declined, completed, and friendship-ended outcomes when present.
- [ ] Closing never deletes a linked draft or expense, changes a balance, or reverses a split.
- [ ] Concurrent terminal actions produce one final outcome.
- [ ] Ending the friendship does not expose historical records through stale links or direct API requests.
- [ ] Expose a single decline event for the notification slice without requiring push delivery for closure.
- [ ] Verify role checks, retries, replacement after cancellation, history access, races, and preservation of linked expense fixtures through API tests.
- [ ] Check keyboard access, visible status, and allowed actions in the friend-page UI.

## Cross-cutting and API contract

Both backend and frontend. Use the shared contract established in SR-01 and link its final reference before component dispatch. Create component-scoped Sub-Tasks when grooming for implementation.

## Blocked by

- SR-01: provides persistent reminders, permissions, the shared contract, and the friendship page.

## Out of scope

Creating or linking bills, notification delivery, editing sent details, and manual completion without a confirmed split.
