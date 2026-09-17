/** Always-visible operator quick actions — no hidden menus */
export function OperatorActionBar({ onReport, onFuel, onInbox, inboxCount = 0, disabled = false }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <button type="button" onClick={onReport} disabled={disabled}
        className="bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold text-sm tracking-wider active:scale-95 disabled:opacity-40 shadow-lg">
        ⚠ REPORT
      </button>
      <button type="button" onClick={onFuel} disabled={disabled}
        className="bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold text-sm tracking-wider active:scale-95 disabled:opacity-40 shadow-lg">
        ⛽ DIESEL
      </button>
      <button type="button" onClick={onInbox} disabled={disabled}
        className="relative bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold text-sm tracking-wider active:scale-95 disabled:opacity-40 shadow-lg">
        💬 INBOX
        {inboxCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#F5C518] text-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {inboxCount}
          </span>
        )}
      </button>
    </div>
  );
}
