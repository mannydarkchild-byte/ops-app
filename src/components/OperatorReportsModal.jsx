import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { ReportPreviewModal } from "./ReportPreviewModal.jsx";
import { SHIFT } from "../lib/constants.js";
import { fmtDateShort, getBillingPeriod, getShiftStatus, inPeriod } from "../lib/utils.js";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
import { downloadShiftDailyReport, openShiftDailyReport } from "../services/reports.js";
import { ShiftPhotoFix } from "./ShiftPhotoFix.jsx";
import { OperatorShiftTools } from "./OperatorShiftTools.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "signed", label: "Signed off" },
  { id: "pending", label: "Pending" },
  { id: "sent_back", label: "Sent back" },
  { id: "not_sent", label: "Not sent" },
];

export function reportBucket(shift) {
  const st = getShiftStatus(shift);
  if (st === SHIFT.VERIFIED) return "signed";
  if (st === SHIFT.CORRECTION_REQUIRED) return "sent_back";
  if (st === SHIFT.RUNNING) return "not_sent";
  return "pending";
}

const BUCKET_LABEL = {
  signed: "Signed off",
  pending: "Waiting for supervisor",
  sent_back: "Sent back — needs you",
  not_sent: "Not sent",
};

const BUCKET_COLOR = {
  signed: "text-[#22C55E]",
  pending: "text-[#F5C518]",
  sent_back: "text-[#F97316]",
  not_sent: "text-[#F2F0EA]/60",
};

