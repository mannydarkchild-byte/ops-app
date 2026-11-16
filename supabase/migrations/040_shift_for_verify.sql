-- WhatsApp daily-report links must load the shift even if this phone has not synced yet.

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
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shift_for_verify(TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
