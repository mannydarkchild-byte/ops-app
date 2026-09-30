-- One running shift per machine. Skipped when duplicates already exist, so this cannot fail a deploy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM shifts
    WHERE shift_status = 'RUNNING'
    GROUP BY machine_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_running_per_machine
      ON shifts (machine_id)
      WHERE shift_status = 'RUNNING';
  END IF;
END $$;