export function OperatorReportsModal({
  onClose,
  onChanged,
  user,
  shifts,
  workSessions,
  machines,
  events,
  inspections,
  fuelLogs,
  hourReadings = [],
  profiles = [],
  site,
  cycleStartDay = 26,
}) {
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const period = useMemo(
    () => getBillingPeriod(new Date(), cycleStartDay),
    [cycleStartDay]
  );

  const mine = useMemo(
    () => (shifts || [])
      .filter((s) => s.operator_id === user?.id)
      .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)),
    [shifts, user?.id]
  );

  const cycleShifts = useMemo(
    () => mine.filter((s) => inPeriod(s.started_at, period)),
    [mine, period]
  );

  const timesheet = useMemo(
    () => summarizeTimesheet(
      buildTimesheetRows(workSessions, { siteId: user?.site_id || site?.id, period })
        .filter((s) => s.operator_id === user?.id)
    ),
    [workSessions, user?.id, user?.site_id, site?.id, period]
  );

  const dash = useMemo(() => {
    const signed = cycleShifts.filter((s) => reportBucket(s) === "signed");
    const pending = cycleShifts.filter((s) => reportBucket(s) === "pending");
    const sentBack = cycleShifts.filter((s) => reportBucket(s) === "sent_back");
    const notSent = cycleShifts.filter((s) => reportBucket(s) === "not_sent");
    const meterHours = signed.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0);
    return {
      signed: signed.length,
      pending: pending.length,
      sentBack: sentBack.length,
      notSent: notSent.length,
      meterHours,
      yourTime: timesheet.hours,
    };
  }, [cycleShifts, timesheet.hours]);

  const list = useMemo(
    () => (filter === "all" ? mine : mine.filter((s) => reportBucket(s) === filter)),
    [mine, filter]
  );

  const machineName = (id) => machines.find((m) => m.id === id)?.name || "Machine";
  const supervisors = (profiles || []).filter((p) => String(p.role || "").toLowerCase() === "supervisor" && p.active !== false);
  const afterChange = () => { onChanged?.(); };

  const reportContext = useMemo(
    () => ({ events, inspections, fuelLogs, site, shifts, hourReadings }),
    [events, inspections, fuelLogs, site, shifts, hourReadings]
  );

  const viewReport = async (shift) => {
    setError("");
    setBusyId(shift.id);
    try {
      const machine = machines.find((m) => m.id === shift.machine_id);
      const doc = await openShiftDailyReport(shift, { ...reportContext, machine });
      setPreview(doc);
    } catch (e) {
      setError(e.message || "Could not open report");
    } finally {
      setBusyId(null);
    }
  };

  const saveReport = async (shift) => {
    setError("");
    setBusyId(shift.id);
    try {
      const machine = machines.find((m) => m.id === shift.machine_id);
      await downloadShiftDailyReport(shift, { ...reportContext, machine });
    } catch (e) {
      setError(e.message || "Could not save report");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Modal title="MY REPORTS" color="yellow" onClose={onClose}>
        <p className="font-body text-base text-ops-muted mb-4">
          Same daily report your supervisor signs. This cycle: {period.label}.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <DashTile label="Your time" value={`${dash.yourTime.toFixed(1)}h`} hint="Clock-in to clock-out" />
          <DashTile label="Machine hours" value={`${dash.meterHours.toFixed(1)}h`} hint="Signed meter hours" />
          <DashTile label="Signed off" value={String(dash.signed)} hint="Supervisor signed" color="#22C55E" />
          <DashTile label="Pending" value={String(dash.pending + dash.sentBack)} hint={dash.sentBack ? `${dash.sentBack} sent back` : "Waiting for supervisor"} color="#F5C518" />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2.5 rounded-lg font-logo text-xs min-h-[44px] ${
                filter === f.id ? "bg-[#F5C518] text-black" : "bg-[#0A0A0A] border border-[#2A2A2A] text-[#F2F0EA]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <p className="font-body text-base text-[#EF4444] mb-3">{error}</p>}

        {list.length === 0 ? (
          <p className="font-body text-base text-[#F2F0EA]/50 text-center py-8">
            No reports in this list yet.
          </p>
        ) : (
          <div className="space-y-3">
            {list.map((shift) => {
              const bucket = reportBucket(shift);
              const canView = bucket !== "not_sent";
              return (
                <div key={shift.id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-logo text-base text-[#F2F0EA]">{machineName(shift.machine_id)}</p>
                      <p className="font-body text-sm text-[#F2F0EA]/60 mt-0.5">{fmtDateShort(shift.started_at)}</p>
                    </div>
                    <p className="font-logo text-lg text-[#F5C518] shrink-0">
                      {Number(shift.hours_worked || 0).toFixed(1)}h
                    </p>
                  </div>
                  <p className={`font-logo text-sm mb-3 ${BUCKET_COLOR[bucket]}`}>{BUCKET_LABEL[bucket]}</p>
                  {canView ? (
                    <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => viewReport(shift)}
                        disabled={busyId === shift.id}
                        className="bg-[#F5C518] text-black py-3.5 rounded-xl font-logo text-sm font-bold disabled:opacity-50"
                      >
                        {busyId === shift.id ? "OPENING…" : "VIEW REPORT"}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReport(shift)}
                        disabled={busyId === shift.id}
                        className="border border-[#2A2A2A] text-[#F2F0EA] py-3.5 rounded-xl font-logo text-sm disabled:opacity-50"
                      >
                        SAVE COPY
                      </button>
                    </div>
                    <ShiftPhotoFix shift={shift} user={user} onDone={() => setBusyId(null)} />
                    <OperatorShiftTools shift={shift} user={user} supervisors={supervisors} onDone={afterChange} />
                    </>
                  ) : (
                    <>
                    <p className="font-body text-base text-[#F2F0EA]/55 mb-2">
                      Finish the day to send this report to your supervisor. Or remove it if this leftover is blocking you.
                    </p>
                    <OperatorShiftTools shift={shift} user={user} supervisors={supervisors} onDone={afterChange} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {preview && (
        <ReportPreviewModal
          html={preview.html}
          title={preview.title}
          sheets={preview.sheets}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

function DashTile({ label, value, hint, color }) {
  return (
    <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4">
      <p className="font-logo text-sm tracking-wider text-[#F2F0EA]/50">{label}</p>
      <p className="font-logo text-3xl mt-1" style={{ color: color || "#F5C518" }}>{value}</p>
      <p className="font-body text-base text-[#F2F0EA]/50 mt-1">{hint}</p>
    </div>
  );
}
