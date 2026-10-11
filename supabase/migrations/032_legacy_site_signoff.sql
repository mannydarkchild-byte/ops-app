-- Let Berlington sign a report that already has the OPS signature only.
-- New flow: MACHINE_SIGNED → site token → VERIFIED.
-- Catch-up: VERIFIED with no site signature can still receive a token and a site name.

CREATE OR REPLACE FUNCTION site_shift_summary(p_shift_id TEXT, p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_shift shifts%ROWTYPE;
  v_machine machines%ROWTYPE;
  v_site sites%ROWTYPE;
  v_settings site_settings%ROWTYPE;
  v_stops JSONB;
  v_fuel NUMERIC;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF v_shift.site_token IS NULL OR v_shift.site_token <> p_token THEN
    RAISE EXCEPTION 'Invalid sign link. Ask the supervisor to resend it.';
  END IF;
  IF v_shift.site_token_expires_at IS NOT NULL AND v_shift.site_token_expires_at < now() THEN
    RAISE EXCEPTION 'This sign link has expired. Ask the supervisor to resend it.';
  END IF;
  IF v_shift.site_signature_name IS NOT NULL OR v_shift.site_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This shift is already signed by the site supervisor.';
  END IF;
  IF v_shift.shift_status NOT IN ('MACHINE_SIGNED', 'VERIFIED') THEN
    RAISE EXCEPTION 'This shift is not waiting for site sign-off.';
  END IF;

  SELECT * INTO v_machine FROM machines WHERE id = v_shift.machine_id;
  SELECT * INTO v_site FROM sites WHERE id = v_shift.site_id;
  SELECT * INTO v_settings FROM site_settings WHERE site_id = v_shift.site_id LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'reason', reason,
        'minutes', COALESCE(downtime_minutes, 0),
        'note', COALESCE(note, ''),
        'status', status
      ) ORDER BY stopped_at
    ),
    '[]'::jsonb
  )
  INTO v_stops
  FROM events
  WHERE shift_id = p_shift_id AND type = 'STOP';

  SELECT COALESCE(SUM(litres), 0) INTO v_fuel
  FROM fuel_logs
  WHERE shift_id = p_shift_id;

  RETURN jsonb_build_object(
    'shift', row_to_json(v_shift),
    'machine_name', COALESCE(v_machine.name, v_shift.machine_id),
    'site_name', COALESCE(v_site.name, ''),
    'contractor_name', COALESCE(v_settings.contractor_name, 'Contractor'),
    'owner_name', COALESCE(v_settings.equipment_owner_name, 'Berlington'),
    'client_name', COALESCE(v_settings.client_site_name, 'Site'),
    'stop_reasons', COALESCE(v_settings.stop_reasons, '[]'::jsonb),
    'stops', v_stops,
    'fuel_litres', v_fuel
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    RAISE EXCEPTION 'Invalid or expired sign link. Ask the supervisor to resend it.';
  END IF;
  IF v_shift.site_token_expires_at IS NOT NULL AND v_shift.site_token_expires_at < now() THEN
    RAISE EXCEPTION 'This sign link has expired. Ask the supervisor to resend it.';
  END IF;
  IF v_shift.site_signature_name IS NOT NULL OR v_shift.site_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This shift is already signed by the site supervisor.';
  END IF;
  IF v_shift.shift_status NOT IN ('MACHINE_SIGNED', 'VERIFIED') THEN
    RAISE EXCEPTION 'This shift is not waiting for site sign-off.';
  END IF;

  IF p_action = 'agree' THEN
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
      RAISE EXCEPTION 'Enter your name to sign';
    END IF;
    UPDATE shifts
    SET shift_status = 'VERIFIED',
        verified_at = COALESCE(v_shift.verified_at, now()),
        site_signature_name = trim(p_name),
        site_signer_phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
        site_signed_at = now(),
        site_token = NULL,
        site_token_expires_at = NULL,
        updated_at = now()
    WHERE id = p_shift_id;
  ELSIF p_action = 'dispute' THEN
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
      RAISE EXCEPTION 'Give a reason so the supervisor knows what to fix';
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

GRANT EXECUTE ON FUNCTION public.site_shift_summary(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_sign_shift(text, text, text, text, text, text) TO anon, authenticated;
