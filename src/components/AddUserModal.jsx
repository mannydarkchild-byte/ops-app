import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { ROLES } from "../lib/constants.js";
import { CREATABLE_ROLES, adminCreateUser } from "../services/users.js";

export function AddUserModal({ onClose, sites, machines, defaultSiteId, onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES.OPERATOR);
  const [siteId, setSiteId] = useState(defaultSiteId || sites[0]?.id || "");
  const [machineId, setMachineId] = useState("");
  const [phone, setPhone] = useState("");
  const [shiftBand, setShiftBand] = useState("any");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const siteMachines = machines.filter((m) => m.site_id === siteId);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await adminCreateUser({
        email, password, name, role, siteId,
        machineId: role === ROLES.OPERATOR ? machineId : null,
        phone: role === ROLES.SUPERVISOR ? phone : null,
        shiftBand: role === ROLES.SUPERVISOR ? shiftBand : null,
      });
      await onDone?.(result);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="ADD USER" color="blue" onClose={onClose}>
      <FormSection step={1} title="Account" description="Login credentials for the new user." accent="#00A4A6">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
          className="w-full bg-[#0A0A0A] border p-3 rounded mb-2 text-[#F2F0EA]" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="w-full bg-[#0A0A0A] border p-3 rounded mb-2 text-[#F2F0EA]" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 characters)"
          className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]" />
      </FormSection>

      <FormSection step={2} title="Role & site" description="What access this person has." accent="#00A4A6">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded mb-2 text-[#F2F0EA]">
          {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setMachineId(""); }} className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]">
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {role === ROLES.OPERATOR && (
          <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded mt-2 text-[#F2F0EA]">
            <option value="">Default machine…</option>
            {siteMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        {role === ROLES.SUPERVISOR && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp phone"
              className="bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA] text-sm" />
            <select value={shiftBand} onChange={(e) => setShiftBand(e.target.value)} className="bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA] text-sm">
              <option value="day">Day shift</option>
              <option value="night">Night shift</option>
              <option value="any">All shifts</option>
            </select>
          </div>
        )}
      </FormSection>

      {error && <p className="text-[#EF4444] text-sm mb-3">{error}</p>}

      <button type="button" onClick={submit} disabled={busy || !email || !password || !name}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40">
        {busy ? "CREATING…" : "CREATE USER"}
      </button>
      <p className="font-body text-[10px] text-[#F2F0EA]/40 mt-3 text-center">
        If email confirmation is enabled in Supabase, the user must confirm before signing in.
      </p>
    </Modal>
  );
}
