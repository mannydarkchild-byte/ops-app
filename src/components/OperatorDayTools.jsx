import { Button } from "./ui/Button.jsx";
import { IconPulse, IconReports } from "./FieldIcons.jsx";

/** Pulse and Reports on the page — not in the hamburger. */
export function OperatorDayTools({ onPulse, onReports, reportsAttention = 0, className = "" }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`.trim()}>
      <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onPulse}>
        <IconPulse /> Pulse
      </Button>
      <Button type="button" variant="secondary" size="lg" className="w-full relative" onClick={onReports}>
        <IconReports /> Reports
        {reportsAttention > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-ops-gold text-ops-ink text-xs font-bold flex items-center justify-center">
            {reportsAttention > 9 ? "9+" : reportsAttention}
          </span>
        )}
      </Button>
    </div>
  );
}
