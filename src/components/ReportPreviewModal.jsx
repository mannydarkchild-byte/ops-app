import { useEffect, useState } from "react";
import {
  buildReportFiles,
  downloadBlob,
  excelFileFromSheets,
  shareNativeFile,
} from "../lib/reportShare.js";

/** Full-screen report viewer — PDF / WhatsApp / email / Excel. */
export function ReportPreviewModal({ html, title, sheets, onClose }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("Preparing the PDF…");
  const [files, setFiles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setNote("Preparing the PDF…");
    (async () => {
      try {
        const built = await buildReportFiles(html, title);
        if (cancelled) return;
        setFiles(built);
        setNote("PDF ready. Tap WhatsApp, Email, or Download.");
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
      if (result === "shared") setNote("Pick WhatsApp — the report file is already attached.");
      if (result === "downloaded") setNote("Saved on this phone. Send that file from WhatsApp.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setNote(e.message || "Could not share this report.");
    } finally {
      setBusy("");
    }
  };

  const pdf = files?.pdf || files?.file;
  const image = files?.jpeg || files?.png;
  const ready = Boolean(pdf || image);

  return (
    <div className="ops-sheet fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="shrink-0 border-b border-[#2A2A2A] bg-[#141414] px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-4 py-3 bg-[#2A2A2A] text-[#F2F0EA] rounded-xl font-logo"
          >
            Back
          </button>
          <p className="flex-1 min-w-0 font-logo text-[#F2F0EA] truncate">{title || "Report"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!ready || !!busy}
            onClick={() => run("download", () => {
              downloadBlob(pdf || image, (pdf || image).name);
              return "downloaded";
            })}
            className="bg-[#F5C518] text-black rounded-xl font-logo font-bold disabled:opacity-50"
          >
            {busy === "download" ? "Saving…" : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={!ready || !!busy}
            onClick={() => run("whatsapp", () => shareNativeFile(image || pdf))}
            className="bg-[#25D366] text-black rounded-xl font-logo font-bold disabled:opacity-50"
          >
            {busy === "whatsapp" ? "Opening…" : "WhatsApp"}
          </button>
          <button
            type="button"
            disabled={!ready || !!busy}
            onClick={() => run("email", () => shareNativeFile(pdf || image))}
            className="border border-[#2A2A2A] text-[#F2F0EA] rounded-xl font-logo disabled:opacity-50"
          >
            {busy === "email" ? "Opening…" : "Email"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("excel", () => shareNativeFile(excelFileFromSheets(sheets, title)))}
            className="border border-[#F5C518] text-[#F5C518] rounded-xl font-logo disabled:opacity-50"
          >
            {busy === "excel" ? "Opening…" : "Excel"}
          </button>
        </div>
        {note && <p className="font-body text-[#F5C518]">{note}</p>}
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
