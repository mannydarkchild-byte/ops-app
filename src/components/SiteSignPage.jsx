import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { ownerForStopReason } from "../lib/stopReasons.js";
import { formatDurationMinutes } from "../lib/shiftMetrics.js";

/**
 * Public shift sign-off for the site supervisor (Berlington).
 * Opened from a WhatsApp link — no login, no app. Token is the auth.
 * URL: /?sign=<shiftId>&token=<siteToken>
 */
export function SiteSignPage({ shiftId, token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [mode, setMode] = useState(null); // agree | dispute
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // agreed | disputed

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("site_shift_summary", {
          p_shift_id: shiftId,
          p_token: token,
        });
        if (error) throw new Error(error.message);
        if (!cancelled) setState({ loading: false, error: "", data });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message || "Could not open this shift", data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [shiftId, token]);

  const submit = async () => {
    if (mode === "agree" && !name.trim()) return;
    if (mode === "dispute" && !reason.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("site_sign_shift", {
        p_shift_id: shiftId,
        p_token: token,
        p_name: mode === "agree" ? name.trim() : (name.trim() || "Site supervisor"),
        p_phone: phone.trim() || null,
        p_action: mode,
        p_reason: mode === "dispute" ? reason.trim() : null,
      });
      if (error) throw new Error(error.message);
      setDone(mode === "agree" ? "agreed" : "disputed");
    } catch (e) {
      setState((s) => ({ ...s, error: e.message || "Could not record your decision" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0C0C0C] text-[#F2F0EA] flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <p className="font-logo text-4xl text-[#F5C518] tracking-widest">OPS</p>
          <p className="font-body text-sm text-[#F2F0EA]/60 mt-1">Shift sign-off — site supervisor</p>
        </div>

        {state.loading && <p className="text-center text-sm text-[#F2F0EA]/60 py-12">Loading this shift…</p>}

        {!state.loading && state.error && !state.data && (
          <div className="bg-[#1a1212] border border-[#EF4444]/40 rounded-2xl p-6 text-center">
            <p className="font-logo text-[#EF4444] mb-2">LINK PROBLEM</p>
            <p className="text-sm text-[#F2F0EA]/70">{state.error}</p>
          </div>
        )}

        {!state.loading && state.data && !done && (
          <ShiftSummary data={state.data} />
        )}

        {!state.loading && state.data && !done && !mode && (
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => setMode("agree")} className="w-full bg-[#22C55E] text-black py-4 rounded-xl font-logo font-bold">
              Agree — site side
            </button>
            <button type="button" onClick={() => setMode("dispute")} className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold">
              Dispute — send back
            </button>
          </div>
        )}

        {!state.loading && state.data && !done && mode === "agree" && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
            <p className="font-logo text-sm text-[#22C55E]">Agreeing locks this shift as billable.</p>
            <label className="block">
              <span className="font-logo text-[10px] tracking-wider text-[#F5C518]">YOUR NAME (REQUIRED)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. J. van Wyk" className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
            </label>
            <label className="block">
              <span className="font-logo text-[10px] tracking-wider text-[#F5C518]">PHONE (OPTIONAL)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 082…" className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
            </label>
            {state.error && <p className="text-sm text-[#EF4444]">{state.error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setMode(null); setState((s) => ({ ...s, error: "" })); }} className="flex-1 border border-[#2A2A2A] py-3 rounded-xl font-logo text-sm">Back</button>
              <button type="button" onClick={submit} disabled={busy || !name.trim()} className="flex-1 bg-[#22C55E] text-black py-3 rounded-xl font-logo font-bold disabled:opacity-40">
                {busy ? "Signing…" : "Confirm agree"}
              </button>
            </div>
          </div>
        )}

        {!state.loading && state.data && !done && mode === "dispute" && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
            <p className="font-logo text-sm text-[#F5C518]">Say what is wrong — it goes straight back to the machine supervisor.</p>
            <label className="block">
              <span className="font-logo text-[10px] tracking-wider text-[#F5C518]">YOUR NAME (OPTIONAL)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. J. van Wyk" className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
            </label>
            <label className="block">
              <span className="font-logo text-[10px] tracking-wider text-[#F5C518]">WHAT IS WRONG (REQUIRED)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. That 2h was a hose, not waiting trucks" className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-sm" />
            </label>
            {state.error && <p className="text-sm text-[#EF4444]">{state.error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setMode(null); setState((s) => ({ ...s, error: "" })); }} className="flex-1 border border-[#2A2A2A] py-3 rounded-xl font-logo text-sm">Back</button>
              <button type="button" onClick={submit} disabled={busy || !reason.trim()} className="flex-1 bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold disabled:opacity-40">
                {busy ? "Sending…" : "Send back"}
              </button>
            </div>
          </div>
        )}

        {done === "agreed" && (
          <div className="bg-[#22C55E]/10 border border-[#22C55E]/40 rounded-2xl p-6 text-center">
            <p className="font-logo text-[#22C55E] text-lg mb-2">SIGNED — THANK YOU</p>
            <p className="text-sm text-[#F2F0EA]/70">Both sides agree. This shift is locked and billable. You can close this page.</p>
          </div>
        )}
        {done === "disputed" && (
          <div className="bg-[#F5C518]/10 border border-[#F5C518]/40 rounded-2xl p-6 text-center">
            <p className="font-logo text-[#F5C518] text-lg mb-2">SENT BACK</p>
            <p className="text-sm text-[#F2F0EA]/70">The machine supervisor will see your reason and fix it. You can close this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftSummary({ data }) {
  const shift = data.shift || {};
  const settingsLike = {
    stop_reasons: Array.isArray(data.stop_reasons) ? data.stop_reasons : [],
    contractor_name: data.contractor_name,
    equipment_owner_name: data.owner_name,
    client_site_name: data.client_name,
  };
  const stops = Array.isArray(data.stops) ? data.stops : [];
  const when = shift.started_at ? new Date(shift.started_at).toLocaleString() : "";
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <div>
        <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">SHIFT AWAITING YOUR SIGN</p>
        <p className="font-logo text-lg">{data.machine_name} · {shift.operator_name}</p>
        <p className="text-sm text-[#F2F0EA]/60">{when}{data.site_name ? ` · ${data.site_name}` : ""}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#0A0A0A] rounded-xl p-3">
          <p className="font-logo text-[10px] text-[#F2F0EA]/50">MACHINE</p>
          <p className="font-logo text-xl">{Number(shift.hours_worked || 0).toFixed(1)}h</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-3">
          <p className="font-logo text-[10px] text-[#F2F0EA]/50">METER</p>
          <p className="font-logo text-xl">{shift.start_hour_meter ?? "—"}→{shift.end_hour_meter ?? "—"}</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-3">
          <p className="font-logo text-[10px] text-[#F2F0EA]/50">DIESEL</p>
          <p className="font-logo text-xl">{Number(data.fuel_litres || 0).toFixed(0)}L</p>
        </div>
      </div>
      <div>
        <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider mb-2">STOPS — REASON + WHO CARRIES IT</p>
        {stops.length === 0 && <p className="text-sm text-[#F2F0EA]/60">No stops recorded this shift.</p>}
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div key={i} className="flex justify-between gap-2 bg-[#0A0A0A] rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{s.reason || "Stop"}</p>
                <p className="text-xs text-[#F2F0EA]/50">{ownerForStopReason(s.reason, settingsLike)}</p>
              </div>
              <p className="font-logo text-sm text-[#EF4444] shrink-0">{formatDurationMinutes(Number(s.minutes || 0))}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-[#F2F0EA]/50">
        Machine side signed by {shift.machine_signature_name || shift.supervisor_signature_name || "supervisor"} · version {shift.shift_version || 1} locked.
        Agreeing means both sides accept these hours and stop owners.
      </p>
    </div>
  );
}
