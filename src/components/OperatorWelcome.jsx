function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function OperatorGreeting({ name }) {
  const firstName = (name || "Operator").split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="operator-welcome">
      <h2 className="operator-welcome-name font-ui">{greeting()} {firstName}</h2>
      <p className="operator-welcome-date font-body">{today}</p>
    </div>
  );
}
