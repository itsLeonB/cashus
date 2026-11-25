# SR-04: Link a bill already recorded

Publication: approved draft; not published to YouTrack.
Target: project CASH, Type Story. The ready-for-agent role maps to Stage Open.
Blocked by: SR-03.

## User story

As the friend who paid, I want to link a bill I already recorded, so that I do not create another expense for the same meal.

## What to build

Let the recipient choose an existing eligible confirmed group expense from an open reminder. Link it and use the same completion rules as the draft flow.

## Acceptance criteria

- [ ] Offer a clear existing-bill action alongside Add bill on an open received reminder.
- [ ] Let the recipient select an expense they are authorized to use.
- [ ] The selected expense must be confirmed, name the recipient as payer, and include the sender as a participant.
- [ ] Enforce eligibility and access on the server; UI filtering alone is not sufficient.
- [ ] Linking does not grant either person extra expense permissions.
- [ ] Linking a valid expense completes the reminder without creating an expense, debt, or balance adjustment.
- [ ] Reject unauthorized expenses, incorrect payers, missing senders, unconfirmed expenses, and actions on closed reminders with useful errors.
- [ ] Retries and competing link or closure actions cannot replace a final outcome or create extra completion events.
- [ ] Show the linked expense in history through the existing completion display. Preserve the final status if the expense later changes or is deleted.
- [ ] Verify selection and linking through API tests, including authorization, invalid candidates, retry behavior, and unchanged balances.
- [ ] Check selection, empty and error states, keyboard access, and navigation in the UI.

## Cross-cutting and API contract

Both backend and frontend. Use the shared contract from SR-01 and the completion path from SR-03. Link the contract before dispatch and create component-scoped Sub-Tasks.

## Blocked by

- SR-03: provides expense linkage, completion checks, final-state behavior, and the linked-expense display. SR-01 is an indirect blocker.

## Out of scope

Changing an existing bill to make it eligible, taking over another creator's expense, automatic meal matching, and new expense permissions.
