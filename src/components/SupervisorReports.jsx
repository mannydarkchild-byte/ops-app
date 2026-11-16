import { MachineSelect } from "./DashboardKpi.jsx";
import { FieldSelect } from "./ui/FieldSelect.jsx";
import { ReportBrowser, buildMonthFolders } from "./ReportCabinet.jsx";
import { dispatchInPeriod, dispatchStatus, DISPATCH_STATUS, productionForShift, screenedTonnes, tonnesLabel } from "../lib/dispatchMetrics.js";
import { whenMs } from "../lib/utils.js";

function fileDate(iso) {
  const date = new Date(whenMs(iso));
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function groupByMachine(rows, machines, machineIdOf) {
  const buckets = new Map();
  for (const machine of machines || []) buckets.set(machine.id, { machine, rows: [] });
  const other = [];
  for (const row of rows) {
    const id = machineIdOf(row);
    if (buckets.has(id)) buckets.get(id).rows.push(row);
    else other.push(row);
  }
  const grouped = [...buckets.values()].filter((item) => item.rows.length);
  if (other.length) grouped.push({ machine: { id: "_other", name: "Other" }, rows: other });
  return grouped;
}

export function SupervisorReports({
  group = "operators",
  machines,
  machineId,
  onMachine,
  period,
  periodLabel,
  filter,
  filters,
  onFilter,
  signedReports = [],
  dispatches,
  siteConfig,
  onView,
  onOpenDispatch,
}) {
  const dispatchRows = (dispatches || []).filter((row) => dispatchStatus(row) === DISPATCH_STATUS.SIGNED && dispatchInPeriod(row, period));
  const filedShifts = machineId
    ? signedReports.filter((row) => row.machine_id === machineId)
    : signedReports;

  const shiftFile = (row) => {
    const production = productionForShift(row, dispatches, siteConfig);
    const screened = production?.tonnes_screened;
    const hours = Number(row.hours_worked || 0).toFixed(1);
    return {
      id: row.id,
      name: `${fileDate(row.verified_at || row.ended_at || row.started_at)} · ${row.operator_name || "Operator"}`,
      detail: screened == null ? `${hours}h` : `${hours}h · ${tonnesLabel(screened)} screened`,
      onOpen: () => onView?.(row),
    };
  };

  const shiftFolders = !machineId && machines?.length > 1
    ? groupByMachine(filedShifts, machines, (row) => row.machine_id).map((item) => ({
        id: item.machine.id,
        name: item.machine.name,
        detail: `${item.rows.length} ${item.rows.length === 1 ? "report" : "reports"}`,
        folders: buildMonthFolders(item.rows, {
          dateOf: (row) => row.verified_at || row.ended_at || row.started_at,
          fileOf: shiftFile,
        }),
      }))
    : buildMonthFolders(filedShifts, {
        dateOf: (row) => row.verified_at || row.ended_at || row.started_at,
        fileOf: shiftFile,
      });

  const dispatchDays = [];
  for (const row of [...dispatchRows].sort((a, b) => String(b.dispatch_date || "").localeCompare(String(a.dispatch_date || "")))) {
    const key = String(row.dispatch_date || "").slice(0, 10) || "undated";
    const last = dispatchDays[dispatchDays.length - 1];
    if (last?.key === key) last.rows.push(row);
    else dispatchDays.push({ key, label: fileDate(row.dispatch_date), rows: [row] });
  }

  return (
    <div className="space-y-4">
      {filters?.length > 0 && (
        <FieldSelect value={filter} onChange={onFilter}>
          {filters.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </FieldSelect>
      )}

      {group === "operators" && (
        <section className="space-y-3">
          {machines?.length > 0 && onMachine && (
            <MachineSelect allowAll machines={machines} value={machineId} onChange={onMachine} />
          )}
          <ReportBrowser
            folders={shiftFolders}
            empty={`No signed operator reports for ${periodLabel}.`}
          />
        </section>
      )}

      {group === "dispatch" && (
        <section className="space-y-4">
          {dispatchDays.length === 0 ? (
            <p className="font-body text-sm text-ops-muted">No signed dispatch day for {periodLabel}.</p>
          ) : dispatchDays.map((day) => (
            <div key={day.key} className="space-y-2">
              <p className="font-ui text-sm font-semibold text-[#F5C518]">{day.label}</p>
              {day.rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenDispatch?.(row)}
                  className="w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl px-4 py-3"
                >
                  <p className="font-ui font-semibold text-ops-text">{tonnesLabel(screenedTonnes(row, siteConfig))} screened</p>
                  <p className="font-body text-xs text-ops-muted mt-1">{tonnesLabel(row.tonnes_on_floor)} on the floor · {row.trucks_dispatched ?? "—"} trucks</p>
                </button>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
