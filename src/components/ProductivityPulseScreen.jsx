import { useEffect, useMemo, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { StockChartSvg } from "./StockChart.jsx";
import { MachineSelect } from "./DashboardKpi.jsx";
import { buildPulseSnapshot } from "../lib/productivityPulse.js";
import { refreshMachineActivity } from "../lib/machineStatus.js";
import { getBillingPeriod, getPrimaryMachine } from "../lib/utils.js";
import { formatDurationMinutes } from "../lib/shiftMetrics.js";
import { ownerForStopReasonMachine } from "../lib/stopReasons.js";
import { OwnerDowntimeChart, StopReasonChart } from "./PulseCharts.jsx";
import { FieldDate, FieldSelect } from "./ui/FieldSelect.jsx";
import { Button } from "./ui/Button.jsx";

function toDateInputValue(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayOption(value, todayValue) {
  const d = new Date(`${value}T12:00:00`);
  const label = d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  return value === todayValue ? `Today — ${label}` : label;
}

function recentDayValues(count = 90) {
  const today = new Date();
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    values.push(toDateInputValue(d));
  }
  return values;
}

/**
 * Live machine productivity — stock-style score for every role.
 * One machine at a time. Opens on the primary machine. Default window: today since midnight.
 */
export function ProductivityPulseScreen({
  onClose,
  embedded = false,
  children,
  initialMachineId,
  initialWindow = "today",
}) {
  const {
    user, activeSite, machines, shifts, events, getSettingsForSite, syncNow, refreshLocal,
  } = useOps();

  const siteId = user?.site_id || activeSite?.id;
  const siteConfig = useMemo(() => getSettingsForSite(siteId), [getSettingsForSite, siteId]);
  const siteMachines = useMemo(
    () => (machines || []).filter((m) => m.site_id === siteId && m.active !== false),
    [machines, siteId]
  );
  const [pickedId, setPickedId] = useState(initialMachineId || "");
  useEffect(() => {
    if (initialMachineId) setPickedId(initialMachineId);
  }, [initialMachineId]);
  const machine = useMemo(() => {
    const picked = siteMachines.find((m) => m.id === pickedId);
    if (picked) return picked;
    return getPrimaryMachine(machines, siteId, siteConfig);
  }, [siteMachines, pickedId, machines, siteId, siteConfig]);

  const [windowMode, setWindowMode] = useState(initialWindow === "cycle" || initialWindow === "history" ? initialWindow : "today");
  const [historyDay, setHistoryDay] = useState(() => toDateInputValue(new Date()));
  const [nowMs, setNowMs] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const refreshingRef = useRef(false);

  const handleRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError("");
    setNowMs(Date.now());
    try {
      if (machine?.id && navigator.onLine) {
        await refreshMachineActivity(machine.id);
      } else if (!navigator.onLine) {
        setRefreshError("Offline — showing what is already on this phone.");
      }
      await refreshLocal?.();
      setNowMs(Date.now());
      if (navigator.onLine) syncNow?.().catch(() => {});
    } catch (e) {
      setRefreshError(e?.message || "Could not refresh");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (windowMode !== "today") return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(id);
  }, [windowMode]);

  useEffect(() => {
    if (windowMode === "today") setNowMs(Date.now());
  }, [windowMode, historyDay]);

  const cycle = useMemo(
    () => getBillingPeriod(new Date(nowMs), siteConfig.billing_cycle_start_day),
    [nowMs, siteConfig.billing_cycle_start_day]
  );

  const pulse = useMemo(() => {
    if (!machine?.id) return null;
    return buildPulseSnapshot({
      machineId: machine.id,
      machine,
      shifts,
      events,
      siteSettings: siteConfig,
      window: windowMode === "cycle" ? "cycle" : windowMode === "history" ? "day" : "today",
      dayRef: windowMode === "history" ? historyDay : null,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      nowMs,
    });
  }, [machine, shifts, events, siteConfig, windowMode, historyDay, cycle.start, cycle.end, nowMs]);

  const isOperator = (user?.role || "").toLowerCase() === "operator";
  const todayValue = toDateInputValue(new Date());
  const dayChoices = useMemo(() => {
    const values = recentDayValues(90);
    if (historyDay && !values.includes(historyDay)) values.unshift(historyDay);
    return values;
  }, [historyDay]);

  const windowLabel = windowMode === "today"
    ? "Today since midnight"
    : windowMode === "history"
      ? new Date(`${historyDay}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })
      : cycle.label || "This cycle";

  const netLabel = !pulse
    ? "—"
    : pulse.endScore >= 0
      ? `+${formatDurationMinutes(pulse.endScore)}`
      : `−${formatDurationMinutes(Math.abs(pulse.endScore))}`;

  const body = (
    <div className={`space-y-4 ${embedded ? "" : "px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"}`}>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="min-w-0">
          <p className="font-ui text-sm font-semibold text-[#F5C518]">Machine productivity</p>
          <p className="font-ui text-xl font-semibold text-ops-text truncate">{machine?.name || "No machine"}</p>
          <p className="font-body text-sm text-ops-muted">{activeSite?.name || "Site"} · {windowLabel}</p>
        </div>
        <Button type="button" variant="secondary" size="md" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {refreshError && (
        <p className="font-body text-xs text-[#EF4444] -mt-2">{refreshError}</p>
      )}

      {siteMachines.length > 0 && (
        <MachineSelect
          machines={siteMachines}
          value={machine?.id || ""}
          onChange={setPickedId}
        />
      )}

      <label className="block">
        <span className="ops-field-label">Show</span>
        <FieldSelect value={windowMode} onChange={setWindowMode}>
          <option value="today">Today</option>
          <option value="history">A past day</option>
          <option value="cycle">This cycle</option>
        </FieldSelect>
      </label>

      {windowMode === "history" && (
        <div className="space-y-3">
          <label className="block">
            <span className="ops-field-label">Day</span>
            <FieldSelect value={historyDay} onChange={setHistoryDay}>
              {dayChoices.map((value) => (
                <option key={value} value={value}>
                  {formatDayOption(value, todayValue)}
                </option>
              ))}
            </FieldSelect>
          </label>
          <label className="block">
            <span className="ops-field-label">Or pick on the calendar</span>
            <FieldDate
              value={historyDay}
              onChange={(value) => value && setHistoryDay(value)}
              max={todayValue}
            />
          </label>
        </div>
      )}

      {pulse?.live && (
        <div className={`rounded-2xl border p-4 ${
          pulse?.runningNow
            ? "border-[#22C55E]/40 bg-[#22C55E]/10"
            : pulse?.openStop
              ? "border-[#EF4444]/40 bg-[#EF4444]/10"
              : "border-[#2A2A2A] bg-[#141414]"
        }`}>
          <p className="font-ui text-xs font-semibold text-[#F2F0EA]/50 mb-1">Now</p>
          <p className={`font-logo text-2xl ${
            pulse?.runningNow ? "text-[#22C55E]" : pulse?.openStop ? "text-[#EF4444]" : "text-[#F2F0EA]"
          }`}>
            {pulse?.runningNow
              ? "Running"
              : pulse?.openStop
                ? `Stopped — ${pulse.openStop.reason || "downtime"}`
                : "Idle"}
          </p>
          {pulse?.openStop && !isOperator && (
            <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">
              Owner: {pulse.currentOwner || ownerForStopReasonMachine(pulse.openStop.reason, machine, siteConfig)}
              {pulse.openStop.operatorName ? ` · ${pulse.openStop.operatorName}` : ""}
            </p>
          )}
          {pulse?.openStop && isOperator && pulse.openStop.operatorName && (
            <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">{pulse.openStop.operatorName}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <ScoreTile label="Running − stopped" value={netLabel} color="#F5C518" />
        <ScoreTile label="Time running" value={formatDurationMinutes(pulse?.runtimeMin || 0)} color="#22C55E" />
        <ScoreTile label="Time stopped" value={formatDurationMinutes(pulse?.downtimeMin || 0)} color="#EF4444" />
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-3">
        <p className="font-ui text-sm font-semibold text-ops-text px-1 mb-2">Running vs stopped</p>
        <StockChartSvg points={pulse?.points || []} />
      </div>

      {!isOperator && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
          <p className="font-ui text-sm font-semibold text-[#F5C518]">Downtime by owner</p>
          <OwnerDowntimeChart rows={pulse?.ownerTotals || []} />
        </div>
      )}

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
        <p className="font-ui text-sm font-semibold text-[#F5C518]">Stops</p>
        <StopReasonChart rows={pulse?.stopReasonTotals || []} />
      </div>
      {children}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="ops-sheet fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="shrink-0 border-b border-[#2A2A2A] bg-[#141414] px-4 py-3 flex items-center gap-3">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Back
        </Button>
        <p className="flex-1 min-w-0 font-ui font-semibold text-[#F5C518] truncate">Pulse</p>
      </div>
      <div className="flex-1 overflow-y-auto pt-4">{body}</div>
    </div>
  );
}

function ScoreTile({ label, value, color }) {
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 text-center">
      <p className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/45">{label}</p>
      <p className="font-logo text-lg mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

/** Shared CTA used on every role home. */
export function PulseOpenButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full bg-[#141414] border border-[#F5C518]/50 text-[#F5C518] py-4 rounded-xl font-logo font-bold text-sm tracking-wider ${className}`}
    >
      Pulse · live productivity
    </button>
  );
}
