import { Button } from "./ui/Button.jsx";

/** Secondary actions on the run screen — Diesel and Report stay one tap away. */
export function OperatorQuickTools({ onReport, onFuel, disabled = false }) {
  return (
    <div className="mt-4 pt-4 border-t border-ops-border">
      <p className="font-ui text-sm font-semibold text-ops-muted mb-3">While you work</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onReport} disabled={disabled} className="py-3">
          Report a problem
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onFuel} disabled={disabled} className="py-3">
          Log diesel
        </Button>
      </div>
    </div>
  );
}
