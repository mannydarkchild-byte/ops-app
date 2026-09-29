import { useEffect, useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { StockChartSvg } from "./StockChart.jsx";
import { buildPulseSnapshot } from "../lib/productivityPulse.js";
import { getBillingPeriod, getPrimaryMachine } from "../lib/utils.js";
import { formatDurationMinutes } from "../lib/shiftMetrics.js";
import { ownerForStopReason } from "../lib/stopReasons.js";

function toDateInputValue(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Live machine productivity — stock-style score for every role.
 * Primary machine only. Default window: today since midnight. History via day / cycle.
 */
export function ProductivityPulseScreen({ onClose, embedded = false }) {
  const {
    user, activeSite, machines, shifts, events, getSettingsForSite, syncNow,
  } = useOps();

  const siteId = user?.site_id || activeSite?.id;
  const siteConfig = useMemo(() => getSettingsForSite(siteId), [getSettingsForSite, siteId]);
  const machine = useMemo(
    () => getPrimaryMachine(machines, siteId, siteConfig),
    [machines, siteId, siteConfig]
  );

  const [windowMode, setWindowMode] = useState("today");
  const [historyDay, setHistoryDay] = useState(() => toDateInputValue(new Date()));
  const [nowMs, setNowMs] = useState(Date.now());

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
      shifts,
      events,
      siteSettings: siteConfig,
      window: windowMode === "cycle" ? "cycle" : windowMode === "history" ? "day" : "today",
      dayRef: windowMode === "history" ? historyDay : null,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      nowMs,
    });
  }, [machine?.id, shifts, events, siteConfig, windowMode, historyDay, cycle.start, cycle.end, nowMs]);

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
          <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">MACHINE PRODUCTIVITY</p>
          <p className="font-logo text-xl text-[#F2F0EA] truncate">{machine?.name || "No machine"}</p>
          <p className="font-body text-sm text-[#F2F0EA]/55">{activeSite?.name || "Site"} · {windowLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => { setNowMs(Date.now()); syncNow?.(); }}
          className="shrink-0 px-3 py-2 rounded-xl border border-[#2A2A2A] font-logo text-xs text-[#F2F0EA]/80"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-1">
        {[
          { id: "today", label: "Today" },
          { id: "history", label: "History" },
          { id: "cycle", label: "Cycle" },
        ].map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setWindowMode(w.id)}
            className={`flex-1 py-3 rounded-xl font-logo text-sm ${
              windowMode === w.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {windowMode === "history" && (
        <label className="block">
          <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/45">Day</span>
          <input
            type="date"
            value={historyDay}
            max={toDateInputValue(new Date())}
            onChange={(e) => setHistoryDay(e.target.value)}
            className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA] font-logo text-sm"
          />
        </label>
      )}

      {pulse?.live && (
        <div className={`rounded-2xl border p-4 ${
          pulse?.runningNow
            ? "border-[#22C55E]/40 bg-[#22C55E]/10"
            : pulse?.openStop
              ? "border-[#EF4444]/40 bg-[#EF4444]/10"
              : "border-[#2A2A2A] bg-[#141414]"
        }`}>
          <p className="font-logo text-xs tracking-wider text-[#F2F0EA]/50 mb-1">NOW</p>
          <p className={`font-logo text-2xl ${
            pulse?.runningNow ? "text-[#22C55E]" : pulse?.openStop ? "text-[#EF4444]" : "text-[#F2F0EA]"
          }`}>
            {pulse?.runningNow
              ? "Running"
              : pulse?.openStop
                ? `Stopped — ${pulse.openStop.reason || "downtime"}`
                : "Idle"}
          </p>
          {pulse?.openStop && (
            <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">
              Owner: {pulse.currentOwner || ownerForStopReason(pulse.openStop.reason, siteConfig)}
              {pulse.openStop.operatorName ? ` · ${pulse.openStop.operatorName}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <ScoreTile label="Net score" value={netLabel} color="#F5C518" />
        <ScoreTile label="Runtime" value={formatDurationMinutes(pulse?.runtimeMin || 0)} color="#22C55E" />
        <ScoreTile label="Downtime" value={formatDurationMinutes(pulse?.downtimeMin || 0)} color="#EF4444" />
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-3">
        <p className="font-body text-xs text-[#F2F0EA]/50 mb-2 px-1">
          Climbs while the machine runs. Falls while it is stopped. Gold tip is where this window stands.
        </p>
        <StockChartSvg points={pulse?.points || []} />
      </div>

      {pulse?.ownerTotals?.length > 0 && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
          <p className="font-logo text-xs tracking-wider text-[#F5C518]">DOWNTIME BY OWNER</p>
          {pulse.ownerTotals.map(([owner, min]) => (
            <div key={owner} className="flex justify-between gap-3 font-body text-sm text-[#F2F0EA]">
              <span className="truncate">{owner}</span>
              <span className="font-logo text-[#EF4444] shrink-0">{formatDurationMinutes(min)}</span>
            </div>
          ))}
        </div>
      )}

      {pulse?.periods?.filter((p) => p.state === "stopped" && p.minutes >= 1).length > 0 && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
          <p className="font-logo text-xs tracking-wider text-[#F5C518]">STOPS</p>
          {pulse.periods
            .filter((p) => p.state === "stopped" && p.minutes >= 1)
            .slice(-12)
            .reverse()
            .map((p) => (
              <div key={`${p.start}-${p.reason}`} className="border-b border-[#2A2A2A] pb-2 last:border-0 last:pb-0">
                <p className="font-logo text-sm text-[#F2F0EA]">{p.reason || "Stop"}</p>
                <p className="font-body text-xs text-[#F2F0EA]/55 mt-0.5">
                  {ownerForStopReason(p.reason, siteConfig)} · {formatDurationMinutes(p.minutes)} ·{" "}
                  {new Date(p.start).toLocaleString("en-ZA", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                  {p.operatorName ? ` · ${p.operatorName}` : ""}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="ops-sheet fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col">
      <div className="shrink-0 border-b border-[#2A2A2A] bg-[#141414] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-4 py-3 bg-[#2A2A2A] text-[#F2F0EA] rounded-xl font-logo"
        >
          Back
        </button>
        <p className="flex-1 min-w-0 font-logo text-[#F5C518] truncate">Pulse</p>
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
