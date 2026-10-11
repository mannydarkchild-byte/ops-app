import { Button } from "./ui/Button.jsx";
import { OperatorDayTools } from "./OperatorDayTools.jsx";

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function OperatorWelcome({
  name,
  siteName,
  reportsAttention = 0,
  onReady,
  onMyReports,
  onPulse,
}) {
  const firstName = (name || "Operator").split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="operator-welcome">
      <p className="operator-welcome-kicker font-ui">{greeting()}</p>
      <h2 className="operator-welcome-name font-ui">{firstName}</h2>
      <p className="operator-welcome-date font-body">{today}</p>
      <p className="operator-welcome-copy font-body">
        Clock in once{siteName ? ` on ${siteName}` : ""}, then pick a machine.
      </p>
      <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" onClick={onReady}>
        Start my day
      </Button>
      <OperatorDayTools
        className="mt-3"
        onPulse={onPulse}
        onReports={onMyReports}
        reportsAttention={reportsAttention}
      />
    </div>
  );
}
