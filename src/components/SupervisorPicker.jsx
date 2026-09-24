import { buildSupervisorVerifyWhatsApp, openWhatsApp } from "../lib/whatsapp.js";

const BAND_LABEL = { day: "Day shift", night: "Night shift", any: "All shifts" };

/** Large tap targets — pick supervisor on duty for this shift */
export function SupervisorPicker({ supervisors, value, onChange, suggestedId = null }) {
  if (!supervisors.length) {
    return (
      <p className="font-body text-sm text-ops-text py-2">
        No supervisors on this phone yet. You can still clock in, then tap Update when you have signal.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-logo text-xs text-[#F2F0EA]/90 tracking-wider mb-2">WHO IS SUPERVISING THIS SHIFT?</p>
      {supervisors.map((sup) => {
        const selected = value === sup.id;
        const suggested = sup.id === suggestedId;
        const hasPhone = !!String(sup.phone || "").replace(/\D/g, "");
        return (
          <button
            key={sup.id}
            type="button"
            onClick={() => onChange(sup.id)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all active:scale-[0.99] ${
              selected ? "border-[#F5C518] bg-[#F5C518]/10" : "border-[#2A2A2A] bg-[#0A0A0A]"
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-logo text-base text-[#F2F0EA]">{sup.name}</p>
                <p className="font-body text-xs text-[#F2F0EA]/80 mt-0.5">
                  {BAND_LABEL[sup.shift_band] || BAND_LABEL.any}
                  {suggested && !selected && <span className="text-[#F5C518] ml-2">· suggested</span>}
                </p>
              </div>
              {selected && <span className="text-[#F5C518] text-lg">✓</span>}
            </div>
            {!hasPhone && (
              <p className="font-body text-[10px] text-[#EF4444] mt-2">No WhatsApp number — admin must add phone</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** After submit — one WhatsApp button per supervisor (or just assigned one) */
export function SupervisorWhatsAppButtons({ supervisors, shift, machine, site, assignedSupervisorId, onSent }) {
  const targets = assignedSupervisorId
    ? supervisors.filter((s) => s.id === assignedSupervisorId)
    : supervisors.filter((s) => String(s.phone || "").replace(/\D/g, ""));

  if (!targets.length) {
    return (
      <p className="font-body text-sm text-[#EF4444]">
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
          onSent={onSent}
        />
      ))}
      {!assignedSupervisorId && targets.length > 1 && (
        <p className="font-body text-[10px] text-[#F2F0EA]/40 text-center mt-2">Tap the supervisor on duty today</p>
      )}
    </div>
  );
}

function SupervisorWhatsAppButton({ supervisor, shift, machine, site, onSent }) {
  const url = buildSupervisorVerifyWhatsApp(supervisor.phone, shift, machine, site);

  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => { if (openWhatsApp(url)) onSent?.(supervisor); }}
      className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-logo font-bold text-sm tracking-wider active:scale-95 disabled:opacity-40"
    >
      📱 WHATSAPP {supervisor.name.toUpperCase()}
    </button>
  );
}
