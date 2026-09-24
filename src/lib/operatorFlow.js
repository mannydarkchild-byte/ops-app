/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Your time", hint: "Clock in when you arrive. That is your working time — it does not start the machine." },
  { id: "inspect", label: "Pre-start", hint: "Check the machine, one item at a time. Then you can start it." },
  { id: "start", label: "The machine", hint: "Photo the hour meter, then start the machine. That is machine hours, not your time." },
  { id: "run", label: "Machine running", hint: "Stop the machine if it goes down. Finish day when you are done — that clocks you out too." },
  { id: "end", label: "Day sent", hint: "Machine hours went to your supervisor. You are clocked out." },
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
