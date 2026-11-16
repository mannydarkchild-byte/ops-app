import { useMemo, useState } from "react";
import { getDatePresets } from "../lib/utils.js";
import { printOperationsReport } from "../services/reports.js";
import { MachineSelect } from "./DashboardKpi.jsx";
import { ReportPreviewModal } from "./ReportPreviewModal.jsx";

const PERIOD_IDS = ["today", "week", "last_week", "month", "last_month", "cycle"];

export function OperationsReportPanel({
  site,
  machines = [],
  machineId = "",
  onMachine,
  cycleStartDay = 26,
  data,
  hideMachineSelect = false,
  hideHeader = false,
  hideBillable = false,
}) {
  const [preset, setPreset] = useState("week");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const presets = useMemo(
    () => getDatePresets(cycleStartDay).filter((item) => PERIOD_IDS.includes(item.id)),
    [cycleStartDay]
  );
  const period = useMemo(() => {
    const found = presets.find((item) => item.id === preset) || presets.find((item) => item.id === "week");
    return found ? { start: found.start, end: found.end, label: found.label } : null;
  }, [presets, preset]);
  const machine = machines.find((item) => item.id === machineId) || machines[0] || null;

  const scoped = useMemo(() => {
    const id = machine?.id;
    const match = (row) => !id || row.machine_id === id || !row.machine_id;
    return {
      shifts: (data?.shifts || []).filter((row) => !id || row.machine_id === id),
      events: (data?.events || []).filter(match),
      expenses: (data?.expenses || []).filter((row) => !id || row.machine_id === id),
      fuelLogs: (data?.fuelLogs || []).filter((row) => !id || row.machine_id === id),
      inspections: (data?.inspections || []).filter((row) => !id || row.machine_id === id),
      siteSettings: data?.siteSettings || null,
      dispatches: data?.dispatches || [],
    };
  }, [data, machine?.id]);

  const openReport = async () => {
    if (!period || !site) return;
    setBusy(true);
    setError("");
    try {
      const doc = await printOperationsReport(scoped, period, machine, site, { hideBillable });
      setPreview(doc);
    } catch (e) {
      setError(e.message || "Could not open report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={hideHeader ? "space-y-3" : "bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3"}>
      {!hideHeader && (
        <div>
          <h3 className="font-ui text-sm font-semibold text-[#F5C518]">
            Weekly and monthly{hideMachineSelect && machine?.name ? ` · ${machine.name}` : ""}
          </h3>
          <p className="font-body text-sm text-ops-muted mt-1">
            One operations report for the period you pick. Daily shift reports stay on each shift.
          </p>
        </div>
      )}
      {machines.length > 1 && !hideMachineSelect && (
        <MachineSelect machines={machines} value={machine?.id || ""} onChange={onMachine} />
      )}
      <div className="flex flex-wrap gap-2">
        {presets.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPreset(item.id)}
            className={`px-3 py-2 rounded-lg font-logo text-[10px] ${
              preset === item.id ? "bg-[#F5C518] text-black" : "bg-[#0A0A0A] border border-[#2A2A2A]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && <p className="font-body text-sm text-[#EF4444]">{error}</p>}
      <button
        type="button"
        disabled={busy || !machine}
        onClick={openReport}
        className="w-full bg-[#F5C518] text-black py-4 rounded-2xl font-ui font-semibold disabled:opacity-40"
      >
        {busy ? "Opening…" : `Open ${period?.label?.toLowerCase() || "period"} report`}
      </button>
      {preview && (
        <ReportPreviewModal
          html={preview.html}
          title={preview.title}
          sheets={preview.sheets}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
