import { useEffect, useMemo, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { SHIFT } from "../lib/constants.js";
import { getShiftStatus } from "../lib/utils.js";
import {
  STANDARD_SITE_HOURS,
  hasOvertimeAck,
  overtimeHours,
  sessionHours,
  shouldAutoClockOut,
  shouldOfferEightHourChoice,
  shouldRemindSiteHours,
} from "../lib/timesheet.js";
import * as wf from "../services/workflows.js";
import { Button } from "./ui/Button.jsx";
import { AlertModal, Modal } from "./ui/Modal.jsx";

function seenKey(id) {
  return `ops-site-hours-seen:${id}`;
}

function readSeen(id) {
  if (!id) return false;
  try { return sessionStorage.getItem(seenKey(id)) === "1"; } catch { return false; }
}

function writeSeen(id) {
  if (!id) return;
  try { sessionStorage.setItem(seenKey(id), "1"); } catch {}
}

export function SiteHoursGuard() {
  const { user, workSession, shifts, refreshLocal } = useOps();
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ isOpen: false });
  const autoRef = useRef(false);
  const resumedRef = useRef(false);

  const hasOpenShift = useMemo(() => (
    (shifts || []).some((shift) => (
      shift.operator_id === user?.id && getShiftStatus(shift) === SHIFT.RUNNING
    ))
  ), [shifts, user?.id]);

  useEffect(() => {
    if (!workSession || workSession.status !== "active") return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [workSession?.id, workSession?.status]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      resumedRef.current = true;
      setNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    autoRef.current = false;
  }, [workSession?.id]);

  useEffect(() => {
    if (workSession?.status === "active" && sessionHours(workSession, nowMs) < STANDARD_SITE_HOURS) {
      writeSeen(workSession.id);
    }
  }, [workSession, nowMs]);

  useEffect(() => {
    if (!user || !workSession) return;
    if (!shouldAutoClockOut(workSession, { hasOpenShift }, nowMs)) {
      resumedRef.current = false;
      return;
    }
    const seen = readSeen(workSession.id);
    const resumed = resumedRef.current;
    resumedRef.current = false;
    if (seen && !resumed) return;
    if (autoRef.current) return;
    autoRef.current = true;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await wf.autoClockOutAfterStandardDay(user, workSession);
        if (cancelled) return;
        await refreshLocal();
        setNotice({
          isOpen: true,
          title: "Clocked out after 8 hours",
          message: "You were still clocked in after a standard 8-hour day, so OPS closed your time on site at 8 hours.",
          type: "info",
        });
      } catch {
        autoRef.current = false;
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, workSession, hasOpenShift, nowMs, refreshLocal]);

  const hours = workSession ? sessionHours(workSession, nowMs) : 0;
  const extra = workSession ? overtimeHours(workSession, nowMs) : 0;
  const remind = shouldRemindSiteHours(workSession, nowMs);
  const offerChoice = shouldOfferEightHourChoice(workSession, nowMs);
  const stayingLate = workSession?.status === "active" && hasOvertimeAck(workSession) && extra > 0;

  const clockOutNow = async () => {
    if (!workSession || busy) return;
    setBusy(true);
    try {
      await wf.clockOut(user, workSession, { note: "Clocked out after 8 hours" });
      await refreshLocal();
    } catch (error) {
      setNotice({
        isOpen: true,
        title: "Could not clock out",
        message: error.message || "Try again.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const stayOn = async () => {
    if (!workSession || busy) return;
    setBusy(true);
    try {
      writeSeen(workSession.id);
      await wf.ackStayOnOvertime(workSession);
      await refreshLocal();
    } catch (error) {
      setNotice({
        isOpen: true,
        title: "Could not keep you on site",
        message: error.message || "Try again.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const banner = (remind && !offerChoice && !stayingLate && (
    <div className="fixed left-0 right-0 z-40 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg px-4 py-3 rounded-xl bg-[#141414] border border-[#F5C518]/50 shadow-lg">
        <p className="font-ui text-sm font-semibold text-[#F5C518]">8-hour day is close</p>
        <p className="font-body text-sm text-ops-muted mt-1">
          You have been on site {hours.toFixed(1)} hours. Clock out when you leave, or extra time will count as overtime.
        </p>
      </div>
    </div>
  ));

  const overtimeBanner = stayingLate && (
    <div className="fixed left-0 right-0 z-40 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg px-4 py-3 rounded-xl bg-[#141414] border border-[#F97316]/50 shadow-lg">
        <p className="font-ui text-sm font-semibold text-[#F97316]">Overtime</p>
        <p className="font-body text-sm text-ops-muted mt-1">
          {hours.toFixed(1)} hours on site · {extra.toFixed(1)}h over the 8-hour day.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {banner}
      {overtimeBanner}
      {offerChoice && (
        <Modal title="8 hours on site" color="yellow" onClose={stayOn}>
          <p className="font-body text-sm text-ops-muted mb-4">
            {hasOpenShift
              ? "A machine is still open. Finish that shift, then clock out. If you stay, the extra time is overtime."
              : `A standard day is ${STANDARD_SITE_HOURS} hours. Clock out now, or stay on site as overtime.`}
          </p>
          <p className="font-ui text-sm text-ops-text mb-4">{hours.toFixed(1)} hours so far.</p>
          {hasOpenShift ? (
            <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" onClick={stayOn} disabled={busy}>
              Stay on (overtime)
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full min-h-14 text-lg"
                onClick={clockOutNow}
                disabled={busy}
              >
                Clock out now
              </Button>
              <Button type="button" variant="secondary" size="lg" className="w-full mt-2" onClick={stayOn} disabled={busy}>
                Stay on (overtime)
              </Button>
            </>
          )}
        </Modal>
      )}
      <AlertModal
        isOpen={notice.isOpen}
        title={notice.title}
        message={notice.message}
        type={notice.type || "info"}
        confirmText="OK"
        onConfirm={() => setNotice({ isOpen: false })}
      />
    </>
  );
}
