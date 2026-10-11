import { SHIFT } from "../lib/constants.js";
import { getShiftStatus, hasCompletedPrestart, shiftBelongsToWorkSession } from "../lib/utils.js";
import { prestartItemsForMachine } from "../lib/siteConfig.js";
import { FieldSelect } from "./ui/FieldSelect.jsx";

const SHORT_STATUS = {
  running: "Running",
  stopped: "Stopped",
  blocked: "In use",
  ready: "Ready",
  idle: "Needs pre-start",
};

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

function optionLabel(machine, status) {
  const short = SHORT_STATUS[status.tone] || status.label;
  return machine.code ? `${machine.name} (${machine.code}) — ${short}` : `${machine.name} — ${short}`;
}

export function OperatorMachineBoard({
  machines,
  shifts,
  events,
  user,
  workSession,
  inspections,
  siteConfig,
  value,
  onPick,
}) {
  if (!machines.length) {
    return (
      <p className="font-body text-base text-ops-muted">
        No machines are on this site yet. An admin adds them under More, then Machines.
      </p>
    );
  }

  const selected = machines.find((m) => m.id === value) || null;
  const selectedStatus = selected
    ? statusForMachine(selected, { shifts, user, workSession, inspections, siteConfig })
    : null;

  return (
    <label className="block mb-4">
      <span className="ops-field-label">Machine</span>
      <FieldSelect
        value={value || ""}
        onChange={onPick}
        placeholder="Choose a machine…"
      >
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
          const tone = stopped ? "stopped" : status.tone;
          return (
            <option key={machine.id} value={machine.id}>
              {optionLabel(machine, { ...status, tone })}
            </option>
          );
        })}
      </FieldSelect>
      {selectedStatus && (
        <p className="font-body text-sm text-ops-muted mt-2">{selectedStatus.label}</p>
      )}
    </label>
  );
}
