import { resolveMediaUrl } from "./media.js";
import { DISPATCH_STATUS, dispatchStatus, tonnesLabel } from "./dispatchMetrics.js";
import { reportPageStyles } from "../services/reports.js";

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

async function resolveLogoDataUrl() {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function statusLine(row) {
  const status = dispatchStatus(row);
  if (status === DISPATCH_STATUS.SIGNED) return `Signed by ${row.signed_by_name || "supervisor"}`;
  if (status === DISPATCH_STATUS.WAITING) return `Waiting for ${row.assigned_supervisor_name || "supervisor"}`;
  return "Draft";
}

function dayLabel(row) {
  const day = String(row?.dispatch_date || "").slice(0, 10);
  if (!day) return "—";
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Printable daily dispatch report — same page chrome as the operator daily report. */
export async function dispatchDayReport(row, site) {
  const day = String(row?.dispatch_date || "").slice(0, 10);
  const [photo, logoUrl] = await Promise.all([
    embedPhoto(row?.weighbridge_photo_ref || row?.weighbridge_photo),
    resolveLogoDataUrl(),
  ]);
  const title = `Dispatch report · ${day}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Russo+One&display=swap" rel="stylesheet"/>
<style>${reportPageStyles()}
  .photos{display:grid;grid-template-columns:1fr;gap:16px;margin-top:10px}
  .photos figure{margin:0;border:1px solid #D9D7D0}
  .photos img{display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#fff}
  .photos figcaption{padding:8px 10px;font-size:11px;color:#6B6960;background:#F2F0EA;border-top:1px solid #D9D7D0}
  .signoff{margin-top:8px;padding:24px;background:#F2F0EA;border:1px solid #D9D7D0;border-top:3px solid #F5C518}
  .signoff-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:14px}
  .signoff-head h2{margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2A2A2A;font-weight:400}
  .signoff-meta{font-size:12px;color:#57534E}
  .signoff-meta p{margin:0 0 4px}
  .signoff-meta strong{color:#2A2A2A;font-weight:600}
  .signature-row{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px}
  .signature-box{padding:14px;background:#fff;border:1px solid #D9D7D0;flex:1;min-width:220px}
  .signature-label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6B6960;margin-bottom:6px;font-weight:400}
  .signature-name{font-size:12px;color:#2A2A2A;font-weight:600;margin-top:8px}
</style></head><body>
<div class="page">
  <header class="header">
    <div class="header-row">
      <div class="logo-wrap">
        ${logoUrl
    ? `<img src="${esc(logoUrl)}" alt="OPS" class="logo"/>`
    : `<div class="logo-fallback">OPS</div>`}
      </div>
      <div class="header-text">
        <h1 class="font-brand">Daily Dispatch Report</h1>
        <p class="header-sub font-brand">${esc(site?.name || "Site")}</p>
        <div class="header-meta">
          <span>Recorded by · ${esc(row?.recorded_by_name || "Dispatch")}</span>
          <span>${esc(statusLine(row))}</span>
          <span>${esc(dayLabel(row))}</span>
        </div>
      </div>
    </div>
  </header>

  <main class="content">
    <div class="summary quad">
      <div class="summary-cell highlight">
        <div class="label">Weighbridge tonnes</div>
        <div class="value font-brand">${esc(tonnesLabel(row?.tonnes_dispatched))}</div>
        <div class="sub">${row?.trucks_dispatched == null ? "No trucks entered" : `${row.trucks_dispatched} trucks`}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Trucks</div>
        <div class="value font-brand">${row?.trucks_dispatched == null ? "—" : row.trucks_dispatched}</div>
        <div class="sub">Weighbridge count</div>
      </div>
      <div class="summary-cell">
        <div class="label">Screened</div>
        <div class="value font-brand">${esc(tonnesLabel(row?.tonnes_screened))}</div>
        <div class="sub">${row?.excavator_buckets == null ? "No excavator buckets" : `${row.excavator_buckets} excavator buckets`}</div>
      </div>
      <div class="summary-cell">
        <div class="label">On the floor</div>
        <div class="value font-brand">${esc(tonnesLabel(row?.tonnes_on_floor))}</div>
        <div class="sub">${row?.fel_buckets == null ? "No FEL buckets" : `${row.fel_buckets} FEL buckets`} − dispatched</div>
      </div>
    </div>

    <section>
      <h2 class="font-brand">Weighbridge photo</h2>
      ${photo
    ? `<div class="photos"><figure><img src="${esc(photo)}" alt="Weighbridge report"/><figcaption>Weighbridge ticket · ${esc(day)}</figcaption></figure></div>`
    : `<p class="note">No weighbridge photo on this day.</p>`}
    </section>

    <section>
      <div class="signoff">
        <div class="signoff-head">
          <h2>Sign-off</h2>
          <div class="signoff-meta">
            <p><strong>Recorded by:</strong> ${esc(row?.recorded_by_name || "Dispatch")}</p>
            ${row?.signed_at ? `<p><strong>Signed at:</strong> ${esc(new Date(row.signed_at).toLocaleString("en-ZA"))}</p>` : `<p><strong>Status:</strong> ${esc(statusLine(row))}</p>`}
          </div>
        </div>
        <div class="signature-row">
          <div class="signature-box">
            <div class="signature-label">Dispatch</div>
            <p class="signature-name">${esc(row?.recorded_by_name || "Dispatch")}</p>
          </div>
          <div class="signature-box">
            <div class="signature-label">Supervisor signature</div>
            <p class="note" style="margin:8px 0 0">${esc(row?.signed_by_name || "Awaiting supervisor signature")}</p>
            <p class="signature-name">${esc(row?.signed_by_name || "Not signed yet")}</p>
          </div>
        </div>
        ${row?.supervisor_comment ? `<p class="note">Supervisor note: ${esc(row.supervisor_comment)}</p>` : ""}
        <p class="note">This is the same daily dispatch report Dispatch and the supervisor open. Closing stock is the previous floor, plus FEL bucket tonnes, minus weighbridge tonnes dispatched. Days are not added together.</p>
      </div>
    </section>

    <footer class="footer">
      <span>OPS Operations · ${esc(site?.name || "Site")}</span>
      <span>Generated ${new Date().toLocaleString("en-ZA")}</span>
    </footer>
  </main>
</div>
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
