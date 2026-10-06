import { useMemo, useState } from "react";
import { EditExpenseModal } from "./ExpenseModal.jsx";
import { fmtDateShort, getBillingPeriod, getDatePresets, inPeriod, money, onSiteRecord } from "../lib/utils.js";

const FILTERS = [
  { id: "cycle", label: "This cycle" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

export function SiteExpensesPanel({ expenses = [], machines = [], siteId, cycleStartDay = 26, scopeLabel = "This site", canEdit = false, onSaved }) {
  const [filter, setFilter] = useState("cycle");
  const [editing, setEditing] = useState(null);

  const period = useMemo(() => {
    if (filter === "all") return null;
    if (filter === "cycle") return getBillingPeriod(new Date(), cycleStartDay);
    const preset = getDatePresets(cycleStartDay).find((p) => p.id === filter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : getBillingPeriod(new Date(), cycleStartDay);
  }, [filter, cycleStartDay]);

  const rows = useMemo(() => {
    return (expenses || [])
      .filter((e) => onSiteRecord(e, siteId, machines))
      .filter((e) => !period || inPeriod(e.date || e.created_at, period))
      .sort((a, b) => (whenSort(b) - whenSort(a)));
  }, [expenses, machines, siteId, period]);

  const total = rows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const machineName = (id) => machines.find((m) => m.id === id)?.name || "Machine";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${filter === f.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[#F2F0EA]/40">
        {scopeLabel} · {period?.label || "All time"} · {money(total)} · {rows.length} entries
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#F2F0EA]/40 text-center py-8">
          No expenses for this period. Choose All to see earlier payments, including a bank recon.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => {
            const body = (
              <>
                <div className="min-w-0">
                  <p className="font-logo text-xs">{e.category || "Expense"}</p>
                  <p className="text-[10px] text-[#F2F0EA]/50 truncate">{e.description || e.vendor || "—"}</p>
                  <p className="text-[9px] text-[#F2F0EA]/30 mt-0.5">
                    {machineName(e.machine_id)} · {fmtDateShort(e.date || e.created_at)}
                    {canEdit ? ` · ${e.receipt_ref || e.receipt_photo ? "Receipt on file" : "No receipt"}` : ""}
                  </p>
                </div>
                <p className="font-logo text-[#F5C518] shrink-0">{money(e.amount)}</p>
              </>
            );
            return canEdit ? (
              <button key={e.id} type="button" onClick={() => setEditing(e)} className="w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl p-3 flex justify-between gap-3">
                {body}
              </button>
            ) : (
              <div key={e.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-3 flex justify-between gap-3">
                {body}
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <EditExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onDone={async () => { await onSaved?.(); }}
        />
      )}
    </div>
  );
}

function whenSort(row) {
  const t = new Date(row?.date || row?.created_at || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}
