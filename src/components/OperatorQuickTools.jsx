import { Button } from "./ui/Button.jsx";

/** Secondary actions — below the main task so the day flow stays obvious */
export function OperatorQuickTools({ onReport, onFuel, onInbox, inboxCount = 0, disabled = false }) {
  return (
    <div className="mt-6 pt-4 border-t border-operator-border">
      <p className="font-ui text-sm font-semibold text-operator-muted mb-3">While you work</p>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onReport} disabled={disabled} className="flex-col gap-0.5 py-3 text-operator-ink">
          Report
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onFuel} disabled={disabled} className="flex-col gap-0.5 py-3">
          Diesel
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onInbox} disabled={disabled} className="relative flex-col gap-0.5 py-3 text-operator-ink">
          Inbox
          {inboxCount > 0 && (
            <span className="absolute top-1 right-1 bg-operator-accent text-operator-accent-fg text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {inboxCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
