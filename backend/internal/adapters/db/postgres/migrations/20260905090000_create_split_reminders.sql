-- +goose Up
CREATE TABLE split_reminders (
 id uuid PRIMARY KEY,
 friendship_id uuid NOT NULL,
 sender_profile_id uuid NOT NULL,
 recipient_profile_id uuid NOT NULL,
 description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
 duplicate_description text NOT NULL,
 meal_date varchar(10),
 status text NOT NULL CHECK (status IN ('OPEN','CANCELLED','DECLINED','COMPLETED','FRIENDSHIP_CLOSED')),
 idempotency_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 draft_expense_id uuid,
 expense_id uuid,
 CHECK (sender_profile_id <> recipient_profile_id),
 UNIQUE(sender_profile_id,idempotency_key)
);
CREATE UNIQUE INDEX split_reminders_open_meal ON split_reminders(sender_profile_id,recipient_profile_id,duplicate_description,COALESCE(meal_date,'')) WHERE status = 'OPEN';
CREATE INDEX split_reminders_open_list ON split_reminders(friendship_id,created_at DESC,id DESC) WHERE status = 'OPEN';
CREATE TABLE split_reminder_events (
 reminder_id uuid NOT NULL REFERENCES split_reminders(id),
 transition text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(reminder_id,transition)
);
-- +goose StatementBegin
CREATE FUNCTION split_reminder_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO split_reminder_events(reminder_id,transition) VALUES(NEW.id,NEW.status) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER split_reminder_event AFTER INSERT OR UPDATE OF status ON split_reminders FOR EACH ROW EXECUTE FUNCTION split_reminder_event();
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
DROP TABLE split_reminder_events;
DROP TABLE split_reminders;
DROP FUNCTION split_reminder_event();
