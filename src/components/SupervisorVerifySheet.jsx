import { Button } from "./ui/Button.jsx";
import { SignaturePad } from "./ui/SignaturePad.jsx";

/**
 * Darkchild supervisor: the WhatsApp verify link opens this sheet —
 * the actual daily report, with Sign / Send back at the bottom.
 */
export function SupervisorVerifySheet({
  title,
  html,
  loading,
  error,
  mode = "sign",
  signature,
  onSignature,
  busy,
  ownerName = "Berlington",
  onSign,
  onSendBack,
  onSendToOwner,
  onClose,
  onRetry,
}) {
  return (
    <div className="ops-sheet fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="shrink-0 border-b border-[#2A2A2A] bg-[#141414] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-4 py-3 bg-[#2A2A2A] text-[#F2F0EA] rounded-xl font-ui font-semibold"
        >
          Back
        </button>
        <p className="flex-1 min-w-0 font-ui font-semibold text-[#F2F0EA] truncate">{title || "Daily report"}</p>
      </div>

      {loading && (
        <p className="flex-1 flex items-center justify-center font-body text-[#F2F0EA]/60">Loading this report…</p>
      )}

      {!loading && error && !html && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-3">
            <p className="font-ui font-semibold text-[#EF4444]">Could not open this report</p>
            <p className="font-body text-sm text-[#F2F0EA]/70">{error}</p>
            {onRetry ? (
              <Button className="w-full" onClick={onRetry}>Try again</Button>
            ) : null}
            <Button className="w-full" variant="secondary" onClick={onClose}>Back to reports</Button>
          </div>
        </div>
      )}

      {html && (
        <iframe
          title={title || "Daily report"}
          srcDoc={html}
          className="flex-1 w-full bg-white border-0"
        />
      )}

      {!loading && html && mode === "sign" && (
        <div className="shrink-0 border-t border-[#2A2A2A] bg-[#141414] px-4 py-4 space-y-3 max-h-[46vh] overflow-y-auto">
          <p className="font-ui font-semibold text-[#F2F0EA]">Sign this report</p>
          <SignaturePad onChange={onSignature} />
          <Button className="w-full" size="lg" disabled={busy || !signature} onClick={onSign}>
            {busy ? "Signing…" : "Sign"}
          </Button>
          <Button className="w-full" size="lg" variant="secondary" disabled={busy} onClick={onSendBack}>
            Send back
          </Button>
        </div>
      )}

      {!loading && html && mode === "send" && (
        <div className="shrink-0 border-t border-[#25D366]/40 bg-[#141414] px-4 py-4 space-y-3">
          <p className="font-ui font-semibold text-[#22C55E]">Saved</p>
          <p className="font-body text-sm text-[#F2F0EA]/70">
            Darkchild’s signature has saved this shift. Send {ownerName} the link when you want their signature. The shift stays saved if they do not sign.
          </p>
          <Button className="w-full" size="lg" variant="whatsapp" disabled={busy} onClick={onSendToOwner}>
            {busy ? "Opening…" : `WhatsApp ${ownerName}`}
          </Button>
        </div>
      )}

      {!loading && html && mode === "filed" && (
        <div className="shrink-0 border-t border-[#2A2A2A] bg-[#141414] px-4 py-4">
          <p className="font-body text-sm text-[#22C55E]">This signed copy is filed. You can open it again from Reports.</p>
        </div>
      )}
    </div>
  );
}
