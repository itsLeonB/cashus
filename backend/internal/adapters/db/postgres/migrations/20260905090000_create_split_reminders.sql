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
-- The friendship row lock used by send also serializes physical removal.
-- +goose StatementBegin
CREATE FUNCTION close_friendship_split_reminders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE split_reminders SET status='FRIENDSHIP_CLOSED',closed_at=now(),updated_at=now() WHERE friendship_id=OLD.id AND status='OPEN';
 RETURN OLD;
END $$;
-- +goose StatementEnd
CREATE TRIGGER close_friendship_split_reminders BEFORE DELETE ON friendships FOR EACH ROW EXECUTE FUNCTION close_friendship_split_reminders();

-- +goose Down
DROP TRIGGER close_friendship_split_reminders ON friendships;
DROP FUNCTION close_friendship_split_reminders();
DROP TABLE split_reminders;
