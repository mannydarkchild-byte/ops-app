import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { EXPENSE_CATEGORIES } from "../lib/constants.js";
import { pickGalleryPhoto, resolveMediaUrl } from "../lib/media.js";
import { money } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

export function expenseReceiptRef(expense) {
  const photo = expense?.receipt_photo;
  const ref = expense?.receipt_ref;
  if (typeof photo === "string" && (photo.startsWith("http") || photo.startsWith("data:") || photo.startsWith("blob:"))) return photo;
  return ref || photo || null;
}

export function ViewReceiptButton({ expense, receiptRef: chosenRef, className = "" }) {
  const ref = chosenRef || expenseReceiptRef(expense);
  const [open, setOpen] = useState(false);
  if (!ref) return null;
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`font-ui text-sm font-semibold text-[#F5C518] text-left ${className}`.trim()}
      >
        View receipt
      </button>
      {open && <ReceiptViewModal receiptRef={ref} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReceiptViewModal({ receiptRef, onClose }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setMissing(false);
    resolveMediaUrl(receiptRef).then((next) => {
      if (cancelled) return;
      if (!next) setMissing(true);
      else setUrl(next);
    });
    return () => { cancelled = true; };
  }, [receiptRef]);

  return (
    <div className="ops-sheet fixed inset-0 bg-black/95 z-[80] flex flex-col">
      <div className="flex justify-between items-center gap-3 px-5 py-5 border-b-2 border-[#00A4A6] shrink-0">
        <h3 className="font-logo text-xl tracking-wide text-[#00A4A6]">RECEIPT</h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-5 py-4 bg-[#141414] text-[#F2F0EA] rounded-xl border-2 border-[#00A4A6] font-ui text-base font-semibold"
        >
          CLOSE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {missing && <p className="font-body text-base text-[#F2F0EA]/70">This receipt is not on this phone.</p>}
        {!url && !missing && <p className="font-body text-base text-[#F2F0EA]/70">Opening receipt…</p>}
        {url && <img src={url} alt="Receipt" className="w-full object-contain rounded-2xl bg-[#0A0A0A]" />}
      </div>
    </div>
  );
}

function dateInputValue(iso) {
  const text = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function categoryOptions(categories, current) {
  const list = categories?.length ? categories : EXPENSE_CATEGORIES;
  if (!current || list.some((name) => name.toLowerCase() === String(current).toLowerCase())) return list;
  return [current, ...list];
}

function CategorySelect({ value, onChange, categories }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA]">
      {categoryOptions(categories, value).map((name) => <option key={name}>{name}</option>)}
    </select>
  );
}

export function ExpenseCategoriesModal({ categories, onClose, onSave }) {
  const [list, setList] = useState(categories?.length ? categories : EXPENSE_CATEGORIES);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = () => {
    const next = name.trim();
    if (!next) return;
    if (list.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setError("That category is already on the list.");
      return;
    }
    setError("");
    setList((current) => [...current, next]);
    setName("");
  };

  const save = async () => {
    if (!list.length) {
      setError("Keep at least one category.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave?.(list);
      onClose();
    } catch (e) {
      setError(e.message || "Could not save categories");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="CATEGORIES" color="blue" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA]"
        />
        <button type="button" onClick={add} className="px-4 bg-[#00A4A6] text-white rounded font-ui text-sm font-semibold">
          Add
        </button>
      </div>
      <div className="border border-[#2A2A2A] rounded-2xl overflow-hidden mb-3">
        {list.map((item) => (
          <div key={item} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#2A2A2A] last:border-b-0">
            <span className="font-body text-sm text-[#F2F0EA]">{item}</span>
            <button
              type="button"
              onClick={() => setList((current) => current.filter((entry) => entry !== item))}
              className="font-ui text-sm text-[#EF4444]"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-[#EF4444] mb-2">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy || !list.length}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40"
      >
        {busy ? "SAVING…" : "SAVE CATEGORIES"}
      </button>
    </Modal>
  );
}

export function ExpenseModal({ onClose, user, machine, site, onDone, allowCustomDate = true, categories }) {
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
        <div className="mb-2">
          <CategorySelect value={category} onChange={setCategory} categories={categories} />
        </div>
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
          onClick={() => pickGalleryPhoto(({ ref }) => setReceiptRef(ref))}
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

export function EditExpenseModal({ expense, onClose, onDone, categories }) {
  const [category, setCategory] = useState(expense?.category || "Other");
  const [expenseDate, setExpenseDate] = useState(() => dateInputValue(expense?.date || expense?.created_at));
  const [receiptRef, setReceiptRef] = useState(expense?.receipt_ref || null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savedReceipt = expense?.receipt_ref || expense?.receipt_photo || null;

  useEffect(() => {
    let cancelled = false;
    const ref = receiptRef || savedReceipt;
    if (!ref) {
      setPreview(null);
      return undefined;
    }
    resolveMediaUrl(ref).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => { cancelled = true; };
  }, [receiptRef, savedReceipt]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await wf.updateExpense(expense, {
        category,
        date: expenseDate || undefined,
        receiptRef: receiptRef && receiptRef !== expense?.receipt_ref ? receiptRef : undefined,
      });
      await onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Could not save this expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="EXPENSE" color="blue" onClose={onClose}>
      <p className="font-body text-sm text-[#F2F0EA]/70 mb-3">
        {money(expense?.amount)} · {expense?.description || expense?.vendor || "No description"}
      </p>
      <FormSection step={1} title="Date" description="The day this payment belongs to." accent="#00A4A6">
        <input
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA]"
        />
      </FormSection>
      <FormSection step={2} title="Category" description="Correct the category if the recon guess is wrong." accent="#00A4A6">
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </FormSection>
      <FormSection step={3} title="Receipt" description="Add a photo of the receipt for this payment." accent="#00A4A6">
        {preview && (
          <img src={preview} alt="Receipt" className="w-full max-h-48 object-contain rounded-2xl bg-[#0A0A0A] mb-2" />
        )}
        {(receiptRef || savedReceipt) && (
          <ViewReceiptButton receiptRef={receiptRef || savedReceipt} className="block mb-2" />
        )}
        <button
          type="button"
          onClick={() => pickGalleryPhoto(({ ref }) => setReceiptRef(ref))}
          className="w-full py-3 border border-[#2A2A2A] rounded-full font-logo text-xs text-[#F2F0EA]/70"
        >
          {receiptRef || savedReceipt ? "Replace receipt photo" : "Upload receipt photo"}
        </button>
      </FormSection>
      {error && <p className="text-sm text-[#EF4444] mb-2">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy || !expenseDate}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-full font-logo font-bold disabled:opacity-40"
      >
        {busy ? "SAVING…" : "SAVE"}
      </button>
    </Modal>
  );
}
