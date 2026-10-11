--- Public shift summary for the WhatsApp site sign-off link.
--- No login required; the site token is the auth. Read-only.

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
    RAISE EXCEPTION 'Invalid sign link. Ask the machine supervisor to resend it.';
  END IF;
  IF v_shift.site_token_expires_at IS NOT NULL AND v_shift.site_token_expires_at < now() THEN
    RAISE EXCEPTION 'This sign link has expired. Ask the machine supervisor to resend it.';
  END IF;
  IF v_shift.shift_status <> 'MACHINE_SIGNED' THEN
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
    'owner_name', COALESCE(v_settings.equipment_owner_name, 'Equipment owner'),
    'client_name', COALESCE(v_settings.client_site_name, 'Site'),
    'stop_reasons', COALESCE(v_settings.stop_reasons, '[]'::jsonb),
    'stops', v_stops,
    'fuel_litres', v_fuel
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
