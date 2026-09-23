import { Button } from "./ui/Button.jsx";

/** Secondary actions — below the main task so the day flow stays obvious */
export function OperatorQuickTools({ onReport, onFuel, onInbox, inboxCount = 0, disabled = false }) {
  return (
    <div className="mt-6 pt-4 border-t border-ops-border">
      <p className="font-ui text-sm font-semibold text-ops-muted mb-3">While you work</p>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onReport} disabled={disabled} className="py-3">
          Report
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onFuel} disabled={disabled} className="py-3">
          Diesel
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onInbox} disabled={disabled} className="relative py-3">
          Inbox
          {inboxCount > 0 && (
            <span className="absolute top-1 right-1 bg-ops-gold text-ops-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {inboxCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
