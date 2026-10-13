-- Store the site supervisor's drawn signature from the WhatsApp sign link.
-- Public page has no login, so the RPC writes the signature with the token as auth.

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_signature_ref TEXT;

DROP FUNCTION IF EXISTS public.site_sign_shift(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.site_sign_shift(text, text, text, text, text, text, text);

CREATE FUNCTION public.site_sign_shift(
  p_shift_id TEXT,
  p_token TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'agree',
  p_reason TEXT DEFAULT NULL,
  p_signature TEXT DEFAULT NULL
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
    IF p_signature IS NULL OR length(trim(p_signature)) < 80 THEN
      RAISE EXCEPTION 'Draw your signature to agree';
    END IF;
    UPDATE shifts
    SET shift_status = 'VERIFIED',
        verified_at = COALESCE(v_shift.verified_at, now()),
        site_signature_name = trim(p_name),
        site_signature_ref = p_signature,
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

GRANT EXECUTE ON FUNCTION public.site_sign_shift(text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_shift_summary(text, text) TO anon, authenticated;
