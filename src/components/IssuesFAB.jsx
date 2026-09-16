export function IssuesFAB({ inboxCount = 0, onReport, onFuel, onInbox, onExpense }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent z-40">
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
        <button type="button" onClick={onReport} className="relative bg-[#EF4444] text-white py-3.5 rounded-2xl font-logo font-bold text-xs tracking-wider active:scale-95 shadow-lg">
          ⚠ REPORT PROBLEM
        </button>
        <button type="button" onClick={onFuel} className="bg-[#F5C518] text-black py-3.5 rounded-2xl font-logo font-bold text-xs tracking-wider active:scale-95 shadow-lg">
          ⛽ LOG DIESEL
        </button>
        <button type="button" onClick={onInbox} className="relative bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA] py-3.5 rounded-2xl font-logo font-bold text-xs tracking-wider active:scale-95">
          💬 INBOX
          {inboxCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#F5C518] text-black text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {inboxCount}
            </span>
          )}
        </button>
        <button type="button" onClick={onExpense} className="bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA] py-3.5 rounded-2xl font-logo font-bold text-xs tracking-wider active:scale-95">
          💰 EXPENSE
        </button>
      </div>
    </div>
  );
}
