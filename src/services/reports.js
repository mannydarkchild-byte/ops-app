import { SHIFT } from "../lib/constants.js";
import { resolveMediaUrl } from "../lib/media.js";
import { buildShiftActivityTimeline, consolidateShiftStops, formatDurationMinutes } from "../lib/shiftMetrics.js";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
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
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:#F2F0EA;color:#2A2A2A;line-height:1.5;font-size:14px;-webkit-font-smoothing:antialiased}
  .font-brand{font-family:'Russo One',sans-serif;letter-spacing:.04em}
  .page{max-width:880px;margin:24px auto;background:#fff;border:1px solid #D9D7D0;min-height:calc(100vh - 48px)}
  .header{padding:28px 36px 22px;border-bottom:4px solid #F5C518}
  .header-row{display:flex;align-items:center;gap:20px}
  .logo-wrap{flex-shrink:0}
  .logo{width:72px;height:72px;border-radius:12px;border:2px solid #F5C518;object-fit:contain;background:#fff;padding:6px;display:block}
  .logo-fallback{width:72px;height:72px;border-radius:12px;border:2px solid #F5C518;background:#FFFBEB;color:#F5C518;font-size:16px;display:flex;align-items:center;justify-content:center}
  .header-text{flex:1;min-width:0}
  .header h1{margin:0;font-size:22px;color:#2A2A2A;text-transform:uppercase;line-height:1.15}
  .header-sub{margin:6px 0 0;font-size:18px;color:#1C1917}
  .header-meta{margin-top:8px;font-size:13px;color:#57534E;display:flex;flex-wrap:wrap;gap:6px 16px}
  .content{padding:24px 36px 40px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .summary-cell{background:#FAFAF7;border:1px solid #E8E6E0;border-radius:12px;padding:16px 18px}
  .summary-cell.highlight{background:#FFFBEB;border-color:#F5C518}
  .summary-cell .label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B6960;margin-bottom:4px}
  .summary-cell .value{font-size:28px;color:#1C1917;line-height:1.1}
  .summary-cell.highlight .value{color:#15803D}
  .summary-cell .sub{font-size:13px;color:#57534E;margin-top:6px}
  .timestamps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
  .timestamps .item{background:#FAFAF7;border-radius:10px;padding:12px 14px}
  .timestamps .item .label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B6960;margin-bottom:4px}
  .timestamps .item .value{font-size:14px;color:#1C1917}
  section{margin-bottom:28px}
  section h2{margin:0 0 12px;font-size:15px;text-transform:uppercase;color:#1C1917;padding-bottom:6px;border-bottom:2px solid #F5C518}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;padding:8px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#57534E;background:#F2F0EA;border-bottom:2px solid #F5C518}
  tbody td{padding:10px;border-bottom:1px solid #E8E6E0;vertical-align:top}
  .empty td{text-align:center;color:#6B6960;font-style:italic;padding:16px}
  .callout{padding:14px 16px;background:#FFFBEB;border-left:4px solid #F5C518;margin-bottom:20px;font-size:14px;color:#44403C}
  .footer{margin-top:28px;padding-top:14px;border-top:1px solid #E8E6E0;font-size:12px;color:#6B6960;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .note{font-size:13px;color:#6B6960;margin-top:10px;line-height:1.45}
  .chart-bar{display:flex;height:22px;border-radius:999px;overflow:hidden;background:#E8E6E0}
  .chart-bar-run{background:#22C55E}
  .chart-bar-down{background:#EF4444}
  .chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:13px}
  .leg-run::before,.leg-down::before{content:"";display:inline-block;width:10px;height:10px;border-radius:99px;margin-right:6px}
  .leg-run::before{background:#22C55E}
  .leg-down::before{background:#EF4444}
  .hbar{margin:8px 0 12px}
  .hbar-label{display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:4px}
  .hbar-track{height:12px;background:#F2F0EA;border-radius:99px;overflow:hidden}
  .hbar-fill{height:100%;background:#EF4444;border-radius:99px}
  .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  .tile{border-radius:12px;padding:12px;text-align:center;border:1px solid #E8E6E0}
  .tile strong{display:block;font-size:24px;line-height:1.1}
  .tile span{font-size:12px;color:#57534E}
  .tile-ok{background:#ECFDF5}
  .tile-act{background:#FFFBEB}
  .tile-bad{background:#FEF2F2}
  @media print{body{background:#fff}.page{margin:0;border:none;max-width:100%}}
  @media (max-width:640px){
    .header,.content{padding:18px}
    .summary,.timestamps,.tiles{grid-template-columns:1fr}
  }`;
}

function runStopChart(runtimeMin, downtimeMin) {
  const run = Math.max(0, Number(runtimeMin || 0));
  const down = Math.max(0, Number(downtimeMin || 0));
  const total = Math.max(1, run + down);
  return `<div class="chart-bar" role="img" aria-label="Runtime versus downtime">
    <span class="chart-bar-run" style="width:${(run / total) * 100}%"></span>
    <span class="chart-bar-down" style="width:${(down / total) * 100}%"></span>
  </div>
  <div class="chart-legend">
    <span class="leg-run">Running ${formatDurationMinutes(run)}</span>
    <span class="leg-down">Stopped ${formatDurationMinutes(down)}</span>
  </div>`;
}

function downtimeReasonChart(stops) {
  const byReason = {};
  for (const s of stops) {
    const key = s.reason || "Other";
    byReason[key] = (byReason[key] || 0) + Number(s.downtime_minutes || 0);
  }
  const rows = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map(([, min]) => min));
  return rows.map(([reason, min]) => `<div class="hbar">
    <div class="hbar-label"><span>${esc(reason)}</span><strong>${formatDurationMinutes(min)}</strong></div>
    <div class="hbar-track"><div class="hbar-fill" style="width:${(min / max) * 100}%"></div></div>
  </div>`).join("");
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
  const { milestones, periods } = buildShiftActivityTimeline(shift, events);
  const stops = consolidateShiftStops(events, shift);
  const shiftFuel = fuelLogs.filter((f) => f.shift_id === shift.id);
  const prestart = shiftPrestart(inspections, shift);
  const titleDate = fmtDateShort(shift.started_at);

  const timelineItems = [
    ...milestones.map((m) => ({ kind: "milestone", at: new Date(m.at).getTime(), ...m })),
    ...periods.filter((p) => p.state === "stopped").map((p) => ({ kind: "period", at: p.start, ...p })),
  ].sort((a, b) => a.at - b.at);

  const timelineRows = timelineItems.map((item) => {
    if (item.kind === "milestone") {
      return `<tr><td>${fmtDate(item.at)}</td><td>${esc(item.label)}</td><td colspan="2">${esc(item.detail || "—")}</td></tr>`;
    }
    const range = `${fmtDate(new Date(item.start).toISOString())} – ${fmtDate(new Date(item.end).toISOString())}`;
    if (item.state === "stopped") {
      return `<tr><td>${range}</td><td>Stopped</td><td>${esc(item.reason || "Downtime")}</td><td>${formatDurationMinutes(item.minutes)}${item.note ? ` · ${esc(item.note)}` : ""}</td></tr>`;
    }
    return `<tr><td>${range}</td><td>Running</td><td>—</td><td>${formatDurationMinutes(item.minutes)}</td></tr>`;
  }).join("");

  const statusBadge = (status) => {
    const s = (status || "").toLowerCase();
    const cls = s.includes("fail") || s.includes("no") ? "badge-warn" : s.includes("pass") || s.includes("ok") ? "badge-ok" : "badge-neutral";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  };

  const prestartOk = prestart.filter((i) => /^ok$/i.test(i.status || "")).length;
  const prestartAction = prestart.filter((i) => /action/i.test(i.status || "")).length;
  const prestartBad = prestart.filter((i) => /attention|need|fail/i.test(i.status || "")).length;
  const prestartProblems = prestart.filter((i) => !/^ok$/i.test(i.status || ""));
  const downtimeChart = downtimeReasonChart(stops);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Daily Report · ${esc(shift.operator_name)} · ${titleDate}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Russo+One&display=swap" rel="stylesheet"/>
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
        <h1 class="font-brand">Daily Shift Report</h1>
        <p class="header-sub font-brand">${esc(shift.operator_name || "Operator")}</p>
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
        <div class="value font-brand">${Number(shift.hours_worked || 0).toFixed(1)}h</div>
        <div class="sub">Meter ${shift.start_hour_meter}h → ${shift.end_hour_meter}h</div>
      </div>
      <div class="summary-cell">
        <div class="label">Runtime</div>
        <div class="value font-brand">${formatDurationMinutes(shift.runtime_minutes || 0)}</div>
        <div class="sub">App-tracked</div>
      </div>
      <div class="summary-cell">
        <div class="label">Downtime</div>
        <div class="value font-brand">${formatDurationMinutes(shift.downtime_minutes || 0)}</div>
        <div class="sub">App-tracked</div>
      </div>
    </div>

    <div class="timestamps">
      <div class="item"><div class="label">Shift started</div><div class="value">${fmtDate(shift.started_at)}</div></div>
      <div class="item"><div class="label">Shift ended</div><div class="value">${fmtDate(shift.ended_at)}</div></div>
      <div class="item"><div class="label">Verified</div><div class="value">${fmtDate(shift.verified_at || shift.ended_at)}</div></div>
    </div>

    <section>
      <h2 class="font-brand">How the machine ran</h2>
      ${runStopChart(shift.runtime_minutes, shift.downtime_minutes)}
    </section>

    <section>
      <h2 class="font-brand">Pre-start</h2>
      ${prestart.length ? `<div class="tiles">
        <div class="tile tile-ok"><strong class="font-brand">${prestartOk}</strong><span>OK</span></div>
        <div class="tile tile-act"><strong class="font-brand">${prestartAction}</strong><span>Action taken</span></div>
        <div class="tile tile-bad"><strong class="font-brand">${prestartBad}</strong><span>Needs attention</span></div>
      </div>` : ""}
      <table><thead><tr><th>Item</th><th>Status</th><th>Remarks</th></tr></thead><tbody>
${prestartProblems.length
    ? prestartProblems.map((i) => `<tr><td>${esc(i.item_name)}</td><td>${statusBadge(i.status)}</td><td>${esc(i.remark || "—")}</td></tr>`).join("")
    : prestart.length
      ? '<tr class="empty"><td colspan="3">All pre-start items were OK</td></tr>'
      : '<tr class="empty"><td colspan="3">No pre-start records on this device</td></tr>'}
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
      <h2 class="font-brand">What happened</h2>
      <table><thead><tr><th>Time</th><th>Event</th><th>Detail</th><th>Duration</th></tr></thead><tbody>
${timelineRows || '<tr class="empty"><td colspan="4">No activity logged</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2 class="font-brand">Downtime</h2>
      ${downtimeChart || ""}
      <table><thead><tr><th>Reason</th><th>Stopped</th><th>Duration</th><th>Notes</th></tr></thead><tbody>
${stops.length
    ? stops.map((s) => {
      const endLabel = s.restarted_at ? fmtDate(s.restarted_at) : (shift.ended_at ? fmtDate(shift.ended_at) : "—");
      return `<tr><td>${esc(s.reason)}</td><td>${fmtDate(s.stopped_at)}${s.restarted_at ? ` → ${endLabel}` : ""}</td><td>${formatDurationMinutes(s.downtime_minutes || 0)}</td><td>${esc(s.note || "")}</td></tr>`;
    }).join("")
    : '<tr class="empty"><td colspan="4">No stops recorded</td></tr>'}
      </tbody></table>
    </section>

    <section>
      <h2 class="font-brand">Diesel</h2>
      <table><thead><tr><th>Time</th><th>Litres</th><th>Meter</th><th>Tank</th><th>Note</th></tr></thead><tbody>
${shiftFuel.length
    ? shiftFuel.map((f) => `<tr><td>${fmtDate(f.timestamp)}</td><td>${Number(f.litres || 0).toFixed(1)} L</td><td>${f.hour_meter}h</td><td>${esc(f.tank_level || "—")}</td><td>${esc(f.note || "")}</td></tr>`).join("")
    : '<tr class="empty"><td colspan="5">No diesel logged this shift</td></tr>'}
      </tbody></table>
    </section>

    ${(openingPhotoUrl || closingPhotoUrl) ? `<section>
      <h2 class="font-brand">Hour meter photos</h2>
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

export async function prepareShiftDailyReport(shift, { events, inspections, fuelLogs, machine, site }) {
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

  return {
    html,
    title: `Daily Report · ${shift.operator_name} · ${fmtDateShort(shift.started_at)}`,
  };
}

/** Returns { html, title } for in-app full-screen viewer */
export async function openShiftDailyReport(shift, ctx) {
  return prepareShiftDailyReport(shift, ctx);
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

export async function prepareOperationsReport(data, period, machine, site) {
  const logoUrl = await resolveLogoDataUrl();
  const html = generateFullReportHTML(data, period, period.label, machine, site, {
    logoUrl,
    machines: machine ? [machine] : [],
  });
  return { html, title: `Operations Report · ${period.label}` };
}

/** Returns { html, title } for in-app full-screen viewer */
export async function printOperationsReport(data, period, machine, site) {
  return prepareOperationsReport(data, period, machine, site);
}

export function generateTimesheetReportHTML(workSessions, period, site, { logoUrl, machines = [] } = {}) {
  const periodLabel = period?.label || "All time";
  const rows = buildTimesheetRows(workSessions, { siteId: site?.id, period: period || null });
  const summary = summarizeTimesheet(rows);
  const machineName = (id) => machines.find((m) => m.id === id)?.name || "—";

  const operatorRows = summary.byOperator
    .map((op) => `<tr>
      <td>${esc(op.operator_name)}</td>
      <td>${op.sessions}</td>
      <td>${op.hours.toFixed(1)}h</td>
      <td>${op.leftEarly}</td>
    </tr>`)
    .join("") || `<tr class="empty"><td colspan="4">No operators in this period.</td></tr>`;

  const sessionRows = rows
    .map((r) => `<tr>
      <td>${esc(r.operator_name || "Operator")}</td>
      <td>${esc(r.dateLabel)}</td>
      <td>${esc(r.inLabel)}</td>
      <td>${esc(r.outLabel)}</td>
      <td>${r.hours.toFixed(1)}h</td>
      <td>${esc(r.statusLabel)}</td>
      <td>${esc(machineName(r.machine_id))}</td>
      <td>${esc(r.notes || "—")}</td>
    </tr>`)
    .join("") || `<tr class="empty"><td colspan="8">No clock-in records for this period.</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Timesheet · ${esc(periodLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Russo+One&display=swap" rel="stylesheet"/>
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
        <h1>Timesheet</h1>
        <p class="header-sub">${esc(periodLabel)}</p>
        <div class="header-meta">
          <span>${esc(site?.name || "Site")}</span>
          <span>Clock-in to clock-out</span>
        </div>
      </div>
    </div>
  </header>

  <main class="content">
    <div class="summary">
      <div class="summary-cell highlight">
        <div class="label">Hours on site</div>
        <div class="value">${summary.hours.toFixed(1)}h</div>
        <div class="sub">${summary.sessions} session${summary.sessions !== 1 ? "s" : ""}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Clocked out</div>
        <div class="value">${summary.ended}</div>
        <div class="sub">Ended after a shift</div>
      </div>
      <div class="summary-cell">
        <div class="label">Left without starting</div>
        <div class="value">${summary.leftEarly}</div>
        <div class="sub">Clocked out before machine start</div>
      </div>
      <div class="summary-cell">
        <div class="label">Still on site</div>
        <div class="value">${summary.onSite}</div>
        <div class="sub">Open clock-in now</div>
      </div>
    </div>

    <p class="callout">Hours are time on site (clock-in → clock-out). Machine billable hours stay on the operations report.</p>

    <section>
      <h2>By operator</h2>
      <table>
        <thead><tr><th>Operator</th><th>Sessions</th><th>Hours</th><th>Left early</th></tr></thead>
        <tbody>${operatorRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Clock-in / clock-out</h2>
      <table>
        <thead><tr><th>Operator</th><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Machine</th><th>Note</th></tr></thead>
        <tbody>${sessionRows}</tbody>
      </table>
    </section>

    <footer class="footer">
      <span>OPS timesheet · ${esc(site?.name || "Site")}</span>
      <span>Created ${esc(fmtDate(new Date().toISOString()))}</span>
    </footer>
  </main>
</div>
</body></html>`;
}

export async function printTimesheetReport(workSessions, period, site, machines = []) {
  const logoUrl = await resolveLogoDataUrl();
  const label = period?.label || "All time";
  const html = generateTimesheetReportHTML(workSessions, period, site, { logoUrl, machines });
  return { html, title: `Timesheet · ${label}` };
}
