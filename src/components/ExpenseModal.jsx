import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { EXPENSE_CATEGORIES } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
import * as wf from "../services/workflows.js";

export function ExpenseModal({ onClose, user, machine, site, onDone, allowCustomDate = true }) {
  const [category, setCategory] = useState("Parts");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptRef, setReceiptRef] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    try {
      await wf.addExpense(user, machine, site, {
        category,
        amount,
        vendor,
        description,
        receiptRef: receiptRef || null,
        date: allowCustomDate ? expenseDate : undefined,
      });
      await onDone?.();
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="LOG EXPENSE" color="blue" onClose={onClose}>
      <FormSection
        step={1}
        title={allowCustomDate ? "Expense date" : "Machine & site"}
        description={allowCustomDate
          ? "Set today or pick an earlier date to backdate this expense."
          : `${machine?.name || "Machine"} · ${site?.name || "Site"}`}
        accent="#00A4A6"
      >
        {allowCustomDate ? (
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA]"
          />
        ) : (
          <p className="font-logo text-xs text-[#F2F0EA]/70">{machine?.name} · {site?.name}</p>
        )}
      </FormSection>

      <FormSection step={2} title="Amount & category" description="What was spent and on what." accent="#00A4A6">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-2 text-[#F2F0EA]">
          {EXPENSE_CATEGORIES.map((x) => <option key={x}>{x}</option>)}
        </select>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (R)"
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-2 text-[#F2F0EA] text-xl"
        />
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor / supplier (optional)"
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA]"
        />
      </FormSection>

      <FormSection step={3} title="Details" description="Notes and receipt — receipt is optional, especially for backdated entries." accent="#00A4A6">
        <VoiceInput value={description} onChange={setDescription} placeholder="What was purchased…" rows={2} />
        <button
          type="button"
          onClick={() => pickMedia("photo", ({ ref }) => setReceiptRef(ref))}
          className="w-full mt-2 py-3 border border-[#2A2A2A] rounded-xl font-logo text-xs text-[#F2F0EA]/70"
        >
          {receiptRef ? "✓ Receipt attached" : "+ Receipt photo (optional)"}
        </button>
      </FormSection>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !amount || Number(amount) <= 0}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40"
      >
        {busy ? "SAVING…" : allowCustomDate && expenseDate < new Date().toISOString().slice(0, 10) ? "SAVE BACKDATED EXPENSE" : "SAVE EXPENSE"}
      </button>
    </Modal>
  );
}
