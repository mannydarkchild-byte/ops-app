-- One open shift per machine. Older RUNNING rows are taken out of the running state
-- so a later start cannot sit beside them. Then the unique rule can be created.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY machine_id
           ORDER BY started_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS n
  FROM shifts
  WHERE shift_status = 'RUNNING'
)
UPDATE shifts
SET
  shift_status = 'WAITING_FOR_VERIFICATION',
  updated_at = now(),
  notes = NULLIF(
    BTRIM(CONCAT(COALESCE(notes, ''), ' Duplicate open shift was closed so this machine has one running shift.')),
    ''
  )
WHERE id IN (SELECT id FROM ranked WHERE n > 1);

UPDATE machine_status AS ms
SET
  shift_id = s.id,
  operator_id = s.operator_id,
  operator_name = s.operator_name,
  is_running = true,
  updated_at = now()
FROM shifts AS s
WHERE s.machine_id = ms.machine_id
  AND s.shift_status = 'RUNNING';

CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_running_per_machine
  ON shifts (machine_id)
  WHERE shift_status = 'RUNNING';
