import { OPERATOR_FLOW_STEPS, operatorFlowIndex, operatorFlowMeta } from "../lib/operatorFlow.js";

/**
 * One clear “where am I” block for field use — replaces the small step strip.
 */
export function OperatorFlowGuide({ currentStep, machineName, siteName }) {
  const meta = operatorFlowMeta(currentStep);
  const activeIdx = operatorFlowIndex(currentStep);
  const progress = activeIdx < 0 ? 0 : ((activeIdx + 1) / OPERATOR_FLOW_STEPS.length) * 100;

  return (
    <div className="operator-flow-guide mb-4">
      {(siteName || machineName) && (
        <p className="font-ui text-sm font-semibold text-operator-ink mb-2 truncate">
          {[siteName, machineName].filter(Boolean).join(" · ")}
        </p>
      )}

      {meta.stepNum != null && (
        <p className="font-ui text-xs font-medium text-operator-muted mb-1">
          Step {meta.stepNum} of {meta.total}
        </p>
      )}

      <div className="h-2 rounded-full bg-operator-border overflow-hidden mb-3" aria-hidden>
        <div
          className="h-full rounded-full bg-operator-accent transition-all duration-300"
          style={{ width: `${Math.max(progress, meta.stepNum ? 12 : 8)}%` }}
        />
      </div>

      <h2 className="font-ui text-xl font-bold text-operator-ink leading-tight">{meta.title}</h2>
      <p className="font-body text-base text-operator-muted mt-2 leading-relaxed">{meta.hint}</p>

      <ol className="flex flex-wrap gap-2 mt-4" aria-label="Shift steps">
        {OPERATOR_FLOW_STEPS.map((s, i) => {
          const done = activeIdx >= 0 && i < activeIdx;
          const active = s.id === currentStep;
          return (
            <li
              key={s.id}
              className={`font-ui text-xs font-medium px-2.5 py-1 rounded-full border ${
                active
                  ? "bg-operator-accent text-operator-accent-fg border-operator-accent"
                  : done
                    ? "bg-operator-success/15 text-operator-success border-operator-success/40"
                    : "bg-operator-surface text-operator-muted border-operator-border"
              }`}
            >
              {done ? "✓ " : ""}{s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
