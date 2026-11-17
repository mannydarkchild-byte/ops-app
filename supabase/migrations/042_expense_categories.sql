-- Site-managed expense categories. Payments keep the category they were saved with.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS expense_categories JSONB;
