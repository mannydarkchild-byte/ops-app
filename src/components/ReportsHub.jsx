import { IconFolder } from "./FieldIcons.jsx";

function attentionLine(count = {}) {
  const bits = [];
  if (count.waiting) bits.push(`${count.waiting} waiting`);
  if (count.send) bits.push(`${count.send} to send`);
  if (!bits.length && count.signed) bits.push(`${count.signed} signed`);
  return bits.join(" · ");
}

export const REPORT_KIND = {
  daily: {
    id: "daily",
    label: "Daily shift",
    hint: "Sign, send, and filed copies",
    needsMachine: true,
    includeAll: true,
  },
  operations: {
    id: "operations",
    label: "Operations",
    hint: "Weekly and monthly by machine",
    needsMachine: true,
    includeAll: false,
  },
  timesheet: {
    id: "timesheet",
    label: "Timesheets",
    hint: "Clock-in hours on site",
    needsMachine: false,
  },
  dispatch: {
    id: "dispatch",
    label: "Dispatch",
    hint: "Daily tonnes and trucks",
    needsMachine: false,
  },
};

export function pickReportKind(id, kinds, machines) {
  const meta = kinds.find((item) => item.id === id);
  if (!meta?.needsMachine) return { kind: id, machineId: null };
  if (machines.length === 1) return { kind: id, machineId: machines[0].id };
  return { kind: id, machineId: null };
}

export function ReportsHub({
  kinds = [],
  machines = [],
  kind,
  machineId,
  onKind,
  onMachine,
  counts = {},
  machineCounts = {},
  attention = [],
  children,
}) {
  const kindMeta = kinds.find((item) => item.id === kind) || null;
  const pickingMachine = Boolean(kindMeta?.needsMachine && machineId == null && machines.length > 1);
  const title = pickingMachine
    ? kindMeta.label
    : kindMeta
      ? [kindMeta.label, machines.find((item) => item.id === machineId)?.name || (machineId === "" ? "All machines" : "")]
          .filter(Boolean)
          .join(" · ")
      : "Reports";

  const goKind = (id) => {
    const next = pickReportKind(id, kinds, machines);
    onKind(next.kind);
    onMachine(next.machineId);
  };

  const goBack = () => {
    if (pickingMachine) {
      onKind(null);
      onMachine(null);
      return;
    }
    if (kindMeta?.needsMachine && machines.length > 1) {
      onMachine(null);
      return;
    }
    onKind(null);
    onMachine(null);
  };

  if (!kind) {
    return (
      <div className="space-y-3">
        <p className="font-body text-sm text-ops-muted">Open a folder.</p>
        {attention.length > 0 && (
          <div className="space-y-2">
            <p className="font-ui text-xs font-semibold text-[#F5C518]">Needs you</p>
            {attention.map((item) => (
              <button
                key={item.machineId}
                type="button"
                onClick={() => {
                  onKind("daily");
                  onMachine(item.machineId);
                }}
                className="w-full text-left bg-ops-card border-2 border-ops-gold rounded-2xl p-4"
              >
                <p className="font-ui font-semibold text-ops-text">{item.name}</p>
                <p className="font-body text-sm text-ops-muted mt-1">{item.line}</p>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {kinds.map((item) => {
            const count = counts[item.id] || {};
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goKind(item.id)}
                className="w-full flex items-center gap-3 text-left bg-ops-card border border-ops-gold/40 rounded-2xl px-4 py-3 min-h-[64px]"
              >
                <span className="text-[#F5C518] shrink-0"><IconFolder size={28} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-ui font-semibold text-ops-text truncate">{item.label}</span>
                  <span className="block font-body text-xs text-ops-muted mt-0.5">{count.sub || item.hint}</span>
                  {count.badge ? (
                    <span className="block font-ui text-xs font-semibold text-[#F5C518] mt-1">{count.badge}</span>
                  ) : null}
                </span>
                <span className="text-[#F5C518] text-lg shrink-0" aria-hidden>›</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <button type="button" onClick={goBack} className="font-ui text-sm text-[#F5C518]">
          ← {pickingMachine ? "Reports" : kindMeta?.needsMachine && machines.length > 1 ? kindMeta.label : "Reports"}
        </button>
        <h2 className="font-ui text-lg font-semibold text-ops-text mt-1">{title}</h2>
      </div>

      {pickingMachine ? (
        <div className="space-y-2">
          <p className="font-body text-sm text-ops-muted">Open a machine folder.</p>
          {machines.map((machine) => {
            const count = machineCounts[machine.id] || {};
            const line = count.sub || attentionLine(count);
            return (
              <button
                key={machine.id}
                type="button"
                onClick={() => onMachine(machine.id)}
                className="w-full flex items-center gap-3 text-left bg-ops-card border border-ops-gold/40 rounded-2xl px-4 py-3 min-h-[64px]"
              >
                <span className="text-[#F5C518] shrink-0"><IconFolder size={28} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-ui font-semibold text-ops-text truncate">{machine.name}</span>
                  {line ? <span className="block font-body text-xs text-ops-muted mt-0.5">{line}</span> : null}
                </span>
                <span className="text-[#F5C518] text-lg shrink-0" aria-hidden>›</span>
              </button>
            );
          })}
          {kindMeta.includeAll && (
            <button
              type="button"
              onClick={() => onMachine("")}
              className="w-full text-left bg-ops-card border border-[#2A2A2A] rounded-2xl p-4"
            >
              <p className="font-ui font-semibold text-ops-text">All machines</p>
              <p className="font-body text-sm text-ops-muted mt-1">Grouped by machine</p>
            </button>
          )}
        </div>
      ) : children}
    </div>
  );
}
