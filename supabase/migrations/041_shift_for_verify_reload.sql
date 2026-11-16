-- Reload PostgREST so WhatsApp verify links can call shift_for_verify,
-- and let a signed-in supervisor/admin read waiting reports without a perfect id.

CREATE OR REPLACE FUNCTION public.shift_for_verify(p_shift_id TEXT, p_token TEXT)
RETURNS SETOF public.shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT := NULLIF(btrim(COALESCE(p_shift_id, '')), '');
  v_tok TEXT := NULLIF(btrim(COALESCE(p_token, '')), '');
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM public.shifts s
  WHERE
    (
      v_tok IS NOT NULL AND (
        s.verification_token = v_tok
        OR s.site_token = v_tok
      )
    )
    OR (
      v_id IS NOT NULL
      AND s.id = v_id
      AND (v_tok IS NOT NULL OR auth.uid() IS NOT NULL)
    )
    OR (
      v_id IS NOT NULL
      AND char_length(v_id) >= 12
      AND s.id LIKE v_id || '%'
      AND auth.uid() IS NOT NULL
    )
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.shifts_waiting_verify()
RETURNS SETOF public.shifts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.shifts s
  WHERE s.shift_status IN (
      'WAITING_FOR_VERIFICATION',
      'MACHINE_SIGNED',
      'RESUBMITTED',
      'SUBMITTED'
    )
    AND (
      auth.uid() IS NOT NULL
      AND (
        user_role() IN ('admin', 'manager', 'supervisor')
        OR s.assigned_supervisor_id = auth.uid()
        OR s.site_id = user_site_id()
      )
    )
  ORDER BY s.ended_at DESC NULLS LAST, s.updated_at DESC NULLS LAST
  LIMIT 40;
$$;

GRANT EXECUTE ON FUNCTION public.shift_for_verify(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_waiting_verify() TO authenticated;

NOTIFY pgrst, 'reload schema';
