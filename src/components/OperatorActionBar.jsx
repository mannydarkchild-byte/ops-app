import { Button } from "./ui/Button.jsx";

/** Always-visible operator quick actions — no hidden menus */
export function OperatorActionBar({ onReport, onFuel, onInbox, inboxCount = 0, disabled = false }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <Button type="button" variant="danger" size="lg" onClick={onReport} disabled={disabled} className="flex-col gap-1 py-3">
        <span aria-hidden>⚠</span>
        <span>Report</span>
      </Button>
      <Button type="button" variant="primary" size="lg" onClick={onFuel} disabled={disabled} className="flex-col gap-1 py-3">
        <span aria-hidden>⛽</span>
        <span>Diesel</span>
      </Button>
      <Button type="button" variant="secondary" size="lg" onClick={onInbox} disabled={disabled} className="relative flex-col gap-1 py-3 border-ops-teal/40 text-ops-teal">
        <span aria-hidden>💬</span>
        <span>Inbox</span>
        {inboxCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-ops-gold text-ops-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {inboxCount}
          </span>
        )}
      </Button>
    </div>
  );
}
