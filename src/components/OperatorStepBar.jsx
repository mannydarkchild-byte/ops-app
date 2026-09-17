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
              active ? "bg-[#F5C518]/15 border-[#F5C518] text-[#F5C518]"
                : done ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]"
                  : "bg-[#141414] border-[#2A2A2A] text-[#F2F0EA]/30"
            }`}>
            <div className="text-base leading-none">{done ? "✓" : step.icon}</div>
            <div className="font-logo text-[10px] sm:text-xs tracking-wider mt-1">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}
