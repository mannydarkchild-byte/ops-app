import { useEffect, useState } from "react";
import { SupervisorVerifySheet } from "./SupervisorVerifySheet.jsx";
import { Button } from "./ui/Button.jsx";
import { openShiftDailyReport } from "../services/reports.js";
import { verifyShift } from "../services/workflows.js";
import { getShiftStatus, localDayKey } from "../lib/utils.js";
import { SHIFT } from "../lib/constants.js";

function dayLabel(iso) {
  const key = localDayKey(iso);
  if (!key) return "Undated";
  const today = localDayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

export function WaitingShiftDays({ shifts = [], machineName, onOpen }) {
  const [openDay, setOpenDay] = useState(null);
  const days = [];
  for (const shift of shifts) {
    const key = localDayKey(shift.ended_at || shift.started_at) || "undated";
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(shift);
    else days.push({ key, label: dayLabel(shift.ended_at || shift.started_at), rows: [shift] });
  }
  if (!days.length) return null;

  return (
    <div className="space-y-2">
      <p className="font-ui text-sm font-semibold text-[#F5C518]">Waiting for your signature</p>
      {days.map((day) => {
        const open = openDay === day.key;
        return (
          <section key={day.key} className="bg-ops-card border border-ops-border rounded-2xl overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenDay(open ? null : day.key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[64px] text-left"
            >
              <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-body text-sm text-ops-muted">{day.rows.length}</span>
                <span className={`text-[#F5C518] text-lg transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && (
              <div className="border-t border-ops-border">
                {day.rows.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => onOpen(shift)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b border-ops-border last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block font-ui font-semibold text-ops-text truncate">{machineName(shift.machine_id)}</span>
                      <span className="block font-body text-sm text-ops-muted mt-0.5 truncate">
                        {shift.operator_name || "Operator"}
                        {shift.assigned_supervisor_name ? ` · for ${shift.assigned_supervisor_name}` : ""}
                      </span>
                    </span>
                    <span className="font-ui text-sm text-[#F5C518] shrink-0">Sign</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ShiftSignSheet({ shift, user, machines, reportContext, onClose, onDone }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signature, setSignature] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [fail, setFail] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHtml("");
    const machine = machines.find((item) => item.id === shift?.machine_id);
    openShiftDailyReport(shift, { ...reportContext, machine })
      .then((doc) => {
        if (!cancelled) setHtml(doc?.html || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not open this report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [shift, machines, reportContext]);

  const waiting = [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(getShiftStatus(shift));

  const sign = async () => {
    if (!signature) {
      setFail("Draw your signature before signing.");
      return;
    }
    setBusy(true);
    setFail("");
    try {
      if (!navigator.onLine) throw new Error("Sign-off needs a connection.");
      const saved = await verifyShift(shift, user, { action: "machine_sign", reason: null, signatureDataUrl: signature });
      await onDone?.(saved);
    } catch (err) {
      setFail(err.message || "Could not sign");
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    const note = reason.trim();
    if (!note) return;
    setBusy(true);
    setFail("");
    try {
      if (!navigator.onLine) throw new Error("Sending a report back needs a connection.");
      const saved = await verifyShift(shift, user, { action: "correct", reason: note, signatureDataUrl: null });
      setReasonOpen(false);
      await onDone?.(saved);
    } catch (err) {
      setFail(err.message || "Could not send back");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SupervisorVerifySheet
        title={machineTitle(machines, shift)}
        html={html}
        loading={loading}
        error={error}
        mode={waiting ? "sign" : "filed"}
        signature={signature}
        onSignature={setSignature}
        busy={busy}
        onSign={sign}
        onSendBack={() => { setFail(""); setReasonOpen(true); }}
        onClose={onClose}
        onRetry={() => {
          setError("");
          setLoading(true);
          const machine = machines.find((item) => item.id === shift?.machine_id);
          openShiftDailyReport(shift, { ...reportContext, machine })
            .then((doc) => setHtml(doc?.html || ""))
            .catch((err) => setError(err.message || "Could not open this report"))
            .finally(() => setLoading(false));
        }}
      />
      {fail && (
        <p className="fixed top-4 left-4 right-4 z-[80] bg-[#1a1212] border border-[#EF4444]/40 text-[#F2F0EA] rounded-2xl px-4 py-3 font-body text-sm">
          {fail}
        </p>
      )}
      {reasonOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
            <p className="font-ui font-semibold text-[#F5C518]">Send back</p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What should the operator fix?"
              rows={4}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
            />
            <Button className="w-full" size="lg" disabled={!reason.trim() || busy} onClick={sendBack}>
              Send back
            </Button>
            <Button className="w-full" size="lg" variant="secondary" onClick={() => setReasonOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function machineTitle(machines, shift) {
  const name = machines.find((item) => item.id === shift?.machine_id)?.name || "Daily report";
  return `${name} · ${shift?.operator_name || "Operator"}`;
}
