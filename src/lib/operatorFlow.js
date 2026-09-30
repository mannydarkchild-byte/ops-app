/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Clock in", hint: "Start your time on site. This does not start the machine." },
  { id: "inspect", label: "Complete pre-start check", hint: "Check the machine. Then you can start it." },
  { id: "start", label: "Start machine", hint: "Photo the hour meter, then start the machine." },
  { id: "run", label: "Machine running", hint: "Stop the machine if it goes down. Finish shift when the day is done." },
  { id: "end", label: "Finish shift", hint: "Sent for sign-off. Clock out if you are still on site." },
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
