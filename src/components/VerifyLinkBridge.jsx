import { useEffect, useMemo, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { loadShiftFromVerifyLink, normalizeShiftLinkId } from "../lib/machineStatus.js";
import { openShiftDailyReport } from "../services/reports.js";
import { SupervisorVerifySheet } from "./SupervisorVerifySheet.jsx";

/** Admin / manager: open the operator WhatsApp daily-report link. */
export function VerifyLinkBridge({ verifyShiftId, verifyToken, onConsumed }) {
  const {
    user, shifts, events, inspections, fuelLogs, expenses, hourReadings, workSessions,
    profiles, siteDispatch, machines, activeSite, getSettingsForSite,
  } = useOps();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const opened = useRef(null);
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;
  const siteConfig = useMemo(
    () => getSettingsForSite(activeSite?.id),
    [getSettingsForSite, activeSite?.id]
  );
  const reportContext = useMemo(() => ({
    events, inspections, fuelLogs, expenses, site: activeSite, shifts, hourReadings,
    siteSettings: siteConfig, profiles, workSessions, siteDispatch,
  }), [events, inspections, fuelLogs, expenses, activeSite, shifts, hourReadings, siteConfig, profiles, workSessions, siteDispatch]);

  useEffect(() => {
    if (!verifyShiftId) {
      opened.current = null;
      return undefined;
    }
    if (opened.current === verifyShiftId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");

    const run = async () => {
      let shift = null;
      let lastError = "";
      for (let i = 0; i < 4 && !cancelled && !shift; i += 1) {
        try {
          const id = normalizeShiftLinkId(verifyShiftId);
          shift = (shiftsRef.current || []).find((s) => s.id === id)
            || await loadShiftFromVerifyLink(id, verifyToken, user);
        } catch (e) {
          lastError = e.message || "";
        }
        if (shift) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * (i + 1)));
      }
      if (cancelled) return;
      if (!shift) {
        setError(lastError || "Could not load this report from the server. Tap Try again.");
        setLoading(false);
        return;
      }
      opened.current = verifyShiftId;
      const machine = machines.find((m) => m.id === shift.machine_id);
      try {
        setDoc(await openShiftDailyReport(shift, { ...reportContext, machine }));
      } catch (e) {
        setError(e.message || "Could not open this report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [verifyShiftId, verifyToken, retry]);

  if (!verifyShiftId || (!loading && !error && !doc)) return null;

  return (
    <SupervisorVerifySheet
      title={doc?.title || "Daily report"}
      html={doc?.html}
      loading={loading}
      error={error}
      mode="filed"
      onClose={() => {
        setDoc(null);
        setError("");
        onConsumed?.();
      }}
      onRetry={() => {
        opened.current = null;
        setDoc(null);
        setError("");
        setRetry((n) => n + 1);
      }}
    />
  );
}
