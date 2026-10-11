import { useMemo } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { ActivityFeed } from "./ActivityFeed.jsx";
import { ProductivityPulseScreen } from "./ProductivityPulseScreen.jsx";

/** Same Pulse for every role: cycle window, owner charts, and today's activity. */
export function RolePulse({ initialMachineId, onClose }) {
  const { events, fuelLogs, issues, issueMessages, machines, user } = useOps();
  const siteMachines = useMemo(
    () => (machines || []).filter((machine) => machine.site_id === user?.site_id && machine.active !== false),
    [machines, user?.site_id]
  );

  return (
    <ProductivityPulseScreen
      embedded={!onClose}
      onClose={onClose}
      initialMachineId={initialMachineId}
      initialWindow="cycle"
    >
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 mt-4">
        <p className="font-ui text-sm font-semibold text-ops-text mb-2">What happened today</p>
        <ActivityFeed
          events={events}
          fuelLogs={fuelLogs}
          issues={issues}
          issueMessages={issueMessages}
          machines={siteMachines}
          siteId={user?.site_id}
        />
      </div>
    </ProductivityPulseScreen>
  );
}
