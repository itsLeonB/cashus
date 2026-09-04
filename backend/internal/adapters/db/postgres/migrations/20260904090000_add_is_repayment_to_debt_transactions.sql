-- +goose Up
-- +goose StatementBegin
ALTER TABLE debt_transactions
ADD COLUMN is_repayment BOOLEAN NOT NULL DEFAULT FALSE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE debt_transactions
DROP COLUMN is_repayment;
-- +goose StatementEnd
