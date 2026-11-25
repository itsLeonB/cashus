# SR-05: Notify both people about split reminders

Publication: approved draft; not published to YouTrack.
Target: project CASH, Type Story. The ready-for-agent role maps to Stage Open.
Blocked by: SR-02 and SR-03.

## User story

As someone sending or receiving a split reminder, I want timely alerts with working links, so that I can act on requests and see their outcomes.

## What to build

Notify the recipient when a reminder arrives, using an in-app alert and one optional push through the existing system. Notify the sender in-app when the recipient completes or declines it. Open the matching reminder on the friend page from a notification.

## Acceptance criteria

- [ ] A saved reminder creates one logical in-app arrival notification for its recipient.
- [ ] Attempt one push using existing permission and subscription handling. No permission or subscription means no push, not a failed reminder.
- [ ] Push failure does not lose the reminder, undo a state change, or cause client retries to create another logical alert.
- [ ] Notification links open the matching reminder on the friendship detail page, subject to current authentication and access rights.
- [ ] Stale notification links cannot bypass a block or removed friendship.
- [ ] Reading a notification does not complete or hide an open reminder on the friend page.
- [ ] Completion and decline each notify the sender in-app once, without an extra reminder outcome push.
- [ ] Completion from either a newly recorded bill or the shared existing-bill linking path uses the same outcome event. Existing expense notifications retain their own behavior.
- [ ] Replayed events do not create duplicate logical notifications or repeated push attempts for the same event.
- [ ] There are no scheduled reminders, automatic repeat alerts, or manual resend action.
- [ ] Verify arrival, decline, and completion events through the public API and notification listing, with controlled push delivery.
- [ ] Cover push disabled, absent subscriptions, delivery failures, event retries, read-versus-completed state, and access after friendship closure.
- [ ] Check notification navigation and context handling using existing frontend test tools; do not add a test framework.

## Cross-cutting and API contract

Both backend and frontend. Reuse the shared contract, existing notification listing and delivery, and existing notification context handling. Link the contract before component dispatch and create component-scoped Sub-Tasks.

## Blocked by

- SR-02: provides the public decline action and its outcome.
- SR-03: provides confirmed-split completion and its outcome.

SR-01 is an indirect blocker. SR-04 is not a blocker: existing-bill linking must reuse the same completion event rather than add another notification path.

## Out of scope

A new notification platform, guaranteed device delivery, scheduled alerts, resends, outcome push alerts, and a separate reminders inbox.
