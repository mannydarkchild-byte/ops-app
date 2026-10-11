import { Modal } from "./ui/Modal.jsx";
import { FieldSelect } from "./ui/FieldSelect.jsx";

export function MachineSelect({ machines, value, onChange }) {
  return (
    <label className="block">
      <span className="ops-field-label">Machine</span>
      <FieldSelect value={value || ""} onChange={onChange} placeholder="Choose a machine…">
        {machines.map((machine) => (
          <option key={machine.id} value={machine.id}>{machine.name}</option>
        ))}
      </FieldSelect>
    </label>
  );
}

export function DashboardKpi({ label, value, sub, color = "#F2F0EA", onClick, progress }) {
  const className = "w-full text-left rounded-2xl p-4 border";
  const style = { background: "var(--ops-gold-wash)", borderColor: "var(--ops-gold-line)" };
  const pct = progress == null || !Number.isFinite(Number(progress))
    ? null
    : Math.min(100, Math.max(0, Number(progress) * 100));
  const body = (
    <>
      <p className="font-ui text-xs font-semibold text-[#F2F0EA]/60">{label}</p>
      <p className="font-ui text-xl font-semibold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="font-body text-xs text-[#F2F0EA]/50 mt-1">{sub}</p>}
      {pct != null && (
        <div className="mt-2 h-1.5 rounded-full bg-black/35 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-[#F5C518]" style={{ width: `${pct}%` }} />
        </div>
      )}
      {onClick && <p className="font-ui text-xs text-[#F5C518] mt-2">Details</p>}
    </>
  );
  if (!onClick) {
    return <div className={className} style={style}>{body}</div>;
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {body}
    </button>
  );
}

export function KpiDetailModal({ detail, onClose }) {
  if (!detail) return null;
  return (
    <Modal title={detail.title} color="yellow" onClose={onClose}>
      {detail.scope && <p className="font-body text-sm text-[#F2F0EA]/80 mb-1">{detail.scope}</p>}
      {detail.note && <p className="font-body text-xs text-[#F2F0EA]/50 mb-3">{detail.note}</p>}
      <p className="font-logo text-2xl text-[#F5C518] mb-4">{detail.total}</p>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {detail.rows?.length ? detail.rows.map((row) => (
          <div key={row.id} className={`flex justify-between gap-3 py-2 border-b border-[#2A2A2A] ${row.emphasis ? "bg-[#141414] px-2 rounded-lg" : ""}`}>
            <div className="min-w-0">
              <p className="font-logo text-sm text-[#F2F0EA]">{row.title}</p>
              {row.detail && <p className="text-[11px] text-[#F2F0EA]/45">{row.detail}</p>}
            </div>
            <p className="font-logo text-sm text-[#F2F0EA] shrink-0">{row.value}</p>
          </div>
        )) : (
          <p className="font-body text-sm text-[#F2F0EA]/40">Nothing in this period.</p>
        )}
      </div>
    </Modal>
  );
}
