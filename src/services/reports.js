import { SHIFT } from "../lib/constants.js";
import { resolveMediaUrl } from "../lib/media.js";
import { formatDurationMinutes } from "../lib/shiftMetrics.js";
import { esc, fmtDate, fmtDateShort, money, shiftBillableValue } from "../lib/utils.js";

function shiftWindow(shift) {
  const start = new Date(shift.started_at).getTime();
  const end = new Date(shift.ended_at || shift.verified_at || Date.now()).getTime();
  return { start, end };
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

function reportPageStyles() {
  return `
  *{box-sizing:border-box}
  body{margin:0;font-family:'Russo One',sans-serif;background:#F2F0EA;color:#2A2A2A;line-height:1.55;font-size:12px;letter-spacing:.04em;-webkit-font-smoothing:antialiased}
  .page{max-width:880px;margin:24px auto;background:#fff;border:1px solid #D9D7D0;min-height:calc(100vh - 48px)}
  .header{padding:28px 40px 24px;border-bottom:3px solid #F5C518}
  .header-row{display:flex;align-items:center;gap:24px}
  .logo-wrap{flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .logo{width:80px;height:80px;border-radius:12px;border:2px solid #F5C518;object-fit:contain;background:#fff;padding:6px;display:block}
  .logo-fallback{width:80px;height:80px;border-radius:12px;border:2px solid #F5C518;background:#FFFBEB;color:#F5C518;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .header-text{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
  .header h1{margin:0;font-size:20px;font-weight:400;color:#2A2A2A;letter-spacing:.08em;text-transform:uppercase;line-height:1.2}
  .header-sub{margin:6px 0 0;font-size:14px;font-weight:400;color:#57534E;line-height:1.3;letter-spacing:.06em;text-transform:uppercase}
  .header-meta{margin-top:8px;font-size:12px;color:#6B6960;display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px}
  .header-meta span:not(:last-child)::after{content:"·";margin-left:20px;color:#C4C2BC}
  .content{padding:28px 40px 40px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#D9D7D0;border:1px solid #D9D7D0;margin-bottom:28px}
  .summary-cell{background:#fff;padding:16px 18px}
  .summary-cell.highlight{background:#FFFBEB;border-left:3px solid #F5C518}
  .summary-cell .label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6B6960;margin-bottom:4px;font-weight:400}
  .summary-cell .value{font-size:20px;font-weight:400;color:#2A2A2A;letter-spacing:.04em}
  .summary-cell.highlight .value{font-size:28px;color:#22C55E}
  .summary-cell .sub{font-size:11px;color:#6B6960;margin-top:4px}
  .timestamps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #E8E6E0}
  .timestamps .item .label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6B6960;margin-bottom:2px;font-weight:400}
  .timestamps .item .value{font-size:12px;color:#2A2A2A}
  section{margin-bottom:26px}
  section h2{margin:0 0 10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2A2A2A;font-weight:400;padding-bottom:6px;border-bottom:1px solid #F5C518}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead th{text-align:left;padding:8px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:400;color:#2A2A2A;background:#F2F0EA;border-bottom:2px solid #F5C518}
  tbody td{padding:8px 10px;border-bottom:1px solid #E8E6E0;vertical-align:top;color:#2A2A2A}
  tbody tr:last-child td{border-bottom:none}
  .empty td{text-align:center;color:#6B6960;font-style:italic;padding:16px;border-bottom:none}
  .callout{padding:14px 16px;background:#FFFBEB;border:1px solid #F5C518;border-left:3px solid #F5C518;margin-bottom:24px;font-size:11px;color:#57534E}
  .footer{margin-top:28px;padding-top:14px;border-top:1px solid #E8E6E0;font-size:10px;color:#6B6960;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .note{font-size:11px;color:#6B6960;margin-top:10px;line-height:1.5}
  @media print{
    body{background:#fff;margin:0}
    .page{margin:0;border:none;max-width:100%;min-height:auto}
  }
  @media (max-width:640px){
    .header,.content{padding:20px}
    .summary,.timestamps{grid-template-columns:1fr}
    .header-meta span:not(:last-child)::after{display:none}
  }`;
}

function shiftPrestart(inspections, shift) {
  const { start, end } = shiftWindow(shift);
  return inspections
    .filter((i) =>
      i.type === "Pre-Start Inspection" &&
      i.operator_id === shift.operator_id &&
      i.machine_id === shift.machine_id &&
      new Date(i.timestamp).getTime() >= start - 3600000 &&
      new Date(i.timestamp).getTime() <= end
    )
    .sort((a, b) => (a.item_name || "").localeCompare(b.item_name || ""));
}

async function resolveInspectionPhotoMap(items) {
  const map = {};
  await Promise.all(
    (items || []).map(async (item) => {
      if (!item.photo_ref) return;
      const url = await resolveMediaUrl(item.photo_ref);
      if (url) map[item.id] = { url, label: item.item_name };
    })
  );
  return map;
}

export function generateShiftDailyReportHTML(shift, { events, inspections, fuelLogs, machine, site, signatureUrl, openingPhotoUrl, closingPhotoUrl, logoUrl, prestartPhotoUrls = {} }) {
  const shiftEvents = events
    .filter((e) => e.shift_id === shift.id)
    .sort((a, b) => new Date(a.timestamp || a.stopped_at || 0) - new Date(b.timestamp || b.stopped_at || 0));
  const stops = shiftEvents.filter((e) => e.type === "STOP");
  const shiftFuel = fuelLogs.filter((f) => f.shift_id === shift.id);
  const prestart = shiftPrestart(inspections, shift);
  const titleDate = fmtDateShort(shift.started_at);

  const timelineRows = shiftEvents.map((e) => {
    const when = fmtDate(e.timestamp || e.stopped_at);
    if (e.type === "STOP") {
      const dur = e.status === "closed" ? `${e.downtime_minutes || 0} min` : "open";
      return `<tr><td>${when}</td><td>Stop</td><td>${esc(e.reason)}</td><td>${esc(e.note || "")} (${dur})</td></tr>`;
    }
    return `<tr><td>${when}</td><td>${esc(e.type?.replace(/_/g, " "))}</td><td colspan="2">${esc(e.note || "")}</td></tr>`;
  }).join("");

  const statusBadge = (status) => {
    const s = (status || "").toLowerCase();
    const cls = s.includes("fail") || s.includes("no") ? "badge-warn" : s.includes("pass") || s.includes("ok") ? "badge-ok" : "badge-neutral";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8"><title>Daily Report · ${esc(shift.operator_name)} · ${titleDate}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
<style>${reportPageStyles()}
  .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600}
  .badge-ok{background:#ECFDF5;color:#15803D;border:1px solid #BBF7D0}
  .badge-warn{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}
  .badge-neutral{background:#F2F0EA;color:#57534E;border:1px solid #D9D7D0}
  .photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:10px}
  .photos figure{margin:0;border:1px solid #D9D7D0}
  .photos img{display:block;width:100%;height:auto}
  .photos figcaption{padding:8px 10px;font-size:11px;color:#6B6960;background:#F2F0EA;border-top:1px solid #D9D7D0}
  .signoff{margin-top:8px;padding:24px;background:#F2F0EA;border:1px solid #D9D7D0;border-top:3px solid #F5C518}
  .signoff-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:14px}
  .signoff-head h2{margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2A2A2A;font-weight:400}
  .signoff-meta{font-size:12px;color:#57534E}
  .signoff-meta p{margin:0 0 4px}
  .signoff-meta strong{color:#2A2A2A;font-weight:600}
  .signature-box{margin-top:12px;padding:14px;background:#fff;border:1px solid #D9D7D0;display:inline-block;min-width:260px}
  .signature-box img{max-width:280px;max-height:100px;display:block}
  .signature-label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6B6960;margin-bottom:6px;font-weight:400}
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
        <h1>Daily Shift Report</h1>
        <p class="header-sub">${esc(shift.operator_name || "Operator")}</p>
        <div class="header-meta">
          <span>${esc(site?.name || "Site")}</span>
          <span>${esc(machine?.name || machine?.id || "Machine")}</span>
          <span>${titleDate}</span>
        </div>
      </div>
    </div>
  </header>

  <main class="content">
    <div class="summary">
      <div class="summary-cell highlight">
        <div class="label">Billable hours</div>
        <div class="value">${Number(shift.hours_worked || 0).toFixed(1)}h</div>
        <div class="sub">Meter ${shift.start_hour_meter}h → ${shift.end_hour_meter}h</div>
      </div>
      <div class="summary-cell">
        <div class="label">Runtime</div>
        <div class="value">${formatDurationMinutes(shift.runtime_minutes || 0)}</div>
        <div class="sub">App-tracked</div>
      </div>
      <div class="summary-cell">
        <div class="label">Downtime</div>
        <div class="value">${formatDurationMinutes(shift.downtime_minutes || 0)}</div>
        <div class="sub">App-tracked</div>
      </div>
    </div>

    <div class="timestamps">
      <div class="item"><div class="label">Shift started</div><div class="value">${fmtDate(shift.started_at)}</div></div>
      <div class="item"><div class="label">Shift ended</div><div class="value">${fmtDate(shift.ended_at)}</div></div>
      <div class="item"><div class="label">Verified</div><div class="value">${fmtDate(shift.verified_at || shift.ended_at)}</div></div>
    </div>

    <section>
      <h2>Pre-start inspection</h2>
      <table><thead><tr><th>Item</th><th>Status</th><th>Remarks</th><th>Photo</th></tr></thead><tbody>
${prestart.length
    ? prestart.map((i) => {
      const photoUrl = prestartPhotoUrls[i.id];
      return `<tr><td>${esc(i.item_name)}</td><td>${statusBadge(i.status)}</td><td>${esc(i.remark || "—")}</td><td>${
        photoUrl ? `<img src="${esc(photoUrl)}" alt="" style="max-width:120px;max-height:80px;object-fit:contain;border:1px solid #E8E6E0"/>` : "—"
      }</td></tr>`;
    }).join("")
    : '<tr class="empty"><td colspan="4">No pre-start records on this device</td></tr>'}
      </tbody></table>
    </section>

    ${Object.keys(prestartPhotoUrls).length ? `<section>
      <h2>Pre-start photos</h2>
      <div class="photos">
        ${prestart.map((i) => {
          const url = prestartPhotoUrls[i.id];
          if (!url) return "";
          return `<figure><img src="${esc(url)}" alt="${esc(i.item_name)}"/><figcaption>${esc(i.item_name)} · ${esc(i.status)}</figcaption></figure>`;
        }).filter(Boolean).join("")}
      </div>
    </section>` : ""}

    <section>
      <h2>Shift activity</h2>
      <table><thead><tr><th>Time</th><th>Event</th><th>Detail</th><th>Notes</th></tr></thead><tbody>
${timelineRows || '<tr class="empty"><td colspan="4">No activity logged</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2>Downtime</h2>
      <table><thead><tr><th>Reason</th><th>Stopped</th><th>Duration</th><th>Notes</th></tr></thead><tbody>
${stops.length
    ? stops.map((s) => `<tr><td>${esc(s.reason)}</td><td>${fmtDate(s.stopped_at)}</td><td>${s.downtime_minutes != null ? `${s.downtime_minutes} min` : "—"}</td><td>${esc(s.note || "")}</td></tr>`).join("")
    : '<tr class="empty"><td colspan="4">No stops recorded</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2>Diesel</h2>
      <table><thead><tr><th>Time</th><th>Litres</th><th>Meter</th><th>Tank</th><th>Note</th></tr></thead><tbody>
${shiftFuel.length
    ? shiftFuel.map((f) => `<tr><td>${fmtDate(f.timestamp)}</td><td>${Number(f.litres || 0).toFixed(1)} L</td><td>${f.hour_meter}h</td><td>${esc(f.tank_level || "—")}</td><td>${esc(f.note || "")}</td></tr>`).join("")
    : '<tr class="empty"><td colspan="5">No diesel logged this shift</td></tr>'}
      </tbody></table>
    </section>

    ${(openingPhotoUrl || closingPhotoUrl) ? `<section>
      <h2>Hour meter photos</h2>
      <div class="photos">
        ${openingPhotoUrl ? `<figure><img src="${esc(openingPhotoUrl)}" alt="Opening meter"/><figcaption>Opening reading · ${shift.start_hour_meter}h</figcaption></figure>` : ""}
        ${closingPhotoUrl ? `<figure><img src="${esc(closingPhotoUrl)}" alt="Closing meter"/><figcaption>Closing reading · ${shift.end_hour_meter}h</figcaption></figure>` : ""}
      </div>
    </section>` : ""}

    <section>
      <div class="signoff">
        <div class="signoff-head">
          <h2>Supervisor sign-off</h2>
          <div class="signoff-meta">
            <p><strong>Verified by:</strong> ${esc(shift.supervisor_signature_name || "Supervisor")}</p>
            <p><strong>Verified at:</strong> ${fmtDate(shift.verified_at || shift.ended_at)}</p>
            ${shift.assigned_supervisor_name ? `<p><strong>Assigned:</strong> ${esc(shift.assigned_supervisor_name)}</p>` : ""}
          </div>
        </div>
        ${signatureUrl
    ? `<div class="signature-box"><div class="signature-label">Authorised signature</div><img src="${esc(signatureUrl)}" alt="Supervisor signature"/></div>`
    : "<p class=\"note\"><em>Signature image not available on this device — sync when online.</em></p>"}
        <p class="note">Signed daily report for billing reference. Billable hours are taken from hour meter readings only; runtime and downtime are app-tracked operational metrics.</p>
      </div>
    </section>

    <footer class="footer">
      <span>OPS Operations · ${esc(site?.name || "Site")}</span>
      <span>Generated ${new Date().toLocaleString("en-ZA")}</span>
    </footer>
  </main>
</div>
</body></html>`;
}

export async function openShiftDailyReport(shift, { events, inspections, fuelLogs, machine, site }) {
  const sigRef = shift.supervisor_signature_ref || shift.supervisor_signature;
  const startEv = events.find((e) => e.shift_id === shift.id && e.type === "MACHINE_STARTED");
  const endEv = events.find((e) => e.shift_id === shift.id && e.type === "METER_END_CAPTURED");
  const prestartItems = shiftPrestart(inspections, shift);
  const prestartPhotoMap = await resolveInspectionPhotoMap(prestartItems);
  const prestartPhotoUrls = Object.fromEntries(
    Object.entries(prestartPhotoMap).map(([id, { url }]) => [id, url])
  );

  const [signatureUrl, openingPhotoUrl, closingPhotoUrl, logoUrl] = await Promise.all([
    resolveMediaUrl(sigRef),
    resolveMediaUrl(startEv?.photo_ref),
    resolveMediaUrl(endEv?.photo_ref),
    resolveLogoDataUrl(),
  ]);

  const html = generateShiftDailyReportHTML(shift, {
    events, inspections, fuelLogs, machine, site, signatureUrl, openingPhotoUrl, closingPhotoUrl, logoUrl, prestartPhotoUrls,
  });

  const w = window.open("", "_blank");
  if (!w) throw new Error("Pop-up blocked — allow pop-ups to view the daily report.");
  w.document.write(html);
  w.document.close();
  w.document.title = `Daily Report · ${shift.operator_name} · ${fmtDateShort(shift.started_at)}`;
}

export async function downloadShiftDailyReport(shift, ctx) {
  const sigRef = shift.supervisor_signature_ref || shift.supervisor_signature;
  const startEv = ctx.events.find((e) => e.shift_id === shift.id && e.type === "MACHINE_STARTED");
  const endEv = ctx.events.find((e) => e.shift_id === shift.id && e.type === "METER_END_CAPTURED");
  const prestartItems = shiftPrestart(ctx.inspections, shift);
  const prestartPhotoMap = await resolveInspectionPhotoMap(prestartItems);
  const prestartPhotoUrls = Object.fromEntries(
    Object.entries(prestartPhotoMap).map(([id, { url }]) => [id, url])
  );
  const [signatureUrl, openingPhotoUrl, closingPhotoUrl, logoUrl] = await Promise.all([
    resolveMediaUrl(sigRef),
    resolveMediaUrl(startEv?.photo_ref),
    resolveMediaUrl(endEv?.photo_ref),
    resolveLogoDataUrl(),
  ]);
  const html = generateShiftDailyReportHTML(shift, {
    ...ctx, signatureUrl, openingPhotoUrl, closingPhotoUrl, logoUrl, prestartPhotoUrls,
  });
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DailyReport_${shift.operator_name?.replace(/\s+/g, "_") || "shift"}_${fmtDateShort(shift.started_at).replace(/\//g, "-")}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function generateFullReportHTML(data, period, periodLabel, machine, site, { logoUrl, machines = [] } = {}) {
  const machineList = machines.length ? machines : machine ? [machine] : [];
  const { shifts: runs, events, expenses, fuelLogs } = data;
  const inRange = (iso) => iso && new Date(iso) >= period.start && new Date(iso) <= period.end;

  const shifts = runs.filter((r) => inRange(r.started_at));
  const verified = shifts.filter((s) => s.shift_status === SHIFT.VERIFIED);
  const pending = shifts.filter((s) => [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(s.shift_status));
  const verifiedHours = verified.reduce((a, s) => a + Number(s.hours_worked || 0), 0);
  const pendingHours = pending.reduce((a, s) => a + Number(s.hours_worked || 0), 0);
  const revenue = verified.reduce((a, s) => a + shiftBillableValue(s, machineList), 0);
  const periodExpenses = expenses.filter((e) => inRange(e.date));
  const totalExpenses = periodExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const closedStops = events.filter((e) => e.type === "STOP" && e.status === "closed" && inRange(e.stopped_at));
  const totalDowntimeMin = closedStops.reduce((a, e) => a + Number(e.downtime_minutes || 0), 0);
  const totalDowntimeHours = totalDowntimeMin / 60;
  const utilisation = (verifiedHours + totalDowntimeHours) > 0 ? (verifiedHours / (verifiedHours + totalDowntimeHours)) * 100 : 0;
  const periodFuels = fuelLogs.filter((f) => inRange(f.timestamp));
  const totalLitres = periodFuels.reduce((a, f) => a + Number(f.litres || 0), 0);
  const consumption = verifiedHours > 0 ? totalLitres / verifiedHours : 0;
  const runtimeMin = verified.reduce((a, s) => a + Number(s.runtime_minutes || 0), 0);

  const downtimeByReason = {};
  for (const e of closedStops) {
    const reason = e.reason || "Other";
    downtimeByReason[reason] = (downtimeByReason[reason] || 0) + Number(e.downtime_minutes || 0);
  }
  const downtimeRows = Object.entries(downtimeByReason)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, min]) => `<tr><td>${esc(reason)}</td><td>${formatDurationMinutes(min)}</td></tr>`)
    .join("");

  const expenseByCategory = {};
  for (const e of periodExpenses) {
    const cat = e.category || "Other";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
  }
  const expenseRows = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `<tr><td>${esc(cat)}</td><td>${money(amt)}</td></tr>`)
    .join("");

  const fuelRows = periodFuels
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((f) => `<tr><td>${fmtDate(f.timestamp)}</td><td>${Number(f.litres || 0).toFixed(1)} L</td><td>${f.hour_meter ?? "—"}h</td><td>${esc(f.operator_name || "—")}</td></tr>`)
    .join("");

  const shiftRows = verified
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .map((s) => `<tr>
      <td>${esc(s.operator_name)}</td>
      <td>${fmtDateShort(s.started_at)}</td>
      <td>${Number(s.hours_worked || 0).toFixed(1)}h</td>
      <td>${money(shiftBillableValue(s, machineList))}</td>
      <td>${esc(s.supervisor_signature_name || "—")}</td>
    </tr>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Operations Report · ${esc(periodLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
<style>${reportPageStyles()}</style></head><body>
<div class="page">
  <header class="header">
    <div class="header-row">
      <div class="logo-wrap">
        ${logoUrl
    ? `<img src="${esc(logoUrl)}" alt="OPS" class="logo"/>`
    : `<div class="logo-fallback">OPS</div>`}
      </div>
      <div class="header-text">
        <h1>Operations Report</h1>
        <p class="header-sub">${esc(periodLabel)}</p>
        <div class="header-meta">
          <span>${esc(site?.name || "Site")}</span>
          <span>${esc(machine?.name || machine?.id || "Machine")}</span>
          <span>R${Number(machine?.billable_rate || 0).toFixed(0)}/h</span>
        </div>
      </div>
    </div>
  </header>

  <main class="content">
    <div class="summary">
      <div class="summary-cell highlight">
        <div class="label">Billable hours</div>
        <div class="value">${verifiedHours.toFixed(1)}h</div>
        <div class="sub">${verified.length} verified shift${verified.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="summary-cell highlight">
        <div class="label">Revenue</div>
        <div class="value">${money(revenue)}</div>
        <div class="sub">Hour meter · signed shifts</div>
      </div>
      <div class="summary-cell">
        <div class="label">Net (approx)</div>
        <div class="value">${money(revenue - totalExpenses)}</div>
        <div class="sub">Revenue minus expenses</div>
      </div>
      <div class="summary-cell">
        <div class="label">Runtime</div>
        <div class="value">${formatDurationMinutes(runtimeMin)}</div>
        <div class="sub">App-tracked</div>
      </div>
      <div class="summary-cell">
        <div class="label">Downtime</div>
        <div class="value">${formatDurationMinutes(totalDowntimeMin)}</div>
        <div class="sub">Util ${utilisation.toFixed(0)}%</div>
      </div>
      <div class="summary-cell">
        <div class="label">Diesel</div>
        <div class="value">${totalLitres.toFixed(1)} L</div>
        <div class="sub">${consumption > 0 ? `${consumption.toFixed(2)} L/h` : "—"}</div>
      </div>
    </div>

    <div class="timestamps">
      <div class="item"><div class="label">Period start</div><div class="value">${fmtDate(period.start.toISOString())}</div></div>
      <div class="item"><div class="label">Period end</div><div class="value">${fmtDate(period.end.toISOString())}</div></div>
      <div class="item"><div class="label">Expenses</div><div class="value">${money(totalExpenses)}</div></div>
    </div>

    ${pendingHours > 0 ? `<div class="callout">⚠ ${pending.length} shift(s) pending supervisor verification (${pendingHours.toFixed(1)}h billable)</div>` : ""}

    <section>
      <h2>Verified shifts</h2>
      <table><thead><tr><th>Operator</th><th>Date</th><th>Hours</th><th>Value</th><th>Signed by</th></tr></thead><tbody>
${shiftRows || '<tr class="empty"><td colspan="5">No verified shifts in this period</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2>Downtime by reason</h2>
      <table><thead><tr><th>Reason</th><th>Duration</th></tr></thead><tbody>
${downtimeRows || '<tr class="empty"><td colspan="2">No downtime recorded</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2>Diesel log</h2>
      <table><thead><tr><th>Time</th><th>Litres</th><th>Meter</th><th>Operator</th></tr></thead><tbody>
${fuelRows || '<tr class="empty"><td colspan="4">No diesel logged</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2>Expenses by category</h2>
      <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
${expenseRows || '<tr class="empty"><td colspan="2">No expenses recorded</td></tr>'}
      </tbody></table>
    </section>

    <p class="note">Billable hours from hour meter readings on supervisor-signed shifts. Runtime and downtime are app-tracked operational metrics. Generated from local OPS data.</p>

    <footer class="footer">
      <span>OPS Operations · ${esc(site?.name || "Site")}</span>
      <span>Generated ${new Date().toLocaleString("en-ZA")}</span>
    </footer>
  </main>
</div>
</body></html>`;
}

export function generateMechanicInspectionReportHTML(batch, items, { machine, site, mechanicName, photoUrls = {}, logoUrl }) {
  const sorted = [...items].sort((a, b) => {
    const cat = (a.category || "").localeCompare(b.category || "");
    return cat || (a.item_name || "").localeCompare(b.item_name || "");
  });
  const titleDate = fmtDateShort(batch.timestamp || items[0]?.timestamp);
  const flagged = sorted.filter((i) => i.status && !["Good", "OK", "Working", "Pass", "Present", "None"].includes(i.status));

  const statusBadge = (status) => {
    const s = (status || "").toLowerCase();
    const cls = s.includes("fail") || s.includes("critical") || s.includes("major") || s.includes("missing") || s.includes("found") || s.includes("blocked")
      ? "badge-warn"
      : s.includes("good") || s.includes("pass") || s.includes("working") || s.includes("present") || s.includes("none")
        ? "badge-ok"
        : "badge-neutral";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  };

  let currentCategory = "";
  const rows = sorted.map((i) => {
    let catRow = "";
    if (i.category !== currentCategory) {
      currentCategory = i.category;
      catRow = `<tr class="cat-row"><td colspan="4"><strong>${esc(i.category)}</strong></td></tr>`;
    }
    const photoUrl = photoUrls[i.id];
    return `${catRow}<tr><td>${esc(i.item_name)}</td><td>${statusBadge(i.status)}</td><td>${esc(i.remark || "—")}</td><td>${
      photoUrl ? `<img src="${esc(photoUrl)}" alt="" style="max-width:120px;max-height:80px;object-fit:contain;border:1px solid #E8E6E0"/>` : "—"
    }</td></tr>`;
  }).join("");

  const photoGallery = sorted
    .filter((i) => photoUrls[i.id])
    .map((i) => `<figure><img src="${esc(photoUrls[i.id])}" alt="${esc(i.item_name)}"/><figcaption>${esc(i.category)} · ${esc(i.item_name)} · ${esc(i.status)}</figcaption></figure>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Mechanic Inspection · ${esc(machine?.name || "Machine")} · ${titleDate}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
<style>${reportPageStyles()}
  .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600}
  .badge-ok{background:#ECFDF5;color:#15803D;border:1px solid #BBF7D0}
  .badge-warn{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}
  .badge-neutral{background:#F2F0EA;color:#57534E;border:1px solid #D9D7D0}
  .photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:10px}
  .photos figure{margin:0;border:1px solid #D9D7D0}
  .photos img{display:block;width:100%;height:auto}
  .photos figcaption{padding:8px 10px;font-size:11px;color:#6B6960;background:#F2F0EA;border-top:1px solid #D9D7D0}
  tbody tr.cat-row td{background:#F2F0EA;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#57534E;padding:10px}
</style></head><body>
<div class="page">
  <header class="header">
    <div class="header-row">
      <div class="logo-wrap">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="OPS" class="logo"/>` : `<div class="logo-fallback">OPS</div>`}
      </div>
      <div class="header-text">
        <h1>Mechanic Inspection Report</h1>
        <p class="header-sub">${esc(mechanicName || "Mechanic")}</p>
        <div class="header-meta">
          <span>${esc(site?.name || "Site")}</span>
          <span>${esc(machine?.name || machine?.id || "Machine")}</span>
          <span>${titleDate}</span>
        </div>
      </div>
    </div>
  </header>
  <main class="content">
    <div class="summary">
      <div class="summary-cell highlight">
        <div class="label">Items checked</div>
        <div class="value">${sorted.length}</div>
        <div class="sub">Full machine walk-around</div>
      </div>
      <div class="summary-cell">
        <div class="label">Needs attention</div>
        <div class="value">${flagged.length}</div>
        <div class="sub">${flagged.length ? "Review flagged items below" : "All within normal limits"}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Photos</div>
        <div class="value">${Object.keys(photoUrls).length}</div>
        <div class="sub">Attached to this inspection</div>
      </div>
    </div>
    <div class="timestamps">
      <div class="item"><div class="label">Inspected at</div><div class="value">${fmtDate(batch.timestamp || items[0]?.timestamp)}</div></div>
      <div class="item"><div class="label">Machine</div><div class="value">${esc(machine?.name || "—")}</div></div>
      <div class="item"><div class="label">Reference</div><div class="value">${esc(batch.id || items[0]?.inspection_id || "—")}</div></div>
    </div>
    ${flagged.length ? `<div class="callout">${flagged.length} item(s) flagged for attention — see table below.</div>` : ""}
    <section>
      <h2>Inspection checklist</h2>
      <table><thead><tr><th>Item</th><th>Status</th><th>Remarks</th><th>Photo</th></tr></thead><tbody>
${rows || '<tr class="empty"><td colspan="4">No inspection records</td></tr>'}
      </tbody></table>
    </section>
    ${photoGallery ? `<section><h2>Inspection photos</h2><div class="photos">${photoGallery}</div></section>` : ""}
    <p class="note">Full mechanic inspection recorded in OPS. Photos stored on device and synced when online.</p>
    <footer class="footer">
      <span>OPS Operations · ${esc(site?.name || "Site")}</span>
      <span>Generated ${new Date().toLocaleString("en-ZA")}</span>
    </footer>
  </main>
</div>
</body></html>`;
}

export async function openMechanicInspectionReport(batch, items, { machine, site, mechanicName }) {
  const photoMap = await resolveInspectionPhotoMap(items);
  const photoUrls = Object.fromEntries(Object.entries(photoMap).map(([id, { url }]) => [id, url]));
  const logoUrl = await resolveLogoDataUrl();
  const html = generateMechanicInspectionReportHTML(batch, items, { machine, site, mechanicName, photoUrls, logoUrl });
  const w = window.open("", "_blank");
  if (!w) throw new Error("Pop-up blocked — allow pop-ups to view the inspection report.");
  w.document.write(html);
  w.document.close();
  w.document.title = `Mechanic Inspection · ${machine?.name || "Machine"} · ${fmtDateShort(batch.timestamp || items[0]?.timestamp)}`;
}

export async function printOperationsReport(data, period, machine, site) {
  const logoUrl = await resolveLogoDataUrl();
  const html = generateFullReportHTML(data, period, period.label, machine, site, {
    logoUrl,
    machines: machine ? [machine] : [],
  });
  const w = window.open("", "_blank");
  if (!w) throw new Error("Pop-up blocked — allow pop-ups to view the operations report.");
  w.document.write(html);
  w.document.close();
  w.document.title = `Operations Report · ${period.label}`;
  setTimeout(() => w.print(), 500);
}
