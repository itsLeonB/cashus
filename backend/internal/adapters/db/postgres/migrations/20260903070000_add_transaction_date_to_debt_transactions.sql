-- +goose Up
-- +goose StatementBegin
ALTER TABLE debt_transactions
ADD COLUMN IF NOT EXISTS transaction_date date;

-- Backfill: transaction_date is new and independent of created_at, but every
-- pre-existing row's effective date was implicitly its creation date.
UPDATE debt_transactions
SET transaction_date = created_at::date
WHERE transaction_date IS NULL;

ALTER TABLE debt_transactions
ALTER COLUMN transaction_date SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE debt_transactions
DROP COLUMN IF EXISTS transaction_date;
-- +goose StatementEnd
