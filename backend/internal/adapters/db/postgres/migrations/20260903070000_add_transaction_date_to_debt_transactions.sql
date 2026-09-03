-- +goose Up
-- +goose StatementBegin
ALTER TABLE debt_transactions
ADD COLUMN IF NOT EXISTS transaction_date date;

-- Backfill: transaction_date is new and independent of created_at, but every
-- pre-existing row's effective date was implicitly its creation date. Cast via
-- `AT TIME ZONE 'UTC'` explicitly rather than `created_at::date` - the bare
-- cast resolves against the migration session's `TimeZone` setting, which can
-- land on the wrong calendar day and disagree with the UTC-anchored dates the
-- app computes (DebtService.resolveTransactionDate, mapper.transactionDateLayout).
UPDATE debt_transactions
SET transaction_date = (created_at AT TIME ZONE 'UTC')::date
WHERE transaction_date IS NULL;

ALTER TABLE debt_transactions
ALTER COLUMN transaction_date SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE debt_transactions
DROP COLUMN IF EXISTS transaction_date;
-- +goose StatementEnd
