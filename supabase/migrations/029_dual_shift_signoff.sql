--- Dual sign-off: machine supervisor signs in app, site supervisor signs via token link.
--- Operator submits -> MACHINE_SIGNED (version locked) -> VERIFIED (dual-signed, billable).
--- Any edit after machine sign bumps shift_version and clears machine signature.

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS machine_signature_ref TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS machine_signature_name TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS machine_signed_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS machine_signed_by UUID;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_signature_name TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_signer_phone TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_signed_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_token TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_token_expires_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_version INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS shifts_site_token_idx ON shifts (site_token);

-- Backfill: old single-signed shifts keep their supervisor signature as the
-- machine-side signature so history stays honest (flagged legacy in app).
UPDATE shifts
SET machine_signature_ref = supervisor_signature_ref,
    machine_signature_name = supervisor_signature_name,
    machine_signed_at = verified_at,
    machine_signed_by = verified_by,
    shift_version = COALESCE(shift_version, 1)
WHERE shift_status = 'VERIFIED'
  AND machine_signature_ref IS NULL;

-- Extend verification RPC: machine_sign locks a version, site signs via token.
CREATE OR REPLACE FUNCTION verify_shift(p_shift_id TEXT, p_verification_token TEXT, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_shift shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id AND verification_token = p_verification_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid shift or token'; END IF;

  IF p_action = 'machine_sign' THEN
    UPDATE shifts
    SET shift_status = 'MACHINE_SIGNED',
        verification_token = NULL,
        shift_version = COALESCE(shift_version, 1),
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'verify' THEN
    -- Backward compat: direct verify (legacy single-sign path) counts as machine sign + site sign together.
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

-- Site sign-off via WhatsApp magic link. No login required; token is the auth.
-- Called by anon + authenticated callers.
CREATE OR REPLACE FUNCTION site_sign_shift(
  p_shift_id TEXT,
  p_token TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'agree',
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE v_shift shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF v_shift.site_token IS NULL OR v_shift.site_token <> p_token THEN
    RAISE EXCEPTION 'Invalid or expired sign link. Ask the machine supervisor to resend it.';
  END IF;
  IF v_shift.site_token_expires_at IS NOT NULL AND v_shift.site_token_expires_at < now() THEN
    RAISE EXCEPTION 'This sign link has expired. Ask the machine supervisor to resend it.';
  END IF;
  IF v_shift.shift_status <> 'MACHINE_SIGNED' THEN
    RAISE EXCEPTION 'This shift is not waiting for site sign-off.';
  END IF;

  IF p_action = 'agree' THEN
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
      RAISE EXCEPTION 'Enter your name to sign';
    END IF;
    UPDATE shifts
    SET shift_status = 'VERIFIED',
        verified_at = now(),
        site_signature_name = trim(p_name),
        site_signer_phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
        site_signed_at = now(),
        site_token = NULL,
        site_token_expires_at = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'dispute' THEN
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
      RAISE EXCEPTION 'Give a reason so the machine supervisor knows what to fix';
    END IF;
    UPDATE shifts
    SET shift_status = 'CORRECTION_REQUIRED',
        supervisor_comment = trim(p_reason),
        site_token = NULL,
        site_token_expires_at = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
