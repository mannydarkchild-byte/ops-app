import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { SignaturePad } from "./ui/SignaturePad.jsx";
import { Button } from "./ui/Button.jsx";
import { isSiteSignPreview, siteSignPreviewData } from "./siteSignPreview.js";
import { downloadSignedCopyPdf, printSignedCopy, shareSignedCopyPdf } from "../lib/siteSignCopy.js";
import { htmlFromSiteSummary } from "../services/reports.js";

/**
 * Public shift sign-off for Berlington.
 * Shows the same daily report the operator and Darkchild supervisor open.
 * URL: /?sign=<shiftId>&token=<siteToken>  Preview: /?sign=preview
 */
export function SiteSignPage({ shiftId, token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [signature, setSignature] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [copyNote, setCopyNote] = useState("");

  const preview = isSiteSignPreview(shiftId, token);
  const data = state.data;
  const contractorName = data?.contractor_name || "Darkchild";
  const ownerName = data?.owner_name || "Berlington";

  const reportHtml = useMemo(() => {
    if (!data) return "";
    return htmlFromSiteSummary(data, done === "agreed" ? {
      siteSignerName: name.trim() || ownerName,
      siteSignatureUrl: signature,
      siteSignedAt: new Date().toISOString(),
    } : {});
  }, [data, done, name, ownerName, signature]);

  useEffect(() => {
    let cancelled = false;
    if (preview) {
      setState({ loading: false, error: "", data: siteSignPreviewData() });
      return;
    }
    (async () => {
      try {
        const { data: summary, error } = await supabase.rpc("site_shift_summary", {
          p_shift_id: shiftId,
          p_token: token,
        });
        if (error) throw new Error(error.message);
        if (!cancelled) setState({ loading: false, error: "", data: summary });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message || "Could not open this shift", data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [shiftId, token, preview]);

  const submit = async () => {
    if (mode === "agree" && (!name.trim() || !signature)) return;
    if (mode === "dispute" && !reason.trim()) return;
    setBusy(true);
    try {
      if (preview) {
        setDone(mode === "agree" ? "agreed" : "disputed");
        return;
      }
      const { error } = await supabase.rpc("site_sign_shift", {
        p_shift_id: shiftId,
        p_token: token,
        p_name: mode === "agree" ? name.trim() : (name.trim() || ownerName),
        p_phone: null,
        p_action: mode,
        p_reason: mode === "dispute" ? reason.trim() : null,
        p_signature: mode === "agree" ? signature : null,
      });
      if (error) {
        const msg = error.message || "";
        if (/could not find the function|schema cache|does not exist/i.test(msg)) {
          throw new Error("This sign link needs a server update. Ask OPS to apply the latest sign-off, then resend the link.");
        }
        throw new Error(msg);
      }
      setDone(mode === "agree" ? "agreed" : "disputed");
    } catch (e) {
      setState((s) => ({ ...s, error: e.message || "Could not record your decision" }));
    } finally {
      setBusy(false);
    }
  };

  const keepCopy = async (how) => {
    if (!data) return;
    const extras = { ownerSigner: name.trim() || ownerName, ownerSignature: signature };
    setCopyNote("Making the PDF…");
    try {
      if (how === "whatsapp") {
        const result = await shareSignedCopyPdf(data, extras);
        setCopyNote(result === "whatsapp-text" ? "WhatsApp opened with a text copy." : "Pick WhatsApp — the PDF is attached.");
        return;
      }
      if (how === "download") {
        await downloadSignedCopyPdf(data, extras);
        setCopyNote("PDF saved on this phone.");
        return;
      }
      printSignedCopy();
      setCopyNote("Use Save as PDF in the print screen.");
    } catch (e) {
      if (e?.name === "AbortError") {
        setCopyNote("");
        return;
      }
      setCopyNote(e.message || "Could not make a PDF. Try Save as PDF in print.");
    }
  };

  return (
    <div className="site-sign-page min-h-[100dvh] bg-[#0C0C0C] text-[#F2F0EA] flex items-start justify-center px-3 py-6">
      <div className="w-full max-w-3xl space-y-4">
        <div className="text-center">
          <p className="font-logo text-4xl text-[#F5C518] tracking-widest">OPS</p>
          <p className="font-ui text-sm text-[#F2F0EA]/70 mt-1">Daily shift report</p>
          {preview && (
            <p className="mt-2 inline-block bg-[#F5C518]/15 text-[#F5C518] text-xs font-ui font-semibold px-3 py-1 rounded-full">
              Sample — same report the operator and {contractorName} see
            </p>
          )}
        </div>

        {state.loading && <p className="text-center text-sm text-[#F2F0EA]/60 py-12">Loading this shift…</p>}

        {!state.loading && state.error && !data && (
          <div className="bg-[#1a1212] border border-[#EF4444]/40 rounded-2xl p-6 text-center">
            <p className="font-ui font-semibold text-[#EF4444] mb-2">Link problem</p>
            <p className="text-sm text-[#F2F0EA]/70">{state.error}</p>
          </div>
        )}

        {data && (
          <p className="text-sm text-[#F2F0EA]/70 text-center">
            This is the same daily report the operator and {contractorName} have. Add the {ownerName} signature below.
          </p>
        )}

        {reportHtml && (
          <iframe
            id="ops-site-sign-report"
            title="Daily shift report"
            srcDoc={reportHtml}
            className="w-full min-h-[70vh] bg-white rounded-2xl border border-[#2A2A2A]"
          />
        )}

        {data && !done && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
            <p className="font-ui font-semibold">{ownerName} signature</p>
            {!mode && (
              <div className="grid grid-cols-1 gap-2">
                <p className="text-sm text-[#F2F0EA]/70">Sign the billable hours and stop owners on this report.</p>
                <Button size="lg" variant="teal" className="w-full" onClick={() => setMode("agree")}>
                  Agree and sign
                </Button>
                <Button size="lg" variant="primary" className="w-full" onClick={() => setMode("dispute")}>
                  Dispute — send back
                </Button>
              </div>
            )}
            {mode === "agree" && (
              <div className="space-y-3">
                <label className="block">
                  <span className="ops-field-label">Your name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. J. van Wyk"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
                  />
                </label>
                <SignaturePad
                  label={`${ownerName} signature — draw below`}
                  height={140}
                  onChange={setSignature}
                />
                {state.error && <p className="text-sm text-[#EF4444]">{state.error}</p>}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => { setMode(null); setSignature(null); }}>Back</Button>
                  <Button variant="teal" className="flex-1" disabled={busy || !name.trim() || !signature} onClick={submit}>
                    {busy ? "Signing…" : `Sign as ${ownerName}`}
                  </Button>
                </div>
              </div>
            )}
            {mode === "dispute" && (
              <div className="space-y-3">
                <p className="text-sm text-[#F2F0EA]/70">Say what is wrong — it goes straight back to {contractorName}.</p>
                <label className="block">
                  <span className="ops-field-label">Your name (optional)</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. J. van Wyk"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
                  />
                </label>
                <label className="block">
                  <span className="ops-field-label">What is wrong</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. That 2h was a hose, not waiting trucks"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-sm"
                  />
                </label>
                {state.error && <p className="text-sm text-[#EF4444]">{state.error}</p>}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setMode(null)}>Back</Button>
                  <Button variant="primary" className="flex-1" disabled={busy || !reason.trim()} onClick={submit}>
                    {busy ? "Sending…" : "Send back"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {done === "agreed" && (
          <div className="bg-[#22C55E]/10 border border-[#22C55E]/40 rounded-2xl p-5 space-y-3">
            <p className="font-ui font-semibold text-[#22C55E] text-lg">Signed — thank you</p>
            <p className="text-sm text-[#F2F0EA]/70">
              Both signatures are on this report. Save a PDF now — this link will not open again once you leave.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button size="lg" variant="primary" className="w-full" onClick={() => keepCopy("download")}>Save PDF</Button>
              <Button size="lg" variant="whatsapp" className="w-full" onClick={() => keepCopy("whatsapp")}>Send PDF on WhatsApp</Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => keepCopy("print")}>Print</Button>
            </div>
            {copyNote && <p className="text-xs text-[#F2F0EA]/50">{copyNote}</p>}
          </div>
        )}
        {done === "disputed" && (
          <div className="bg-[#F5C518]/10 border border-[#F5C518]/40 rounded-2xl p-6 text-center">
            <p className="font-ui font-semibold text-[#F5C518] text-lg mb-2">Sent back</p>
            <p className="text-sm text-[#F2F0EA]/70">{contractorName} will see your reason and fix it. You can close this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
