import { SHIFT } from "../lib/constants.js";
import { getShiftStatus, hasCompletedPrestart, shiftBelongsToWorkSession } from "../lib/utils.js";
import { prestartItemsForMachine } from "../lib/siteConfig.js";

function statusForMachine(machine, { shifts, user, workSession, inspections, siteConfig }) {
  const running = (shifts || []).find(
    (s) => s.machine_id === machine.id && getShiftStatus(s) === SHIFT.RUNNING
  );
  if (running && running.operator_id && running.operator_id !== user?.id) {
    return {
      label: `${running.operator_name || "Someone else"} is running this`,
      tone: "blocked",
    };
  }
  if (running && running.operator_id === user?.id) {
    if (workSession && shiftBelongsToWorkSession(running, workSession, user.id)) {
      return {
        label: `Running · ${running.operator_name || "in the cab"}`,
        tone: "running",
      };
    }
    return { label: "Earlier shift still open", tone: "stopped" };
  }
  const items = prestartItemsForMachine(siteConfig, machine);
  const ready = hasCompletedPrestart(
    inspections, user?.id, machine.id, workSession?.clock_in, items.length
  );
  if (ready) return { label: "Pre-start done — start it", tone: "ready" };
  return { label: "Needs a pre-start", tone: "idle" };
}

export function OperatorMachineBoard({
  machines,
  shifts,
  events,
  user,
  workSession,
  inspections,
  siteConfig,
  onPick,
}) {
  if (!machines.length) {
    return (
      <p className="font-body text-base text-ops-muted">
        No machines are on this site yet. An admin adds them under More, then Machines.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-body text-base text-ops-muted">
        Choose a machine. Leave it running and pick the next one. Each machine gets its own report.
      </p>
      {machines.map((machine) => {
        const status = statusForMachine(machine, {
          shifts, user, workSession, inspections, siteConfig,
        });
        const running = (shifts || []).find(
          (s) => s.machine_id === machine.id
            && getShiftStatus(s) === SHIFT.RUNNING
            && shiftBelongsToWorkSession(s, workSession, user?.id)
        );
        const stopped = running && (events || []).some(
          (e) => e.shift_id === running.id && e.type === "STOP" && e.status === "open"
        );
        const label = stopped ? `Stopped · ${running.operator_name || "in the cab"}` : status.label;
        const tone = stopped ? "stopped" : status.tone;
        const toneClass = tone === "running" ? "ops-list-row-running"
          : tone === "stopped" ? "ops-list-row-stopped"
            : tone === "blocked" ? "ops-list-row-blocked"
              : tone === "ready" ? "ops-list-row-ready"
                : "";

        return (
          <button
            key={machine.id}
            type="button"
            onClick={() => onPick(machine.id)}
            className={`ops-list-row ${toneClass}`}
            aria-label={`${machine.name}. ${label}. ${tone === "blocked" ? "Open for details." : "Select."}`}
          >
            <div className="ops-list-row-body">
              <p className="ops-list-row-title">{machine.name}</p>
              {machine.code && (
                <p className="font-body text-sm text-ops-muted mt-0.5">{machine.code}</p>
              )}
              <p className="ops-list-row-meta">{label}</p>
            </div>
            <span className="ops-list-row-chevron" aria-hidden>›</span>
          </button>
        );
      })}
    </div>
  );
}
