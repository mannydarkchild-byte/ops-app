import { OPERATOR_FLOW_STEPS, operatorFlowIndex, operatorFlowMeta } from "../lib/operatorFlow.js";

/**
 * Daily shift board — one obvious step, progress you can feel.
 */
export function OperatorFlowGuide({ currentStep, machineName, siteName, operatorName }) {
  const meta = operatorFlowMeta(currentStep);
  const activeIdx = operatorFlowIndex(currentStep);
  const greeting = operatorName ? `Hey ${operatorName.split(/\s+/)[0]}` : "Today’s shift";

  return (
    <section className="operator-shift-board mb-4 overflow-hidden rounded-3xl border border-ops-gold/35 bg-ops-card">
      <div className="bg-gradient-to-br from-ops-gold/25 via-ops-card to-ops-black px-4 pt-4 pb-3">
        <p className="font-ui text-sm font-medium text-ops-gold">{greeting}</p>
        <h2 className="font-ui text-2xl font-bold text-ops-text leading-tight mt-1">{meta.title}</h2>
        <p className="font-body text-base text-ops-text/80 mt-2 leading-snug">{meta.hint}</p>
        {(siteName || machineName) && (
          <p className="font-ui text-sm text-ops-muted mt-3 truncate">
            {[machineName, siteName].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <ol className="px-3 py-3 space-y-1" aria-label="Today’s steps">
        {OPERATOR_FLOW_STEPS.map((s, i) => {
          const done = activeIdx >= 0 && i < activeIdx;
          const active = s.id === currentStep;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                active ? "bg-ops-gold text-ops-black" : ""
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-ui text-sm font-bold ${
                  active
                    ? "bg-ops-black text-ops-gold"
                    : done
                      ? "bg-ops-green text-ops-black"
                      : "bg-ops-black text-ops-muted border border-ops-border"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`font-ui text-base font-semibold ${active ? "" : done ? "text-ops-green" : "text-ops-muted"}`}>
                {s.label}
              </span>
              {active && <span className="ml-auto font-ui text-xs font-bold uppercase tracking-wide">Now</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
