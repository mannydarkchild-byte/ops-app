-- Two extra weighbridge ticket photos on the day's site dispatch record.
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS weighbridge_photo_2 TEXT;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS weighbridge_photo_3 TEXT;
