-- 034 reads machines.supplier_name / wear_owner_name on the public sign link.
-- Those columns come from 031, which this database may not have run.
-- Add them, and read the machine as JSON so missing fields become null instead of a link error.

ALTER TABLE machines ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS wear_owner_name TEXT;

CREATE OR REPLACE FUNCTION site_shift_summary(p_shift_id TEXT, p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_shift shifts%ROWTYPE;
  v_machine JSONB;
  v_site sites%ROWTYPE;
  v_settings site_settings%ROWTYPE;
  v_stops JSONB;
  v_events JSONB;
  v_fuel JSONB;
  v_fuel_total NUMERIC;
  v_inspections JSONB;
  v_dispatch JSONB;
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

  SELECT to_jsonb(m) INTO v_machine FROM machines m WHERE id = v_shift.machine_id;
  SELECT * INTO v_site FROM sites WHERE id = v_shift.site_id;
  SELECT * INTO v_settings FROM site_settings WHERE site_id = v_shift.site_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'reason', reason,
      'minutes', COALESCE(downtime_minutes, 0),
      'note', COALESCE(note, ''),
      'status', status,
      'stopped_at', stopped_at,
      'restarted_at', restarted_at
    ) ORDER BY stopped_at
  ), '[]'::jsonb)
  INTO v_stops
  FROM events
  WHERE shift_id = p_shift_id AND type = 'STOP';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'shift_id', shift_id,
      'type', type,
      'reason', reason,
      'note', note,
      'stopped_at', stopped_at,
      'restarted_at', restarted_at,
      'downtime_minutes', downtime_minutes,
      'status', status,
      'timestamp', timestamp,
      'photo_data', CASE WHEN photo_data LIKE 'http%' OR photo_data LIKE 'data:image%' THEN photo_data END
    ) ORDER BY COALESCE(timestamp, stopped_at)
  ), '[]'::jsonb)
  INTO v_events
  FROM events
  WHERE shift_id = p_shift_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'shift_id', shift_id,
      'litres', litres,
      'hour_meter', hour_meter,
      'tank_level', tank_level,
      'note', note,
      'timestamp', timestamp
    ) ORDER BY timestamp
  ), '[]'::jsonb)
  INTO v_fuel
  FROM fuel_logs
  WHERE shift_id = p_shift_id;

  SELECT COALESCE(SUM(litres), 0) INTO v_fuel_total
  FROM fuel_logs
  WHERE shift_id = p_shift_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'machine_id', machine_id,
      'operator_id', operator_id,
      'type', type,
      'item_name', item_name,
      'status', status,
      'remark', remark,
      'timestamp', timestamp,
      'photo', CASE WHEN photo LIKE 'http%' OR photo LIKE 'data:image%' THEN photo END
    ) ORDER BY item_name
  ), '[]'::jsonb)
  INTO v_inspections
  FROM inspections
  WHERE machine_id = v_shift.machine_id
    AND type = 'Pre-Start Inspection'
    AND timestamp >= v_shift.started_at - interval '2 hours'
    AND timestamp <= COALESCE(v_shift.ended_at, now());

  SELECT to_jsonb(d) INTO v_dispatch
  FROM site_dispatch d
  WHERE d.site_id = v_shift.site_id
    AND d.dispatch_date = ((v_shift.started_at AT TIME ZONE 'Africa/Johannesburg')::date)
  LIMIT 1;

  RETURN jsonb_build_object(
    'shift', row_to_json(v_shift),
    'machine', jsonb_build_object(
      'id', v_machine->>'id',
      'name', COALESCE(v_machine->>'name', v_shift.machine_id),
      'type', v_machine->>'type',
      'code', v_machine->>'code',
      'supplier_name', v_machine->>'supplier_name',
      'wear_owner_name', v_machine->>'wear_owner_name'
    ),
    'site', jsonb_build_object('id', v_site.id, 'name', COALESCE(v_site.name, '')),
    'machine_name', COALESCE(v_machine->>'name', v_shift.machine_id),
    'site_name', COALESCE(v_site.name, ''),
    'contractor_name', COALESCE(v_settings.contractor_name, 'Contractor'),
    'owner_name', COALESCE(v_settings.equipment_owner_name, 'Berlington'),
    'client_name', COALESCE(v_settings.client_site_name, 'Site'),
    'stop_reasons', COALESCE(v_settings.stop_reasons, '[]'::jsonb),
    'stops', v_stops,
    'events', v_events,
    'fuel_logs', v_fuel,
    'fuel_litres', v_fuel_total,
    'inspections', v_inspections,
    'site_dispatch', v_dispatch
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.site_shift_summary(text, text) TO anon, authenticated;
