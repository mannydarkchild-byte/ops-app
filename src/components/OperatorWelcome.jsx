import { IconReports } from "./FieldIcons.jsx";
import { Button } from "./ui/Button.jsx";

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function OperatorWelcome({
  name,
  machineName,
  siteName,
  reportsAttention = 0,
  onReady,
  onMyReports,
}) {
  const firstName = (name || "Operator").split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="operator-welcome">
      <p className="operator-welcome-kicker font-logo">{greeting()}</p>
      <h2 className="operator-welcome-name font-logo">{firstName}</h2>
      <p className="operator-welcome-date font-body">{today}</p>
      <p className="operator-welcome-copy font-body">
        {machineName ? `${machineName} is yours today.` : "Your machine is ready."}
        {siteName ? ` ${siteName}.` : ""} Clock in when you are on site — that starts your time, not the machine.
      </p>
      <Button type="button" variant="primary" size="lg" className="w-full font-logo operator-welcome-go" onClick={onReady}>
        Start my day
      </Button>
      <button
        type="button"
        onClick={onMyReports}
        className="operator-welcome-reports font-logo"
      >
        <IconReports /> My reports
        {reportsAttention > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F5C518] text-black text-xs font-bold flex items-center justify-center">
            {reportsAttention}
          </span>
        )}
      </button>
    </div>
  );
}
