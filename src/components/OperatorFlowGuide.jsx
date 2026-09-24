import { OPERATOR_FLOW_STEPS, operatorFlowIndex, operatorFlowMeta } from "../lib/operatorFlow.js";

/** One line of progress — the screen itself is the task, not a checklist of steps. */
export function OperatorFlowGuide({ currentStep }) {
  const meta = operatorFlowMeta(currentStep);
  const idx = operatorFlowIndex(currentStep);

  return (
    <div className="mb-4">
      <p className="font-ui text-lg text-[#F2F0EA]/80">
        {meta.stepNum ? `Step ${meta.stepNum} of ${meta.total}` : "Needs a fix"}
      </p>
      <div className="flex gap-1.5 mt-2" aria-hidden>
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
