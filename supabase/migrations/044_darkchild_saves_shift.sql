-- Darkchild's signature saves the shift. Berlington can still sign later.
-- A missing Berlington signature does not leave the shift unsigned.

CREATE OR REPLACE FUNCTION verify_shift(p_shift_id TEXT, p_verification_token TEXT, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_shift shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id AND verification_token = p_verification_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid shift or token'; END IF;

  IF p_action = 'machine_sign' THEN
    UPDATE shifts
    SET shift_status = 'VERIFIED',
        verified_at = COALESCE(verified_at, now()),
        verified_by = COALESCE(verified_by, auth.uid()),
        verification_token = NULL,
        shift_version = COALESCE(shift_version, 1),
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'verify' THEN
    UPDATE shifts
    SET shift_status = 'VERIFIED',
        verified_at = now(),
        verified_by = auth.uid(),
        verification_token = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'correct' THEN
    UPDATE shifts
    SET shift_status = 'CORRECTION_REQUIRED',
        supervisor_comment = p_reason,
        verification_token = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'escalate' THEN
    UPDATE shifts
    SET shift_status = 'CORRECTION_REQUIRED',
        supervisor_comment = COALESCE(p_reason, 'Escalated'),
        verification_token = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE shifts
SET shift_status = 'VERIFIED',
    verified_at = COALESCE(verified_at, machine_signed_at, updated_at),
    verified_by = COALESCE(verified_by, machine_signed_by)
WHERE shift_status = 'MACHINE_SIGNED';
