import { useRef, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { parseBankExpenseSheet } from "../lib/importBankExpenses.js";
import { fmtDateShort, money } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

function matchMachine(name, machines, fallback) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return fallback || null;
  const exact = (machines || []).find((m) =>
    String(m.name || "").trim().toLowerCase() === wanted
    || String(m.code || "").trim().toLowerCase() === wanted
  );
  if (exact) return exact;
  return (machines || []).find((m) => {
    const label = `${m.name || ""} ${m.code || ""}`.toLowerCase();
    return label.includes(wanted) || wanted.includes(String(m.name || "").trim().toLowerCase());
  }) || fallback || null;
}

export function ImportExpensesModal({ onClose, user, machine, machines = [], site, existing = [], onDone }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  const onFile = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const result = parseBankExpenseSheet(buffer);
    if (result.error) {
      setPreview(null);
      setError(result.error);
      return;
    }
    const known = new Set(existing.map((row) => `${String(row.date || "").slice(0, 10)}|${Number(row.amount)}|${row.description || ""}`));
    const fresh = result.rows
      .filter((row) => !known.has(`${row.date}|${row.amount}|${row.description}`))
      .map((row) => ({ ...row, machine: matchMachine(row.machineName, machines, machine) }));
    setPreview({ ...result, rows: fresh, duplicates: result.rows.length - fresh.length });
  };

  const confirm = async () => {
    if (!preview?.rows?.length) return;
    const missing = preview.rows.find((row) => !row.machine?.id);
    if (missing) {
      setError("Choose a machine on the expenses screen before saving. Each payment needs a machine.");
      return;
    }
    setBusy(true);
    try {
      for (const row of preview.rows) {
        await wf.addExpense(user, row.machine, site, row);
      }
      onDone?.(preview.rows.length);
      onClose();
    } catch (e) {
      setError(e.message || "Could not save expenses");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Upload bank recon" color="yellow" onClose={onClose}>
      <p className="font-body text-sm text-[#F2F0EA]/75 mb-4 leading-relaxed">
        Upload an Excel or CSV recon. Headings can be Date, Description, Amount, and Comments, as on the screener recon. Money coming in is left out.
      </p>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="block w-full border border-dashed border-[#F5C518]/50 rounded-xl p-4 text-center bg-[#0A0A0A]"
      >
        <span className="font-logo text-xs text-[#F5C518]">{fileName || "Choose spreadsheet"}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {machine && (
        <p className="font-body text-xs text-[#F2F0EA]/50 mt-3">
          Payments without a machine column are saved on {machine.name}.
        </p>
      )}
      {error && <p className="text-sm text-[#EF4444] mt-3">{error}</p>}
      {preview && (
        <div className="mt-4">
          <p className="font-body text-sm text-[#F2F0EA] mb-2">
            {preview.rows.length} payments ready
            {preview.sheetName ? ` from ${preview.sheetName}` : ""}
            {preview.duplicates ? ` · ${preview.duplicates} already saved` : ""}
            {preview.skipped ? ` · ${preview.skipped} rows skipped` : ""}
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
            {preview.rows.slice(0, 12).map((row, i) => (
              <div key={`${row.date}-${row.amount}-${i}`} className="flex justify-between gap-3 text-sm border-b border-[#2A2A2A] pb-2">
                <div className="min-w-0">
                  <p className="truncate">{row.description}</p>
                  <p className="text-[#F2F0EA]/45 text-xs">
                    {fmtDateShort(row.date)} · {row.category}
                    {row.machine?.name ? ` · ${row.machine.name}` : ""}
                  </p>
                </div>
                <p className="text-[#F5C518] shrink-0">{money(row.amount)}</p>
              </div>
            ))}
            {preview.rows.length > 12 && (
              <p className="text-xs text-[#F2F0EA]/45">and {preview.rows.length - 12} more</p>
            )}
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !preview.rows.length}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            {busy ? "Saving…" : `Save ${preview.rows.length} expenses`}
          </button>
        </div>
      )}
    </Modal>
  );
}
