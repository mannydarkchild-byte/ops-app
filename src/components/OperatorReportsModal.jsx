import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { ReportPreviewModal } from "./ReportPreviewModal.jsx";
import { SHIFT } from "../lib/constants.js";
import { fmtDateShort, getBillingPeriod, getShiftStatus, inPeriod, dedupeShifts, getSiteSupervisors, sameOperatorId } from "../lib/utils.js";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
import { downloadShiftDailyReport, openShiftDailyReport, printTimesheetReport } from "../services/reports.js";
import { shiftNameLines } from "../lib/shiftPeople.js";
import { OperatorShiftTools } from "./OperatorShiftTools.jsx";
import { SupervisorWhatsAppButtons } from "./SupervisorPicker.jsx";
import { OperationsReportPanel } from "./OperationsReportPanel.jsx";
import { IconAlert, IconCalendar, IconCheck, IconClock, IconReports } from "./FieldIcons.jsx";
import { tonnesPerBucket } from "../lib/siteConfig.js";

export function reportBucket(shift) {
  const st = getShiftStatus(shift);
  if (st === SHIFT.VERIFIED) return "signed";
  if (st === SHIFT.MACHINE_SIGNED) return "with_site";
  if (st === SHIFT.CORRECTION_REQUIRED) return "sent_back";
  if (st === SHIFT.RUNNING) return "not_sent";
  return "pending";
}

const BUCKET_LABEL = {
  signed: "Signed off",
  with_site: "Signed — with site",
  pending: "Waiting for supervisor",
  sent_back: "Sent back — needs you",
  not_sent: "Not sent",
};

const BUCKET_COLOR = {
  signed: "text-[#22C55E]",
  with_site: "text-[#25D366]",
  pending: "text-[#F5C518]",
  sent_back: "text-[#F97316]",
  not_sent: "text-[#F2F0EA]/60",
};

export function buildOperatorReportDash({ user, shifts, workSessions, site, cycleStartDay = 26 }) {
  const period = getBillingPeriod(new Date(), cycleStartDay);
  const mine = dedupeShifts((shifts || []).filter((s) => sameOperatorId(s.operator_id, user?.id)));
  const cycleShifts = mine.filter((s) => inPeriod(s.started_at, period));
  const timesheet = summarizeTimesheet(
    buildTimesheetRows(workSessions, { siteId: user?.site_id || site?.id, period })
      .filter((s) => sameOperatorId(s.operator_id, user?.id))
  );
  const cycleSigned = cycleShifts.filter((s) => {
    const b = reportBucket(s);
    return b === "signed" || b === "with_site";
  });
  const cyclePending = cycleShifts.filter((s) => reportBucket(s) === "pending");
  const sentBack = cycleShifts.filter((s) => reportBucket(s) === "sent_back");
  return {
    period,
    yourTime: timesheet.hours,
    shifts: cycleShifts.length,
    signed: cycleSigned.length,
    pending: cyclePending.length + sentBack.length,
    hasSentBack: sentBack.length > 0,
  };
}

