import { useEffect, useState } from "react";
import {
  buildReportFiles,
  downloadBlob,
  shareNativeFile,
} from "../lib/reportShare.js";
import { Button } from "./ui/Button.jsx";

/** Full-screen report viewer. One Share button; every option sends A4 PDF. */
export function ReportPreviewModal({ html, title, startShareOpen = false, onClose }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("Preparing the PDF…");
  const [files, setFiles] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setShareOpen(!!startShareOpen);
    setNote("Preparing the PDF…");
    (async () => {
      try {
        const built = await buildReportFiles(html, title);
        if (cancelled) return;
        setFiles(built);
        setNote("PDF ready.");
      } catch (e) {
        if (!cancelled) setNote(e.message || "Could not build the PDF on this phone.");
      }
    })();
    return () => { cancelled = true; };
  }, [html, title]);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      const result = await fn();
      if (result === "shared") setNote("Pick the app — the PDF is already attached.");
      if (result === "downloaded") setNote("PDF saved on this phone.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setNote(e.message || "Could not share this report.");
    } finally {
      setBusy("");
    }
  };

  const pdf = files?.pdf || files?.file;
  const ready = Boolean(pdf);

  return (
    <div className="ops-sheet fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="shrink-0 border-b border-[#2A2A2A] bg-[#141414] px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-4 py-3 bg-[#2A2A2A] text-[#F2F0EA] rounded-xl font-ui font-semibold"
          >
            Back
          </button>
          <p className="flex-1 min-w-0 font-ui font-semibold text-[#F2F0EA] truncate">{title || "Report"}</p>
          <Button
            type="button"
            disabled={!ready || !!busy}
            onClick={() => setShareOpen((open) => !open)}
          >
            {busy ? "Sharing…" : shareOpen ? "Close share" : "Share"}
          </Button>
        </div>
        {shareOpen && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              disabled={!ready || !!busy}
              onClick={() => run("download", () => {
                downloadBlob(pdf, pdf.name);
                return "downloaded";
              })}
            >
              {busy === "download" ? "Saving…" : "Download PDF"}
            </Button>
            <Button
              variant="whatsapp"
              disabled={!ready || !!busy}
              onClick={() => run("whatsapp", () => shareNativeFile(pdf))}
            >
              {busy === "whatsapp" ? "Opening…" : "WhatsApp PDF"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!ready || !!busy}
              onClick={() => run("email", () => shareNativeFile(pdf))}
            >
              {busy === "email" ? "Opening…" : "Email PDF"}
            </Button>
          </div>
        )}
        {note && <p className="font-body text-sm text-[#F5C518]">{note}</p>}
      </div>
      <iframe
        id="ops-report-frame"
        title={title || "Report"}
        srcDoc={html}
        className="flex-1 w-full bg-white border-0"
      />
    </div>
  );
}
