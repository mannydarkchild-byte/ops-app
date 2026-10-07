import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { ROLES } from "../../lib/constants.js";

const MANAGEABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.ADMIN];

/** Edit one person in a sheet — list stays clean. */
export function EditUserSheet({
  profile,
  sites,
  machines,
  currentUserId,
  onClose,
  onSaveRole,
  onSaveFields,
  onDeactivate,
  onReactivate,
}) {
  const [role, setRole] = useState(profile?.role || ROLES.OPERATOR);
  const [siteId, setSiteId] = useState(profile?.site_id || "");
  const [machineId, setMachineId] = useState(profile?.machine_id || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [shiftBand, setShiftBand] = useState(profile?.shift_band || "any");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setRole(profile.role || ROLES.OPERATOR);
    setSiteId(profile.site_id || "");
    setMachineId(profile.machine_id || "");
    setPhone(profile.phone || "");
    setShiftBand(profile.shift_band || "any");
  }, [profile]);

  if (!profile) return null;

  const inactive = profile.active === false;
  const siteMachines = machines.filter((m) => m.site_id === siteId);

  const save = async () => {
    setBusy(true);
    try {
      if (role !== (profile.role || ROLES.OPERATOR)) {
        await onSaveRole(profile.id, role);
      }
      const fields = {
        site_id: siteId || null,
        machine_id: role === ROLES.OPERATOR ? (machineId || null) : null,
      };
      if (role === ROLES.SUPERVISOR) {
        fields.phone = phone.trim() || null;
        fields.shift_band = shiftBand;
      }
      await onSaveFields(profile.id, fields);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={profile.name || profile.email || "Edit user"} color="yellow" onClose={onClose}>
      <p className="font-body text-sm text-ops-muted mb-4 truncate">{profile.email}</p>
      {inactive && <p className="font-ui text-sm text-ops-red mb-3">Inactive — cannot sign in</p>}

      <label className="block mb-3">
        <span className="font-ui text-xs font-semibold text-ops-muted">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={inactive}
          className="ops-select mt-1"
        >
          {MANAGEABLE_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>

      <label className="block mb-3">
        <span className="font-ui text-xs font-semibold text-ops-muted">Site</span>
        <select
          value={siteId}
          onChange={(e) => { setSiteId(e.target.value); setMachineId(""); }}
          disabled={inactive}
          className="ops-select mt-1"
        >
          <option value="">No site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      {role === ROLES.OPERATOR && (
        <label className="block mb-3">
          <span className="font-ui text-xs font-semibold text-ops-muted">Default machine (optional)</span>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            disabled={inactive}
            className="ops-select mt-1"
          >
            <option value="">No default machine</option>
            {siteMachines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <p className="font-body text-xs text-ops-muted mt-1">
            One login can still record every machine on the site.
          </p>
        </label>
      )}

      {role === ROLES.SUPERVISOR && (
        <>
          <label className="block mb-3">
            <span className="font-ui text-xs font-semibold text-ops-muted">WhatsApp phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={inactive}
              placeholder="WhatsApp number"
              className="w-full mt-1 bg-ops-inset border border-ops-border rounded-xl px-3 py-3 text-ops-text"
            />
          </label>
          <label className="block mb-3">
            <span className="font-ui text-xs font-semibold text-ops-muted">Shift band</span>
            <select
              value={shiftBand}
              onChange={(e) => setShiftBand(e.target.value)}
              disabled={inactive}
              className="ops-select mt-1"
            >
              <option value="day">Day shift</option>
              <option value="night">Night shift</option>
              <option value="any">All shifts</option>
            </select>
          </label>
        </>
      )}

      <div className="space-y-2 mt-4">
        {!inactive && (
          <Button type="button" variant="primary" size="lg" className="w-full" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
        {!inactive && profile.id !== currentUserId && (
          <Button type="button" variant="danger" size="md" className="w-full" onClick={() => onDeactivate(profile)}>
            Remove user
          </Button>
        )}
        {inactive && (
          <Button type="button" variant="teal" size="md" className="w-full" onClick={() => onReactivate(profile)}>
            Reactivate
          </Button>
        )}
      </div>
    </Modal>
  );
}
