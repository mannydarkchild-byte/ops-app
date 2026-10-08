import { resolveMediaUrl } from "./media.js";
import { DISPATCH_STATUS, dispatchStatus, tonnesLabel } from "./dispatchMetrics.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function embedPhoto(ref) {
  if (!ref) return null;
  const url = (await resolveMediaUrl(ref)) || (String(ref).startsWith("http") || String(ref).startsWith("data:") ? ref : null);
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return String(url).startsWith("http") ? url : null;
    const blob = await res.blob();
    if (!blob?.size) return String(url).startsWith("http") ? url : null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return String(url).startsWith("http") ? url : null;
  }
}

function statusLine(row) {
  const status = dispatchStatus(row);
  if (status === DISPATCH_STATUS.SIGNED) return `Signed by ${row.signed_by_name || "supervisor"}`;
  if (status === DISPATCH_STATUS.WAITING) return `Waiting for ${row.assigned_supervisor_name || "supervisor"}`;
  return "Draft";
}

/** Printable daily dispatch report for the supervisor sign-off. */
export async function dispatchDayReport(row, site) {
  const day = String(row?.dispatch_date || "").slice(0, 10);
  const photo = await embedPhoto(row?.weighbridge_photo_ref || row?.weighbridge_photo);
  const title = `Dispatch report · ${day}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Inter, Arial, sans-serif; background: #fff; color: #1A1A1A; margin: 24px; }
  h1 { font-size: 22px; letter-spacing: 0.08em; margin: 0 0 4px; }
  .gold { color: #8A5A00; }
  .muted { color: #5C5A54; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .cell { border: 1px solid #E8E6E0; border-radius: 12px; padding: 12px; }
  .label { font-size: 11px; letter-spacing: 0.08em; color: #5C5A54; }
  .value { font-size: 22px; margin-top: 4px; }
  img { max-width: 100%; max-height: 360px; object-fit: contain; border: 1px solid #E8E6E0; border-radius: 12px; }
</style></head><body>
  <p class="gold">OPS · ${esc(site?.name || "Site")}</p>
  <h1>DAILY DISPATCH</h1>
  <p class="muted">${esc(day)} · ${esc(statusLine(row))} · Recorded by ${esc(row?.recorded_by_name || "Dispatch")}</p>
  <div class="grid">
    <div class="cell"><div class="label">WEIGHBRIDGE TONNES</div><div class="value">${esc(tonnesLabel(row?.tonnes_dispatched))}</div></div>
    <div class="cell"><div class="label">TRUCKS</div><div class="value">${row?.trucks_dispatched ?? "—"}</div></div>
    <div class="cell"><div class="label">SCREENED</div><div class="value">${esc(tonnesLabel(row?.tonnes_screened))}</div><div class="muted">${row?.excavator_buckets ?? "—"} excavator buckets${row?.excavator_bucket_tonnes ? ` × ${row.excavator_bucket_tonnes} t` : ""}</div></div>
    <div class="cell"><div class="label">ON THE FLOOR</div><div class="value">${esc(tonnesLabel(row?.tonnes_on_floor))}</div><div class="muted">${row?.fel_buckets ?? "—"} FEL buckets${row?.fel_bucket_tonnes ? ` × ${row.fel_bucket_tonnes} t` : ""}, minus ${esc(tonnesLabel(row?.tonnes_dispatched))} dispatched</div></div>
  </div>
  ${photo ? `<img src="${photo}" alt="Weighbridge report"/>` : `<p class="muted">No weighbridge photo on this day.</p>`}
  ${row?.supervisor_comment ? `<p>Supervisor note: ${esc(row.supervisor_comment)}</p>` : ""}
</body></html>`;
  const sheets = [{
    name: "Dispatch",
    rows: [
      ["Daily dispatch", day],
      ["Site", site?.name || ""],
      ["Status", statusLine(row)],
      ["Weighbridge tonnes", row?.tonnes_dispatched ?? ""],
      ["Trucks", row?.trucks_dispatched ?? ""],
      ["Excavator buckets", row?.excavator_buckets ?? ""],
      ["Tonnes screened", row?.tonnes_screened ?? ""],
      ["FEL buckets", row?.fel_buckets ?? ""],
      ["Tonnes on the floor", row?.tonnes_on_floor ?? ""],
      ["Recorded by", row?.recorded_by_name || ""],
      ["Supervisor", row?.assigned_supervisor_name || ""],
      ["Signed by", row?.signed_by_name || ""],
    ],
  }];
  return { html, title, sheets };
}
