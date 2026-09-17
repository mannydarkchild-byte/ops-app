-- Prevent duplicate open downtime rows per shift (root cause of event spam in Supabase)
-- Auto-close older duplicate open stops before adding the constraint.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_id
      ORDER BY COALESCE(stopped_at, timestamp, created_at), created_at
    ) AS rn
  FROM events
  WHERE type = 'STOP' AND status = 'open' AND shift_id IS NOT NULL
)
UPDATE events e
SET
  status = 'closed',
  note = TRIM(BOTH ' | ' FROM CONCAT(COALESCE(e.note, ''), ' | Auto-closed duplicate')),
  updated_at = now()
FROM ranked r
WHERE e.id = r.id AND r.rn > 1;

DELETE FROM events e
USING (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_id
      ORDER BY COALESCE(timestamp, created_at), created_at
    ) AS rn
  FROM events
  WHERE type = 'MACHINE_STARTED' AND shift_id IS NOT NULL
) d
WHERE e.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS events_one_open_stop_per_shift
  ON events (shift_id)
  WHERE type = 'STOP' AND status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS events_one_machine_started_per_shift
  ON events (shift_id)
  WHERE type = 'MACHINE_STARTED';
