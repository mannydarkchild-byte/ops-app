import { operatorFlowMeta } from "../lib/operatorFlow.js";

/** Page title only — the screen is the task. */
export function OperatorFlowGuide({ currentStep }) {
  const meta = operatorFlowMeta(currentStep);

  return (
    <h1 className="font-ui text-2xl font-semibold text-ops-text mb-3">
      {meta.title}
    </h1>
  );
}
