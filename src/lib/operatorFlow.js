/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Clock in", hint: "Starts your time. Does not start a machine." },
  { id: "machines", label: "Choose a machine", hint: "Each machine gets its own report." },
  { id: "inspect", label: "Pre-start check", hint: "Walk the machine, then start it." },
  { id: "start", label: "Start machine", hint: "Name the operator, photo the meter, then start." },
  { id: "run", label: "Machine running", hint: "Stop if it stands. Finish when this machine is done." },
  { id: "end", label: "Shift sent", hint: "Pick the next machine, or clock out when you leave." },
];

export function operatorFlowIndex(stepId) {
  if (stepId === "correct") return -1;
  const i = OPERATOR_FLOW_STEPS.findIndex((s) => s.id === stepId);
  return i >= 0 ? i : 0;
}

export function operatorFlowMeta(stepId) {
  if (stepId === "correct") {
    return {
      stepNum: null,
      total: OPERATOR_FLOW_STEPS.length,
      title: "Fix shift",
      hint: "Supervisor sent this back. Correct it below, then you can start again.",
    };
  }
  const idx = operatorFlowIndex(stepId);
  const step = OPERATOR_FLOW_STEPS[idx] || OPERATOR_FLOW_STEPS[0];
  return {
    stepNum: idx + 1,
    total: OPERATOR_FLOW_STEPS.length,
    title: step.label,
    hint: step.hint,
  };
}