export function OperatorReportsDash({ dash, onOpen, className = "" }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`.trim()}>
      <DashTile label="Shifts" value={String(dash.shifts || 0)} onClick={() => onOpen?.("signed")} />
      <DashTile label="Your time" value={`${Number(dash.yourTime || 0).toFixed(1)}h`} onClick={() => onOpen?.("hours")} />
      <DashTile label="Signed" value={String(dash.signed || 0)} color="#22C55E" onClick={() => onOpen?.("signed")} />
      <DashTile
        label="Pending"
        value={String(dash.pending || 0)}
        hint={dash.hasSentBack ? "Includes sent back" : undefined}
        color="#F5C518"
        onClick={() => onOpen?.("pending")}
      />
    </div>
  );
}

function dayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  const today = new Date();
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(date, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

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
  siteSettings,
  siteDispatch = [],
  embedded = false,
}) {
  const [openSection, setOpenSection] = useState(null);
  const [openShiftId, setOpenShiftId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [reportMachineId, setReportMachineId] = useState("");

  const period = useMemo(
    () => getBillingPeriod(new Date(), cycleStartDay),
    [cycleStartDay]
  );

  const mine = useMemo(
    () => dedupeShifts((shifts || []).filter((s) => sameOperatorId(s.operator_id, user?.id)))
      .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)),
    [shifts, user?.id]
  );

  const groups = useMemo(() => {
    const need = [];
    const pending = [];
    const signed = [];
    for (const shift of mine) {
      const bucket = reportBucket(shift);
      if (bucket === "sent_back" || bucket === "not_sent") need.push(shift);
      else if (bucket === "pending") pending.push(shift);
      else signed.push(shift);
    }
    return { need, pending, signed };
  }, [mine]);

  const defaultSection = groups.need.length ? "need" : groups.pending.length ? "pending" : null;
  const section = openSection === null ? defaultSection : openSection;
  const toggleSection = (id) => setOpenSection(section === id ? "" : id);

  const machineName = (id) => machines.find((m) => m.id === id)?.name || "Machine";
  const supervisors = getSiteSupervisors(profiles, site?.id);
  const afterChange = () => { onChanged?.(); };

  const reportContext = useMemo(
    () => ({ events, inspections, fuelLogs, site, shifts, hourReadings, siteSettings, profiles, workSessions, siteDispatch }),
    [events, inspections, fuelLogs, site, shifts, hourReadings, siteSettings, profiles, workSessions, siteDispatch]
  );

  const viewReport = async (shift) => {
    setError("");
    setBusyId(shift.id);
    try {
      const machine = machines.find((m) => m.id === shift.machine_id);
      const doc = await openShiftDailyReport(shift, { ...reportContext, machine, hideBillable: true });
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
      await downloadShiftDailyReport(shift, { ...reportContext, machine, hideBillable: true });
    } catch (e) {
      setError(e.message || "Could not save report");
    } finally {
      setBusyId(null);
    }
  };

  const openHours = async () => {
    try {
      const sessions = (workSessions || []).filter((row) => sameOperatorId(row.operator_id, user?.id) && inPeriod(row.clock_in, period));
      const doc = await printTimesheetReport(sessions, period, site, machines);
      setPreview({ ...doc, title: `Timesheet · ${user?.name || "Operator"} · ${period.label}` });
    } catch (e) {
      setError(e.message || "Could not open timesheet");
    }
  };

  const shiftList = {
    machineName,
    openShiftId,
    onToggleShift: setOpenShiftId,
    busyId,
    profiles,
    workSessions,
    machines,
    site,
    user,
    supervisors,
    events,
    siteSettings,
    siteDispatch,
    factors: {
      excavator_bucket_tonnes: tonnesPerBucket(siteSettings?.excavator_bucket_tonnes),
      fel_bucket_tonnes: tonnesPerBucket(siteSettings?.fel_bucket_tonnes),
    },
    onView: viewReport,
    onSave: saveReport,
    onChanged: afterChange,
  };

  const content = (
    <>
      <p className="font-body text-sm text-ops-muted mb-3">{period.label}</p>

      {error && <p className="font-body text-base text-[#EF4444] mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <ReportKindCard
          id="need"
          title="Needs you"
          count={groups.need.length}
          accent="#F97316"
          icon={<IconAlert size={36} />}
          open={section === "need"}
          onToggle={toggleSection}
        />
        <ReportKindCard
          id="pending"
          title="Waiting"
          count={groups.pending.length}
          accent="#F5C518"
          icon={<IconClock size={36} />}
          open={section === "pending"}
          onToggle={toggleSection}
        />
        <ReportKindCard
          id="signed"
          title="Signed"
          count={groups.signed.length}
          accent="#22C55E"
          icon={<IconCheck size={36} />}
          open={section === "signed"}
          onToggle={toggleSection}
        />
        <ReportKindCard
          id="hours"
          title="Timesheet"
          accent="#F5C518"
          icon={<IconCalendar size={36} />}
          open={section === "hours"}
          onToggle={toggleSection}
        />
        <ReportKindCard
          id="operations"
          title="Operations"
          accent="#F5C518"
          icon={<IconReports size={36} />}
          open={section === "operations"}
          onToggle={toggleSection}
        />
      </div>

      {section === "need" ? (
        <div className="mt-3">
          <ShiftGroup shifts={groups.need} {...shiftList} />
        </div>
      ) : null}

      {section === "pending" ? (
        <div className="mt-3">
          <ShiftGroup shifts={groups.pending} {...shiftList} />
        </div>
      ) : null}

      {section === "signed" ? (
        <div className="mt-3">
          <p className="font-body text-sm text-[#F2F0EA]/55 mb-2">
            Open a signed report to correct the hours, buckets, trucks and tonnes.
          </p>
          <ShiftGroup shifts={groups.signed} {...shiftList} />
        </div>
      ) : null}

      {section === "hours" ? (
        <div className="mt-3">
          <button
            type="button"
            className="w-full py-3 rounded-xl border border-[#F5C518]/50 text-[#F5C518] font-ui font-semibold"
            onClick={openHours}
          >
            Open timesheet
          </button>
        </div>
      ) : null}

      {section === "operations" ? (
        <div className="mt-3">
          <OperationsReportPanel
            site={site}
            machines={machines}
            machineId={reportMachineId || machines[0]?.id || ""}
            onMachine={setReportMachineId}
            cycleStartDay={cycleStartDay}
            hideHeader
            hideBillable
            data={{
              shifts: mine,
              events,
              expenses: [],
              fuelLogs,
              inspections,
              siteSettings,
            }}
          />
        </div>
      ) : null}
    </>
  );

  const previewModal = preview && (
    <ReportPreviewModal
      html={preview.html}
      title={preview.title}
      sheets={preview.sheets}
      onClose={() => setPreview(null)}
    />
  );

  if (embedded) {
    return (
      <>
        {content}
        {previewModal}
      </>
    );
  }

  return (
    <>
      <Modal title="MY REPORTS" color="yellow" onClose={onClose}>
        {content}
      </Modal>
      {previewModal}
    </>
  );
}

function ReportKindCard({ id, title, count, accent, icon, open, onToggle }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onToggle(id)}
      className={`bg-[#0A0A0A] rounded-xl p-4 text-left min-h-[96px] border ${
        open ? "border-[#F5C518]" : "border-[#2A2A2A]"
      }`}
    >
      <span className="block" style={{ color: accent || "#F5C518" }}>{icon}</span>
      <p className="font-ui text-sm text-[#F2F0EA]/50 mt-2">{title}</p>
      {count != null ? (
        <p className="font-ui text-3xl mt-1" style={{ color: accent || "#F5C518" }}>{count}</p>
      ) : null}
    </button>
  );
}

function ShiftGroup({
  shifts,
  machineName,
  openShiftId,
  onToggleShift,
  busyId,
  profiles,
  workSessions,
  machines,
  site,
  user,
  supervisors,
  events,
  siteSettings,
  siteDispatch = [],
  factors = {},
  onView,
  onSave,
  onChanged,
}) {
  if (!shifts.length) {
    return <p className="font-body text-sm text-[#F2F0EA]/50 px-1 py-2">Nothing here.</p>;
  }

  const byMachine = new Map();
  for (const shift of shifts) {
    const name = machineName(shift.machine_id);
    if (!byMachine.has(name)) byMachine.set(name, []);
    byMachine.get(name).push(shift);
  }
  const machinesInList = [...byMachine.entries()];
  const showMachineHeads = machinesInList.length > 1;

  return machinesInList.map(([name, rows]) => {
    const days = [];
    for (const shift of rows) {
      const label = dayLabel(shift.started_at || shift.ended_at);
      const last = days[days.length - 1];
      if (last?.label === label) last.rows.push(shift);
      else days.push({ label, rows: [shift] });
    }
    return (
      <div key={name} className="space-y-2">
        {showMachineHeads ? <p className="font-ui text-xs font-semibold text-[#F2F0EA]/50 px-1">{name}</p> : null}
        {days.map((day) => (
          <div key={`${name}-${day.label}`} className="space-y-2">
            <p className="font-ui text-xs font-semibold text-[#F2F0EA]/40 px-1">{day.label}</p>
            {day.rows.map((shift) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                machineLabel={machineName(shift.machine_id)}
                hideMachine={showMachineHeads}
                open={openShiftId === shift.id}
                onToggle={() => onToggleShift(openShiftId === shift.id ? null : shift.id)}
                busy={busyId === shift.id}
                profiles={profiles}
                workSessions={workSessions}
                machines={machines}
                site={site}
                user={user}
                supervisors={supervisors}
                events={events}
                siteSettings={siteSettings}
                siteDispatch={siteDispatch}
                factors={factors}
                onView={onView}
                onSave={onSave}
                onChanged={onChanged}
              />
            ))}
          </div>
        ))}
      </div>
    );
  });
}

function ShiftRow({
  shift,
  machineLabel,
  hideMachine,
  open,
  onToggle,
  busy,
  profiles,
  workSessions,
  machines,
  site,
  user,
  supervisors,
  events,
  siteSettings,
  siteDispatch = [],
  factors = {},
  onView,
  onSave,
  onChanged,
}) {
  const bucket = reportBucket(shift);
  const canView = bucket !== "not_sent";
  const hours = Number(shift.hours_worked || 0).toFixed(1);

  return (
    <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-3 min-h-12 text-left"
      >
        <div className="min-w-0">
          <p className="font-ui font-semibold text-[#F2F0EA] truncate">
            {hideMachine ? shiftNameLines(shift, { profiles, workSessions }).machineOperator : machineLabel}
          </p>
          <p className={`font-body text-sm mt-0.5 ${BUCKET_COLOR[bucket]}`}>
            {BUCKET_LABEL[bucket]}
            {hideMachine ? "" : ` · ${fmtDateShort(shift.started_at)}`}
          </p>
        </div>
        <span className="flex items-center gap-2 shrink-0">
          <span className="font-ui text-[#F5C518]">{hours}h</span>
          <span className={`text-[#F5C518] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {canView ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onView(shift)}
                  disabled={busy}
                  className="bg-[#F5C518] text-black py-3 rounded-xl font-ui font-semibold disabled:opacity-50"
                >
                  {busy ? "Opening…" : "View report"}
                </button>
                <button
                  type="button"
                  onClick={() => onSave(shift)}
                  disabled={busy}
                  className="border border-[#2A2A2A] text-[#F2F0EA] py-3 rounded-xl font-ui disabled:opacity-50"
                >
                  Save copy
                </button>
              </div>
              {bucket === "pending" && (
                <SupervisorWhatsAppButtons
                  supervisors={supervisors}
                  shift={shift}
                  machine={machines.find((m) => m.id === shift.machine_id)}
                  site={site}
                  assignedSupervisorId={shift.assigned_supervisor_id}
                  events={events}
                  siteSettings={siteSettings}
                  label="Resend on WhatsApp"
                />
              )}
              <OperatorShiftTools shift={shift} user={user} supervisors={supervisors} site={site} siteDispatch={siteDispatch} factors={factors} onDone={onChanged} />
            </>
          ) : (
            <>
              <p className="font-body text-sm text-[#F2F0EA]/55">
                Finish the day to send this, or remove it if it is blocking you.
              </p>
              <OperatorShiftTools shift={shift} user={user} supervisors={supervisors} site={site} siteDispatch={siteDispatch} factors={factors} onDone={onChanged} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DashTile({ label, value, hint, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-left"
    >
      <p className="font-ui text-sm tracking-wider text-[#F2F0EA]/50">{label}</p>
      <p className="font-ui text-3xl mt-1" style={{ color: color || "#F5C518" }}>{value}</p>
      {hint ? <p className="font-body text-sm text-[#F2F0EA]/50 mt-1">{hint}</p> : null}
    </button>
  );
}
