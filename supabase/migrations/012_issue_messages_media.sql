-- Align issue_messages with app (local media_ref + public media_url)

ALTER TABLE issue_messages ADD COLUMN IF NOT EXISTS media_ref TEXT;
ALTER TABLE issue_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
