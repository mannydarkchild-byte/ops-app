import { formatDurationMinutes } from "../lib/shiftMetrics.js";

/** Shared stock-style SVG used on Pulse screen and printable reports. */
export function StockChartSvg({ points, width = 760, height = 240, className = "w-full h-auto" }) {
  if (!points?.length) {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-10 text-center">
        <p className="font-body text-[#F2F0EA]/55">No run or stop time in this window yet.</p>
      </div>
    );
  }
  const scores = points.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(1, ...scores);
  const span = Math.max(1, maxS - minS);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tSpan = Math.max(1, t1 - t0);
  const padL = 44;
  const padR = 14;
  const padT = 18;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (t) => padL + ((t - t0) / tSpan) * innerW;
  const yAt = (s) => padT + innerH - ((s - minS) / span) * innerH;
  const zeroY = yAt(0);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.t).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(" ");
  const stopMarks = points.filter((p) => p.state === "stopped" && p.reason);
  const tickCount = Math.min(6, points.length);
  const ticks = [];
  for (let i = 0; i < tickCount; i += 1) {
    const t = t0 + (tSpan * i) / Math.max(1, tickCount - 1);
    ticks.push({
      x: xAt(t),
      label: new Date(t).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  const end = points[points.length - 1];

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Machine productivity">
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#2A2A2A" strokeDasharray="4 4" />
      <text x="6" y={padT + 10} fill="#6B6960" fontSize="10">{formatDurationMinutes(maxS)}</text>
      <text x="6" y={zeroY} fill="#6B6960" fontSize="10">0</text>
      {minS < 0 && (
        <text x="6" y={padT + innerH} fill="#6B6960" fontSize="10">−{formatDurationMinutes(Math.abs(minS))}</text>
      )}
      <path d={path} fill="none" stroke="#F5C518" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      {stopMarks.map((p, i) => (
        <circle key={`${p.t}-${i}`} cx={xAt(p.t)} cy={yAt(p.score)} r="4.5" fill="#EF4444" stroke="#0A0A0A" strokeWidth="1.5">
          <title>{p.reason}{p.minutes != null ? ` · −${p.minutes}m` : ""}</title>
        </circle>
      ))}
      <circle cx={xAt(end.t)} cy={yAt(end.score)} r="5.5" fill="#F5C518" stroke="#F2F0EA" strokeWidth="1.5" />
      {ticks.map((tick) => (
        <text key={tick.x} x={tick.x} y={height - 10} textAnchor="middle" fill="#6B6960" fontSize="10">{tick.label}</text>
      ))}
    </svg>
  );
}

/** HTML string version for daily PDF reports. */
export function stockChartSvgHtml(points, { esc, formatDurationMinutes: fmt }) {
  if (!points?.length) {
    return `<p class="note">No run/stop timeline on this phone yet for a productivity chart.</p>`;
  }
  const scores = points.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(1, ...scores);
  const span = Math.max(1, maxS - minS);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tSpan = Math.max(1, t1 - t0);
  const w = 760;
  const h = 240;
  const padL = 44;
  const padR = 14;
  const padT = 18;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xAt = (t) => padL + ((t - t0) / tSpan) * innerW;
  const yAt = (s) => padT + innerH - ((s - minS) / span) * innerH;
  const zeroY = yAt(0);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.t).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(" ");
  const stopMarks = points
    .filter((p) => p.state === "stopped" && p.reason)
    .map((p) => {
      const x = xAt(p.t).toFixed(1);
      const y = yAt(p.score).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#EF4444" stroke="#fff" stroke-width="1.5"><title>${esc(p.reason)} · −${p.minutes || 0}m</title></circle>`;
    })
    .join("");
  const tickCount = Math.min(6, points.length);
  const ticks = [];
  for (let i = 0; i < tickCount; i += 1) {
    const t = t0 + (tSpan * i) / Math.max(1, tickCount - 1);
    const label = new Date(t).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
    ticks.push(`<text x="${xAt(t).toFixed(1)}" y="${h - 10}" text-anchor="middle" class="trend-tick">${esc(label)}</text>`);
  }
  const endScore = points[points.length - 1].score;
  const endLabel = endScore >= 0 ? `+${fmt(endScore)} net` : `−${fmt(Math.abs(endScore))} net`;
  return `<svg class="trend-svg stock-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Shift productivity stock chart">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" stroke="#D9D7D0" stroke-dasharray="4 4"/>
    <text x="6" y="${padT + 10}" class="trend-tick">${fmt(maxS)}</text>
    <text x="6" y="${zeroY.toFixed(1)}" class="trend-tick">0</text>
    ${minS < 0 ? `<text x="6" y="${(padT + innerH).toFixed(1)}" class="trend-tick">−${fmt(Math.abs(minS))}</text>` : ""}
    <path d="${path}" fill="none" stroke="#1C1917" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
    ${stopMarks}
    <circle cx="${xAt(points[points.length - 1].t).toFixed(1)}" cy="${yAt(endScore).toFixed(1)}" r="5.5" fill="#F5C518" stroke="#1C1917" stroke-width="1.5"/>
    ${ticks.join("")}
  </svg>
  <div class="chart-legend">
    <span class="leg-bill">End ${esc(endLabel)}</span>
    <span class="leg-run">Climbs while running</span>
    <span class="leg-down">Falls while stopped</span>
  </div>`;
}
