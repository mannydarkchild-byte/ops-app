import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AlertModal } from "./ui/Modal.jsx";
import { ReportPreviewModal } from "./ReportPreviewModal.jsx";
import { SupervisorPicker } from "./SupervisorPicker.jsx";
import { getBillingPeriod, getDatePresets, getSiteSupervisors, hoursBetween, inPeriod, localDayKey, suggestSupervisor } from "../lib/utils.js";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
import { printTimesheetReport } from "../services/reports.js";
import * as wf from "../services/workflows.js";

const FILTERS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "cycle", label: "This cycle" },
  { id: "all", label: "All" },
];

function periodFor(filter, cycleStart) {
  const now = new Date();
  if (filter === "all") return null;
  if (filter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: "Today" };
  }
  if (filter === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now, label: "This week" };
  }
  if (filter === "cycle") return getBillingPeriod(now, cycleStart);
  return getDatePresets(cycleStart).find((preset) => preset.id === filter) || null;
}

export function WorkHoursPanel({ variant = "full" }) {
  const { user, activeSite, profiles, workSessions, workSession, getSettingsForSite, refreshLocal } = useOps();
  const [supervisorId, setSupervisorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("cycle");
  const [alert, setAlert] = useState({ isOpen: false });
  const [preview, setPreview] = useState(null);
  const siteId = user?.site_id || activeSite?.id;
  const site = activeSite?.id ? activeSite : { id: siteId, name: activeSite?.name || "Site" };
  const cycleStart = getSettingsForSite(siteId).billing_cycle_start_day;
  const supervisors = useMemo(() => getSiteSupervisors(profiles, siteId), [profiles, siteId]);
  const suggested = useMemo(() => suggestSupervisor(supervisors, new Date()), [supervisors]);
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const period = useMemo(() => periodFor(filter, cycleStart), [filter, cycleStart]);
  const mine = useMemo(() => {
    const rows = buildTimesheetRows(workSessions, { siteId, period }).filter((row) => row.operator_id === user?.id);
    if (filter !== "today") return rows;
    const today = localDayKey();
    return rows.filter((row) => localDayKey(row.clock_in) === today);
  }, [workSessions, siteId, period, user?.id, filter]);
  const summary = useMemo(() => summarizeTimesheet(mine), [mine]);

  const clockIn = async () => {
    const id = supervisorId || suggested?.id;
    const supervisor = supervisors.find((person) => person.id === id);
    setBusy(true);
    try {
      await wf.clockIn(user, null, site, { assignedSupervisor: supervisor });
      await refreshLocal();
      showAlert("Clocked in", "Your time on site has started.", "success");
    } catch (e) {
      showAlert("Could not clock in", e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const clockOut = async () => {
    setBusy(true);
    try {
      await wf.clockOut(user, workSession, { note: "Clocked out" });
      await refreshLocal();
      showAlert("Clocked out", "Your time on site is closed.", "success");
    } catch (e) {
      showAlert("Could not clock out", e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const openReport = async () => {
    setBusy(true);
    try {
      const sessions = (workSessions || []).filter((row) => row.operator_id === user?.id && (!period || inPeriod(row.clock_in, period)));
      const doc = await printTimesheetReport(sessions, period, site, []);
      setPreview({ ...doc, title: `${user?.name || "My"} hours · ${period?.label || "All time"}` });
    } catch (e) {
      showAlert("Could not open report", e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const clockCard = (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">TIME ON SITE</p>
      {workSession ? (
        <>
          <p className="font-body text-sm text-[#F2F0EA]">
            Clocked in at {new Date(workSession.clock_in).toLocaleTimeString()} · {hoursBetween(workSession.clock_in).toFixed(1)}h
          </p>
          <button type="button" disabled={busy} onClick={clockOut} className="w-full py-3 rounded-full bg-[#F5C518] text-black font-logo disabled:opacity-40">
            {busy ? "Clocking out…" : "Clock out"}
          </button>
        </>
      ) : (
        <>
          <p className="font-body text-sm text-[#F2F0EA]/70">Clock in when you arrive and clock out when you leave. This is your time at work.</p>
          <SupervisorPicker
            supervisors={supervisors}
            value={supervisorId || suggested?.id || ""}
            onChange={setSupervisorId}
            suggestedId={suggested?.id || null}
            title="WHO IS ON DUTY?"
          />
          <button type="button" disabled={busy || !(supervisorId || suggested?.id)} onClick={clockIn} className="w-full py-3 rounded-full bg-[#22C55E] text-black font-logo disabled:opacity-40">
            {busy ? "Clocking in…" : "Clock in"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <AlertModal {...alert} confirmText="OK" />
      {variant === "clock" ? clockCard : (
        <div className="space-y-4">
          {clockCard}
          <div>
            <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">MY HOURS</p>
            <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">One report of your clock-in and clock-out times.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${filter === item.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
            <p className="font-logo text-[10px] text-[#F2F0EA]/45">{period?.label || "All time"}</p>
            <p className="font-logo text-3xl text-[#F5C518]">{summary.hours.toFixed(1)}h</p>
            <p className="font-body text-xs text-[#F2F0EA]/50">{summary.sessions} clock-in{summary.sessions === 1 ? "" : "s"}</p>
          </div>
          <button type="button" disabled={busy} onClick={openReport} className="w-full py-3 rounded-full border border-[#F5C518]/50 text-[#F5C518] font-logo disabled:opacity-40">
            Open my hours report
          </button>
          {mine.length === 0 ? (
            <p className="font-body text-sm text-[#F2F0EA]/40">No clock-ins in this period.</p>
          ) : mine.map((row) => (
            <div key={row.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
              <p className="font-logo text-[#F2F0EA]">{row.dateLabel}</p>
              <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">{row.inLabel} – {row.outLabel} · {row.hours.toFixed(1)}h · {row.statusLabel}</p>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <ReportPreviewModal html={preview.html} title={preview.title} sheets={preview.sheets} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
