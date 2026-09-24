import { OPERATOR_FLOW_STEPS, operatorFlowIndex, operatorFlowMeta } from "../lib/operatorFlow.js";

/** One line of progress — the screen itself is the task, not a checklist of steps. */
export function OperatorFlowGuide({ currentStep }) {
  const meta = operatorFlowMeta(currentStep);
  const idx = operatorFlowIndex(currentStep);

  return (
    <div className="mb-4">
      <p className="font-logo text-xs tracking-wider text-[#F5C518]">
        {meta.stepNum ? `STEP ${meta.stepNum} OF ${meta.total}` : "NEEDS A FIX"}
      </p>
      <p className="font-logo text-3xl text-ops-text mt-1">{meta.title}</p>
      <p className="font-body text-lg text-ops-muted mt-2 leading-snug">{meta.hint}</p>
      <div className="flex gap-1.5 mt-3" aria-hidden>
        {OPERATOR_FLOW_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-[#F5C518]" : "bg-[#2A2A2A]"}`}
          />
        ))}
      </div>
    </div>
  );
}
