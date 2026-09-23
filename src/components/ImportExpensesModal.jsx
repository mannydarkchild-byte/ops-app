import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { parseBankExpenseSheet } from "../lib/importBankExpenses.js";
import { fmtDateShort, money } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

export function ImportExpensesModal({ onClose, user, machine, site, existing = [], onDone }) {
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
    const fresh = result.rows.filter((row) => !known.has(`${row.date}|${row.amount}|${row.description}`));
    setPreview({ ...result, rows: fresh, duplicates: result.rows.length - fresh.length });
  };

  const confirm = async () => {
    if (!preview?.rows?.length) return;
    setBusy(true);
    try {
      for (const row of preview.rows) {
        await wf.addExpense(user, machine, site, row);
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
    <Modal title="Import bank expenses" color="yellow" onClose={onClose}>
      <p className="font-body text-sm text-[#F2F0EA]/75 mb-4 leading-relaxed">
        Upload the bank Excel file. It needs a Date column and an Amount or Debit column. Money coming in is skipped.
      </p>
      <label className="block w-full border border-dashed border-[#F5C518]/50 rounded-xl p-4 text-center cursor-pointer bg-[#0A0A0A]">
        <span className="font-logo text-xs text-[#F5C518]">{fileName || "Choose Excel file"}</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {error && <p className="text-sm text-[#EF4444] mt-3">{error}</p>}
      {preview && (
        <div className="mt-4">
          <p className="font-body text-sm text-[#F2F0EA] mb-2">
            {preview.rows.length} payments ready
            {preview.duplicates ? ` · ${preview.duplicates} already saved` : ""}
            {preview.skipped ? ` · ${preview.skipped} rows skipped` : ""}
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
            {preview.rows.slice(0, 12).map((row, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm border-b border-[#2A2A2A] pb-2">
                <div className="min-w-0">
                  <p className="truncate">{row.description}</p>
                  <p className="text-[#F2F0EA]/45 text-xs">{fmtDateShort(row.date)} · {row.category}</p>
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
