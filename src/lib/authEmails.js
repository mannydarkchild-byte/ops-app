const LOGO = "https://opsapp.africa/icons/icon-192.png";
const APP = "https://opsapp.africa";

/** OPS-branded HTML for Supabase Authentication → Email Templates. Uses {{ .ConfirmationURL }}. */
export function brandedAuthEmailHtml({
  heading,
  body,
  button,
} = {}) {
  const title = heading || "Confirm your OPS login";
  const copy = body || "Tap the button to confirm this email and open OPS.";
  const cta = button || "Open OPS";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;color:#F2F0EA;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0A;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#141414;border:1px solid #2A2A2A;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;">
              <img src="${LOGO}" width="72" height="72" alt="OPS" style="display:block;margin:0 auto 16px;border-radius:16px;" />
              <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:2px;color:#F5C518;">OPS</p>
              <p style="margin:8px 0 0;font-size:13px;color:#F2F0EA;opacity:0.6;">Equipment operations · Shift verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#F2F0EA;">${title}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#F2F0EA;opacity:0.85;">${copy}</p>
              <p style="margin:0 0 8px;text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#F5C518;color:#0A0A0A;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;">${cta}</a>
              </p>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#F2F0EA;opacity:0.45;">
                If the button does not work, copy this link into your browser:<br />
                <a href="{{ .ConfirmationURL }}" style="color:#F5C518;word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#F2F0EA;opacity:0.35;">
                OPS · <a href="${APP}" style="color:#F5C518;text-decoration:none;">opsapp.africa</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const AUTH_EMAIL_TEMPLATES = {
  confirmation: {
    subject: "Confirm your OPS login",
    heading: "Confirm your email",
    body: "An OPS account was created for you. Tap below to confirm this email, then sign in with the password your admin gave you.",
    button: "Confirm and open OPS",
  },
  invite: {
    subject: "You have been added to OPS",
    heading: "You are on OPS",
    body: "Your admin added you to the site app. Tap below to confirm your email and open OPS.",
    button: "Join OPS",
  },
  recovery: {
    subject: "Reset your OPS password",
    heading: "Reset your password",
    body: "Tap below to choose a new OPS password. If you did not ask for this, ignore the email.",
    button: "Choose a new password",
  },
  magic_link: {
    subject: "Your OPS sign-in link",
    heading: "Sign in to OPS",
    body: "Tap below to sign in. This link is only for you.",
    button: "Sign in to OPS",
  },
};

export function authEmailHtml(kind) {
  const spec = AUTH_EMAIL_TEMPLATES[kind] || AUTH_EMAIL_TEMPLATES.confirmation;
  return brandedAuthEmailHtml(spec);
}
