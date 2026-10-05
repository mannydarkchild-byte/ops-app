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
        Tap a machine. Leave it running and choose the next one. Each machine gets its own report.
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
        const toneClass = tone === "running"
          ? "border-ops-green/50 text-ops-green"
          : tone === "stopped"
            ? "border-ops-red/50 text-ops-red"
            : tone === "blocked"
              ? "border-ops-red/40 text-ops-red"
              : tone === "ready"
                ? "border-[#F5C518]/50 text-[#F5C518]"
                : "border-ops-border text-ops-muted";
        return (
          <button
            key={machine.id}
            type="button"
            onClick={() => onPick(machine.id)}
            className={`w-full text-left rounded-2xl border bg-ops-card p-4 active:border-[#F5C518] ${toneClass}`}
          >
            <p className="font-logo text-2xl text-ops-text">{machine.name}</p>
            {machine.code && (
              <p className="font-body text-sm text-ops-muted mt-0.5">{machine.code}</p>
            )}
            <p className="font-ui text-sm mt-2">{label}</p>
          </button>
        );
      })}
    </div>
  );
}
