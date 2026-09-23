/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Clock in", hint: "Choose your supervisor, then clock in. That’s how the day starts." },
  { id: "inspect", label: "Pre-start", hint: "Walk the checklist. Every item needs a status before the machine starts." },
  { id: "start", label: "Start machine", hint: "Snap the opening meter, type the hours, then start." },
  { id: "run", label: "You’re running", hint: "Keep working. Stop if the machine goes down. End day when you’re finished." },
  { id: "end", label: "Send the shift", hint: "Closing meter photo, then send it to your supervisor." },
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
