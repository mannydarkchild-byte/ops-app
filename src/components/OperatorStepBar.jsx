const STEPS = [
  { id: "clock", label: "Clock In", icon: "⏱" },
  { id: "inspect", label: "Pre-Start", icon: "🔍" },
  { id: "start", label: "Start", icon: "▶" },
  { id: "run", label: "Operate", icon: "●" },
  { id: "end", label: "End Day", icon: "📋" },
];

export function OperatorStepBar({ currentStep }) {
  const idx = STEPS.findIndex((s) => s.id === currentStep);
  return (
    <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={step.id}
            className={`flex-1 min-w-[56px] text-center py-2 px-1 rounded-lg border ${
              active ? "bg-ops-gold/12 border-ops-gold/50 text-ops-gold ring-1 ring-ops-gold/20"
                : done ? "bg-ops-green/10 border-ops-green/30 text-ops-green"
                  : "bg-ops-card border-ops-border text-ops-muted"
            }`}>
            <div className="text-base leading-none">{done ? "✓" : step.icon}</div>
            <div className="font-ui text-[11px] sm:text-xs font-medium mt-1">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}
