/** Operator day flow — one path, plain language */
export const OPERATOR_FLOW_STEPS = [
  { id: "clock", label: "Clock in", hint: "Pick your supervisor and clock in on site." },
  { id: "inspect", label: "Pre-start", hint: "Work through the safety checklist." },
  { id: "start", label: "Start machine", hint: "Photo of the opening hour meter, then start." },
  { id: "run", label: "Run shift", hint: "Operate the machine. Use Stop if it goes down; End day when finished." },
  { id: "end", label: "Submit", hint: "Closing meter photo and send to supervisor." },
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
