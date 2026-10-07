import { operatorFlowMeta } from "../lib/operatorFlow.js";

/** Single title line — the screen itself is the task. */
export function OperatorFlowGuide({ currentStep }) {
  const meta = operatorFlowMeta(currentStep);

  return (
    <div className="mb-4">
      <p className="font-ui text-sm font-semibold text-[#F5C518]">
        {meta.stepNum ? `Step ${meta.stepNum} of ${meta.total}` : "Needs a fix"}
      </p>
      <p className="font-ui text-2xl font-semibold text-ops-text mt-1">{meta.title}</p>
      <p className="font-body text-base text-ops-muted mt-1.5 leading-snug">{meta.hint}</p>
    </div>
  );
}
