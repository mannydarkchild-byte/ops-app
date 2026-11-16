import { useCallback, useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { ActivityFeed } from "./ActivityFeed.jsx";
import { ProductivityPulseScreen } from "./ProductivityPulseScreen.jsx";

/** Same Pulse for every role: cycle window, owner charts, and activity for the selected machine. */
export function RolePulse({ initialMachineId, onClose }) {
  const { events, fuelLogs, issues, issueMessages, machines, user } = useOps();
  const [ctx, setCtx] = useState(null);
  const onContextChange = useCallback((next) => setCtx(next), []);
  const siteMachines = useMemo(
    () => (machines || []).filter((machine) => machine.site_id === user?.site_id && machine.active !== false),
    [machines, user?.site_id]
  );
  const windowLabel = ctx?.windowMode === "cycle"
    ? "this cycle"
    : ctx?.windowMode === "history"
      ? "that day"
      : "today";

  return (
    <ProductivityPulseScreen
      embedded={!onClose}
      onClose={onClose}
      initialMachineId={initialMachineId}
      initialWindow="cycle"
      onContextChange={onContextChange}
    >
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 mt-4">
        <p className="font-ui text-sm font-semibold text-ops-text mb-1">Recent activity</p>
        <p className="font-body text-xs text-ops-muted mb-2">
          {ctx?.machineName ? `${ctx.machineName} · ${windowLabel}` : "Select a machine"}
        </p>
        <ActivityFeed
          events={events}
          fuelLogs={fuelLogs}
          issues={issues}
          issueMessages={issueMessages}
          machines={siteMachines}
          siteId={user?.site_id}
          machineId={ctx?.machineId || null}
          fromMs={ctx?.fromMs}
          toMs={ctx?.toMs}
        />
      </div>
    </ProductivityPulseScreen>
  );
}
