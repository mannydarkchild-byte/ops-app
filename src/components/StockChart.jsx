import { formatDurationMinutes } from "../lib/shiftMetrics.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Signed net time. Positive = more running than stopped. */
export function formatNetMinutes(mins) {
  const n = Number(mins) || 0;
  if (Math.abs(n) < 0.5) return "0";
  const body = formatDurationMinutes(Math.abs(n));
  return n > 0 ? `+${body}` : `−${body}`;
}

function chartAxes(t0, t1) {
  const span = Math.max(0, t1 - t0);
  const multiDay = span > 36 * 60 * 60 * 1000;
  return {
    multiDay,
    span,
    yTitle: "Running − stopped",
    xTitle: multiDay ? "Date" : "Clock time",
  };
}

function formatAxisTime(t, { multiDay, span }) {
  const d = new Date(t);
  if (!multiDay) {
    return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  }
  if (span < 3 * DAY_MS) {
    return d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function yTickValues(minS, maxS) {
  const values = [maxS];
  if (0 < maxS - 1 && 0 > minS + 1) values.push(0);
  else if (minS >= -0.5) values.push(0);
  if (minS < -0.5) values.push(minS);
  return values;
}

/** Shared stock-style SVG used on Pulse screen and printable reports. */
export function StockChartSvg({ points, width = 760, height = 280, className = "w-full h-auto" }) {
  if (!points?.length) {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-10 text-center">
        <p className="font-body text-[#F2F0EA]/55">No run or stop time in this window yet.</p>
      </div>
    );
  }
  // Always draw left→right in time so the path cannot cross itself.
  const series = [...points].sort((a, b) => a.t - b.t);
  const scores = series.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(1, ...scores);
  const span = Math.max(1, maxS - minS);
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const tSpan = Math.max(1, t1 - t0);
  const axes = chartAxes(t0, t1);
  const padL = 78;
  const padR = 16;
  const padT = 16;
  const padB = 46;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (t) => padL + ((t - t0) / tSpan) * innerW;
  const yAt = (s) => padT + innerH - ((s - minS) / span) * innerH;
  const zeroY = yAt(0);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.t).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(" ");
  const stopMarks = series.filter((p) => p.state === "stopped" && p.reason);
  const tickCount = 4;
  const ticks = [];
  for (let i = 0; i < tickCount; i += 1) {
    const t = t0 + (tSpan * i) / (tickCount - 1);
    ticks.push({
      x: xAt(t),
      label: formatAxisTime(t, axes),
    });
  }
  const yTicks = yTickValues(minS, maxS);
  const end = series[series.length - 1];
  const yTitleY = padT + innerH / 2;

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Running time minus stop time">
      <text x="14" y={yTitleY} fill="#8A877C" fontSize="11" textAnchor="middle" transform={`rotate(-90 14 ${yTitleY})`}>
        {axes.yTitle}
      </text>
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#2A2A2A" strokeDasharray="4 4" />
      {yTicks.map((value) => (
        <text key={value} x={padL - 6} y={yAt(value) + 3} fill="#A8A59C" fontSize="11" textAnchor="end">
          {formatNetMinutes(value)}
        </text>
      ))}
      <path d={path} fill="none" stroke="#F5C518" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      {stopMarks.map((p, i) => (
        <circle key={`${p.t}-${i}`} cx={xAt(p.t)} cy={yAt(p.score)} r="4.5" fill="#EF4444" stroke="#0A0A0A" strokeWidth="1.5">
          <title>{p.reason}{p.minutes != null ? ` · −${formatDurationMinutes(p.minutes)}` : ""}</title>
        </circle>
      ))}
      <circle cx={xAt(end.t)} cy={yAt(end.score)} r="5.5" fill="#F5C518" stroke="#F2F0EA" strokeWidth="1.5" />
      {ticks.map((tick) => (
        <text key={tick.x} x={tick.x} y={height - 22} textAnchor="middle" fill="#A8A59C" fontSize="11">{tick.label}</text>
      ))}
      <text x={padL + innerW / 2} y={height - 6} textAnchor="middle" fill="#8A877C" fontSize="11">{axes.xTitle}</text>
    </svg>
  );
}

/** HTML string version for daily PDF reports. */
export function stockChartSvgHtml(points, { esc, formatDurationMinutes: fmt }) {
  if (!points?.length) {
    return `<p class="note">No run/stop timeline on this phone yet for a productivity chart.</p>`;
  }
  const series = [...points].sort((a, b) => a.t - b.t);
  const scores = series.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(1, ...scores);
  const span = Math.max(1, maxS - minS);
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const tSpan = Math.max(1, t1 - t0);
  const axes = chartAxes(t0, t1);
  const w = 760;
  const h = 280;
  const padL = 78;
  const padR = 16;
  const padT = 16;
  const padB = 46;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xAt = (t) => padL + ((t - t0) / tSpan) * innerW;
  const yAt = (s) => padT + innerH - ((s - minS) / span) * innerH;
  const zeroY = yAt(0);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.t).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(" ");
  const stopMarks = series
    .filter((p) => p.state === "stopped" && p.reason)
    .map((p) => {
      const x = xAt(p.t).toFixed(1);
      const y = yAt(p.score).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#EF4444" stroke="#fff" stroke-width="1.5"><title>${esc(p.reason)} · −${fmt(p.minutes || 0)}</title></circle>`;
    })
    .join("");
  const yTicks = yTickValues(minS, maxS)
    .map((value) => `<text x="${padL - 6}" y="${(yAt(value) + 3).toFixed(1)}" text-anchor="end" class="trend-tick">${esc(formatNetMinutes(value))}</text>`)
    .join("");
  const ticks = [];
  for (let i = 0; i < 4; i += 1) {
    const t = t0 + (tSpan * i) / 3;
    ticks.push(`<text x="${xAt(t).toFixed(1)}" y="${h - 22}" text-anchor="middle" class="trend-tick">${esc(formatAxisTime(t, axes))}</text>`);
  }
  const yTitleY = (padT + innerH / 2).toFixed(1);
  const endScore = series[series.length - 1].score;
  const endLabel = formatNetMinutes(endScore);
  return `<svg class="trend-svg stock-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Running time minus stop time">
    <text x="14" y="${yTitleY}" class="trend-tick" text-anchor="middle" transform="rotate(-90 14 ${yTitleY})">${esc(axes.yTitle)}</text>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" stroke="#D9D7D0" stroke-dasharray="4 4"/>
    ${yTicks}
    <path d="${path}" fill="none" stroke="#1C1917" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
    ${stopMarks}
    <circle cx="${xAt(series[series.length - 1].t).toFixed(1)}" cy="${yAt(endScore).toFixed(1)}" r="5.5" fill="#F5C518" stroke="#1C1917" stroke-width="1.5"/>
    ${ticks.join("")}
    <text x="${(padL + innerW / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="trend-tick">${esc(axes.xTitle)}</text>
  </svg>
  <div class="chart-legend">
    <span class="leg-bill">Now ${esc(endLabel)}</span>
    <span class="leg-run">Up: machine running</span>
    <span class="leg-down">Down: machine stopped</span>
  </div>`;
}
