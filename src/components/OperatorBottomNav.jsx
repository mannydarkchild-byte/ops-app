const TABS = [
  { id: "today", label: "Today" },
  { id: "messages", label: "Messages" },
  { id: "more", label: "More" },
];

/** Three places only — same idea as field-service apps (Home / messages / more). */
export function OperatorBottomNav({ active, onChange, messageCount = 0 }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#3A3A3A] bg-[#0A0A0A] mobile-safe-bottom" aria-label="Main menu">
      <div className="max-w-2xl mx-auto grid grid-cols-3">
        {TABS.map((tab) => {
          const on = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative py-3 font-ui text-base font-semibold ${on ? "text-[#F5C518]" : "text-[#F2F0EA]/55"}`}
            >
              {tab.label}
              {tab.id === "messages" && messageCount > 0 && (
                <span className="ml-1 inline-flex min-w-[20px] h-5 px-1 rounded-full bg-[#EF4444] text-white text-xs items-center justify-center align-middle">
                  {messageCount > 9 ? "9+" : messageCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
