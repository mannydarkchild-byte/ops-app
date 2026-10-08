import { tonnesLabel } from "./dispatchMetrics.js";

/** Plain WhatsApp note after a dispatch report is sent. The in-app queue is the sign-off. */
export function buildDispatchWhatsApp(phone, row, site) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits || !row) return null;
  const day = String(row.dispatch_date || "").slice(0, 10);
  const lines = [
    "OPS — Daily dispatch report",
    "",
    `Site: ${site?.name || "—"}`,
    `Day: ${day}`,
    `Weighbridge: ${tonnesLabel(row.tonnes_dispatched)}`,
    `Trucks: ${row.trucks_dispatched ?? "—"}`,
    `Screened: ${tonnesLabel(row.tonnes_screened)}`,
    `On the floor: ${tonnesLabel(row.tonnes_on_floor)}`,
    "",
    "Open OPS and sign it off on the Sign off tab.",
  ];
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
