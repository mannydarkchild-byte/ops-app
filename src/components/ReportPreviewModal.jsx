import { useState } from "react";
import {
  downloadReportFile,
  openReportEmail,
  openReportWhatsApp,
  shareReportFile,
} from "../lib/reportShare.js";

/** Full-screen report viewer — download or share, no print. */
export function ReportPreviewModal({ html, title, onClose }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const run = async (key, fn) => {
    setBusy(key);
    setNote("");
    try {
      const result = await fn();
      if (result === "downloaded") {
        setNote("Saved on this phone. Open WhatsApp or email and attach that file.");
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      setNote(e.message || "Could not share this report.");
    } finally {
      setBusy("");
    }
  };

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
            disabled={!!busy}
            onClick={() => run("download", () => downloadReportFile(html, title))}
            className="bg-[#F5C518] text-black rounded-xl font-logo font-bold disabled:opacity-50"
          >
            {busy === "download" ? "Saving…" : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("share", () => shareReportFile(html, title))}
            className="bg-[#22C55E] text-black rounded-xl font-logo font-bold disabled:opacity-50"
          >
            {busy === "share" ? "Opening…" : "Share"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => openReportWhatsApp(title, "OPS daily report")}
            className="border border-[#25D366] text-[#25D366] rounded-xl font-logo disabled:opacity-50"
          >
            WhatsApp
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => openReportEmail(title, "OPS daily report")}
            className="border border-[#2A2A2A] text-[#F2F0EA] rounded-xl font-logo disabled:opacity-50"
          >
            Email
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
