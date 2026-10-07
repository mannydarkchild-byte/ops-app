import { Modal } from "./ui/Modal.jsx";

export function MachineSelect({ machines, value, onChange }) {
  return (
    <label className="block">
      <span className="font-logo text-[10px] tracking-wider text-[#F5C518]">MACHINE</span>
      <div className="relative mt-1">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[#0A0A0A] border border-[#2A2A2A] py-3 pl-3 pr-10 rounded-xl text-[#F2F0EA] font-logo"
        >
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>{machine.name}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F5C518] text-lg" aria-hidden="true">▾</span>
      </div>
    </label>
  );
}

export function DashboardKpi({ label, value, sub, color = "#F2F0EA", onClick }) {
  const className = "w-full text-left rounded-2xl p-4 border";
  const style = { background: "var(--ops-gold-wash)", borderColor: "var(--ops-gold-line)" };
  const body = (
    <>
      <p className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/60">{label}</p>
      <p className="font-logo text-xl mt-1" style={{ color }}>{value}</p>
      {sub && <p className="font-body text-xs text-[#F2F0EA]/50 mt-1">{sub}</p>}
      {onClick && <p className="font-logo text-[10px] text-[#F5C518] mt-2">Details</p>}
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
