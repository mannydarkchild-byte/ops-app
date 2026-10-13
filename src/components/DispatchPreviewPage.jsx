import { useEffect, useState } from "react";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import { dispatchPreviewRow } from "./dispatchPreview.js";

/** Public sample of the daily dispatch report. URL: /?dispatch=preview */
export function DispatchPreviewPage() {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    dispatchDayReport(dispatchPreviewRow(), { name: "Site" })
      .then((report) => {
        if (!cancelled) setHtml(report.html);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Could not open this report");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#0C0C0C] text-[#F2F0EA] flex items-start justify-center px-3 py-6">
      <div className="w-full max-w-3xl space-y-4">
        <div className="text-center">
          <p className="font-logo text-4xl text-[#F5C518] tracking-widest">OPS</p>
          <p className="font-ui text-sm text-[#F2F0EA]/70 mt-1">Daily dispatch report</p>
          <p className="mt-2 inline-block bg-[#F5C518]/15 text-[#F5C518] text-xs font-ui font-semibold px-3 py-1 rounded-full">
            Sample — 3 weighbridge tickets
          </p>
        </div>
        {!html && !error && <p className="text-center text-sm text-[#F2F0EA]/60 py-12">Loading the report…</p>}
        {error && <p className="text-center text-sm text-[#EF4444] py-12">{error}</p>}
        {html && (
          <iframe
            title="Daily dispatch report"
            srcDoc={html}
            className="w-full min-h-[90vh] bg-white rounded-2xl border border-[#2A2A2A]"
          />
        )}
      </div>
    </div>
  );
}
