import { Button } from "./ui/Button.jsx";
import { FieldSelect } from "./ui/FieldSelect.jsx";
import { buildSupervisorVerifyWhatsApp, openWhatsApp } from "../lib/whatsapp.js";

const BAND_LABEL = { day: "Day shift", night: "Night shift", any: "All shifts" };

function optionText(sup, suggestedId) {
  const band = BAND_LABEL[sup.shift_band] || "";
  const suggested = sup.id === suggestedId ? "suggested" : "";
  const extra = [band, suggested].filter(Boolean).join(" · ");
  return extra ? `${sup.name} — ${extra}` : sup.name;
}

/** Visible dropdown — pick the supervisor who will sign this shift. */
export function SupervisorPicker({
  supervisors,
  value,
  onChange,
  suggestedId = null,
  label = "Supervisor",
  title,
}) {
  const fieldLabel = label || title || "Supervisor";
  if (!supervisors.length) {
    return (
      <p className="font-body text-sm text-ops-text py-2">
        No supervisor is saved on this phone for this site. An admin adds one with Add user, role Supervisor, on the same site. Then tap Update while this phone has signal.
      </p>
    );
  }

  const selected = supervisors.find((s) => s.id === value) || null;
  const hasPhone = !!String(selected?.phone || "").replace(/\D/g, "");

  return (
    <label className="block">
      {fieldLabel ? <span className="ops-field-label">{fieldLabel}</span> : null}
      <FieldSelect
        value={value}
        onChange={onChange}
        placeholder="Select supervisor…"
      >
        {supervisors.map((sup) => (
          <option key={sup.id} value={sup.id}>
            {optionText(sup, suggestedId)}
          </option>
        ))}
      </FieldSelect>
      {selected && !hasPhone && (
        <p className="font-body text-sm text-ops-red mt-2">
          No WhatsApp number — admin must add a phone.
        </p>
      )}
    </label>
  );
}

/** After submit — one WhatsApp button per supervisor (or just assigned one) */
export function SupervisorWhatsAppButtons({ supervisors, shift, machine, site, assignedSupervisorId, recordedBy, events, siteSettings, onSent }) {
  const targets = assignedSupervisorId
    ? supervisors.filter((s) => s.id === assignedSupervisorId)
    : supervisors.filter((s) => String(s.phone || "").replace(/\D/g, ""));

  if (!targets.length) {
    return (
      <p className="font-body text-sm text-ops-red">
        No supervisor with a phone number. Add phone in admin profiles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {targets.map((sup) => (
        <SupervisorWhatsAppButton
          key={sup.id}
          supervisor={sup}
          shift={shift}
          machine={machine}
          site={site}
          recordedBy={recordedBy}
          events={events}
          siteSettings={siteSettings}
          onSent={onSent}
        />
      ))}
    </div>
  );
}

function SupervisorWhatsAppButton({ supervisor, shift, machine, site, recordedBy, events, siteSettings, onSent }) {
  const url = buildSupervisorVerifyWhatsApp(supervisor.phone, shift, machine, site, { recordedBy, events, siteSettings });

  return (
    <Button
      type="button"
      variant="whatsapp"
      size="lg"
      className="w-full"
      disabled={!url}
      onClick={() => { if (openWhatsApp(url)) onSent?.(supervisor); }}
    >
      WhatsApp {supervisor.name}
    </Button>
  );
}
