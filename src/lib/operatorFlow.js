/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Clock in", hint: "Start your time on site. This does not start a machine." },
  { id: "machines", label: "Choose a machine", hint: "Each machine has its own pre-start, meter, and report." },
  { id: "inspect", label: "Complete pre-start check", hint: "Check this machine. Then you can start it." },
  { id: "start", label: "Start machine", hint: "Name who is in the cab, photo the hour meter, then start." },
  { id: "run", label: "Machine running", hint: "Leave it running and choose the next machine, or finish this shift." },
  { id: "end", label: "Shift sent", hint: "This machine is with the supervisor. Choose another, or clock out when you leave site." },
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
