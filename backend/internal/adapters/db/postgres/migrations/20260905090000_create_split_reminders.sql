-- +goose Up
CREATE TABLE split_reminders (
 id uuid PRIMARY KEY DEFAULT uuidv7(),
 friendship_id uuid NOT NULL,
 sender_profile_id uuid NOT NULL,
 recipient_profile_id uuid NOT NULL,
 description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
 meal_date timestamptz,
 status text NOT NULL CHECK (status IN ('OPEN','CANCELLED','DECLINED','COMPLETED','FRIENDSHIP_CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 expense_id uuid,
 CHECK (sender_profile_id <> recipient_profile_id)
);
CREATE INDEX split_reminders_open_list ON split_reminders(friendship_id,created_at DESC,id DESC) WHERE status = 'OPEN';

CREATE INDEX split_reminders_open_duplicate ON split_reminders(sender_profile_id,recipient_profile_id,meal_date) WHERE status = 'OPEN';

-- +goose Down
DROP TABLE split_reminders;
