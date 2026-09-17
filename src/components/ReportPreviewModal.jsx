/** Full-screen in-app report viewer — no tiny pop-up windows */
export function ReportPreviewModal({ html, title, onClose }) {
  const printReport = () => {
    const frame = document.getElementById("ops-report-frame");
    try {
      frame?.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A] bg-[#141414] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-4 py-3 bg-[#2A2A2A] text-[#F2F0EA] rounded-lg font-logo text-sm"
        >
          ← BACK
        </button>
        <p className="flex-1 min-w-0 text-sm font-logo text-[#F2F0EA] truncate">{title || "Report"}</p>
        <button
          type="button"
          onClick={printReport}
          className="shrink-0 px-4 py-3 bg-[#F5C518] text-black rounded-lg font-logo text-sm font-bold"
        >
          PRINT
        </button>
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
