--- Per-machine stop ownership: each machine names its own supplier (contractor,
--- deducted) and wear owner (no deduction). Site standing time stays per site.
--- Nulls fall back to site settings, then to generic role labels, so existing
--- sites behave exactly as before until suppliers are recorded.

ALTER TABLE machines ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS wear_owner_name TEXT;

-- This site: Warrior = Darkchild iron, FEL = Mamarc, excavator = Berlington-owned.
UPDATE machines SET
  supplier_name = 'Darkchild',
  wear_owner_name = 'Berlington',
  updated_at = now()
WHERE (name ILIKE '%warrior%' OR code ILIKE '%W2100%')
  AND supplier_name IS NULL;

UPDATE machines SET
  supplier_name = 'Mamarc',
  wear_owner_name = 'Berlington',
  updated_at = now()
WHERE (name ILIKE '%fel%' OR name ILIKE '%front end%' OR name ILIKE '%loader%' OR type ILIKE '%loader%')
  AND name NOT ILIKE '%warrior%'
  AND supplier_name IS NULL;

UPDATE machines SET
  supplier_name = 'Berlington',
  wear_owner_name = 'Berlington',
  updated_at = now()
WHERE (name ILIKE '%excavator%' OR type ILIKE '%excavator%')
  AND supplier_name IS NULL;
