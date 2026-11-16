import { useState } from "react";
import {
  categoryForStopReason,
  isOtherStopReason,
  stopReasonOptionsForMachine,
  subReasonsForCategory,
} from "../lib/stopReasons.js";

function subLabel(sub) {
  return isOtherStopReason(sub.label) ? "Other" : sub.label;
}

/** Six categories first. A tap opens that category's makeup options. */
export function StopReasonPicker({ machine, siteSettings, value, onChange }) {
  const options = stopReasonOptionsForMachine(machine, siteSettings);
  const [openCategory, setOpenCategory] = useState(() => (value ? categoryForStopReason(value) : ""));
  const category = openCategory || (value ? categoryForStopReason(value) : "");
  const selected = options.find((row) => row.reason === category);
  const subs = category ? subReasonsForCategory(category, machine) : [];

  if (category && selected) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setOpenCategory("");
            onChange?.("");
          }}
          className="font-ui text-sm text-[#F5C518]"
        >
          ← All categories
        </button>
        <div className="rounded-xl border border-[#F5C518] bg-[#F5C518]/15 px-3 py-3">
          <p className="font-ui font-semibold text-sm text-[#F2F0EA]">{selected.reason}</p>
          <p className="font-body text-[12px] text-[#F2F0EA]/65 mt-0.5">{selected.hint}</p>
        </div>
        <p className="ops-field-label">What kind of {selected.reason.toLowerCase()} stop?</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`${selected.reason} detail`}>
          {subs.map((sub) => {
            const picked = value === sub.label;
            return (
              <button
                key={sub.label}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => onChange?.(sub.label)}
                className={`text-left rounded-xl border px-3 py-2.5 min-h-12 transition-colors ${
                  picked
                    ? "bg-[#EF4444]/15 border-[#EF4444] text-[#F2F0EA]"
                    : "bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA] hover:border-[#EF4444]/50"
                }`}
              >
                <p className="font-ui text-sm font-semibold leading-snug">{subLabel(sub)}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Stop category">
      {options.map((row) => (
        <button
          key={row.reason}
          type="button"
          role="radio"
          aria-checked={false}
          onClick={() => setOpenCategory(row.reason)}
          className="text-left rounded-xl border px-3 py-3 min-h-16 bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA] hover:border-[#F5C518]/50"
        >
          <p className="font-ui font-semibold text-sm">{row.reason}</p>
          <p className="font-body text-[12px] text-[#F2F0EA]/65 mt-0.5">{row.hint}</p>
          <p className="font-body text-[11px] text-[#F2F0EA]/40 mt-1">{row.ownerHint}</p>
        </button>
      ))}
    </div>
  );
}
