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

  const dispatchFolders = buildMonthFolders(dispatchRows, {
    noun: "day",
    plural: "days",
    dateOf: (row) => row.dispatch_date,
    fileOf: (row) => ({
      id: row.id,
      name: fileDate(row.dispatch_date),
      detail: `${tonnesLabel(screenedTonnes(row, siteConfig))} screened · ${tonnesLabel(row.tonnes_on_floor)} on the floor`,
      onOpen: () => onOpenDispatch?.(row),
    }),
  });

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
        <section className="space-y-3">
          <ReportBrowser
            folders={dispatchFolders}
            empty={`No signed dispatch day for ${periodLabel}.`}
          />
        </section>
      )}
    </div>
  );
}
