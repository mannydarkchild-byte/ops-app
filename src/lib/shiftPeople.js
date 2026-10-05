const USUAL_KEY = "ops-usual-operator";

/** Last cab name typed for this machine on this phone. */
export function usualOperatorName(machineId) {
  if (!machineId) return "";
  try {
    return localStorage.getItem(`${USUAL_KEY}:${machineId}`) || "";
  } catch {
    return "";
  }
}

export function rememberUsualOperator(machineId, name) {
  const trimmed = String(name || "").trim();
  if (!machineId || !trimmed) return;
  try {
    localStorage.setItem(`${USUAL_KEY}:${machineId}`, trimmed);
  } catch {}
}

/** Person in the cab. Saved on the shift as operator_name. */
export function machineOperatorName(shift) {
  return String(shift?.operator_name || "").trim();
}

/**
 * App user who filled the shift in.
 * Comes from the clock-in session, then the profile, then the shift name.
 */
export function recordedByName(shift, { profiles = [], workSessions = [] } = {}) {
  if (!shift?.operator_id) return machineOperatorName(shift);
  const started = new Date(shift.started_at || 0).getTime();
  const session = (workSessions || []).find((s) => {
    if (s.operator_id !== shift.operator_id || !s.clock_in) return false;
    const inn = new Date(s.clock_in).getTime();
    const out = s.clock_out ? new Date(s.clock_out).getTime() : Number.POSITIVE_INFINITY;
    return inn <= started && started <= out;
  });
  const profile = (profiles || []).find((p) => p.id === shift.operator_id);
  return String(session?.operator_name || profile?.name || "").trim() || machineOperatorName(shift);
}

export function shiftNameLines(shift, ctx = {}) {
  const machineOperator = machineOperatorName(shift);
  const recordedBy = recordedByName(shift, ctx);
  const left = machineOperator || recordedBy || "Operator";
  const right = recordedBy || machineOperator || "Operator";
  return {
    machineOperator: left,
    recordedBy: right,
    samePerson: left === right,
  };
}
