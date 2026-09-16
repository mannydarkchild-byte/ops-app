-- Supervisor signature on verified shifts + supervisor phone for WhatsApp
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS supervisor_signature_ref TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS supervisor_signature_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
