import { useState } from "react";
import { AUTH_EMAIL_TEMPLATES, authEmailHtml } from "../../lib/authEmails.js";
import { Button } from "../ui/Button.jsx";

const KINDS = [
  { id: "confirmation", label: "Confirm signup" },
  { id: "invite", label: "Invite" },
  { id: "recovery", label: "Reset password" },
  { id: "magic_link", label: "Magic link" },
];

export function AuthEmailBrandCard() {
  const [copied, setCopied] = useState("");

  const copy = async (kind) => {
    const html = authEmailHtml(kind);
    try {
      await navigator.clipboard.writeText(html);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <div>
        <p className="font-ui text-sm font-semibold text-[#F5C518]">OPS login emails</p>
        <p className="font-body text-xs text-[#F2F0EA]/55 mt-1">
          In Supabase: Authentication → Email Templates. Paste each HTML below. Site URL must be https://opsapp.africa. Redirect URLs: https://opsapp.africa/**
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <Button key={k.id} variant="secondary" size="md" onClick={() => copy(k.id)}>
            {copied === k.id ? "Copied" : `Copy ${k.label}`}
          </Button>
        ))}
      </div>
      <p className="font-body text-[11px] text-[#F2F0EA]/40">
        Subject line: {AUTH_EMAIL_TEMPLATES.confirmation.subject}
      </p>
    </div>
  );
}
