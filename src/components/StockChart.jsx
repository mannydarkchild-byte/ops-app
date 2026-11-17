const DAY_MS = 24 * 60 * 60 * 1000;

/** Signed net time. Positive = more running than stopped. */
export function formatNetMinutes(mins) {
  const n = Number(mins) || 0;
  if (Math.abs(n) < 0.5) return "0";
  const m = Math.floor(Math.abs(n));
  const h = Math.floor(m / 60);
  const min = m % 60;
  const body = h > 0 ? (min ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
  return n > 0 ? `+${body}` : `−${body}`;
}

function sameLocalDay(t0, t1) {
  const a = new Date(t0);
  const b = new Date(t1);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function chartAxes(t0, t1) {
  const span = Math.max(0, t1 - t0);
  const multiDay = !sameLocalDay(t0, t1);
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

function niceStep(spanMin) {
  const span = Math.max(1, spanMin);
  const raw = span / 3;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720];
  return steps.find((step) => step >= raw) || Math.ceil(raw / 60) * 60;
}

function yTickValues(minS, maxS) {
  const lo = Math.min(minS, 0);
  const hi = Math.max(maxS, 0);
  const step = niceStep(hi - lo);
  const start = Math.floor(lo / step) * step;
  const values = [];
  for (let v = start; v <= hi + step * 0.01; v += step) values.push(v);
  if (!values.some((v) => Math.abs(v) < 0.01) && lo < -0.5 && hi > 0.5) values.push(0);
  return [...new Set(values.map((v) => Math.round(v * 10) / 10))].sort((a, b) => b - a);
}

function placedYTicks(values, yAt) {
  const ranked = [...values].sort((a, b) => {
    const weight = (v) => (Math.abs(v) < 0.01 ? 0 : 1);
    return weight(a) - weight(b);
  });
  const placed = [];
  for (const value of ranked) {
    const y = yAt(value);
    if (placed.some((row) => Math.abs(row.y - y) < 18)) continue;
    placed.push({ value, y });
  }
  return placed.sort((a, b) => a.y - b.y);
}

function chartLayout(points, width, height) {
  const series = [...points].sort((a, b) => a.t - b.t);
  const scores = series.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(1, ...scores);
  const span = Math.max(1, maxS - minS);
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const tSpan = Math.max(1, t1 - t0);
  const axes = chartAxes(t0, t1);
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 46;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (t) => padL + ((t - t0) / tSpan) * innerW;
  const yAt = (s) => padT + innerH - ((s - minS) / span) * innerH;
  return { series, minS, maxS, t0, tSpan, axes, padL, padR, padT, padB, innerW, innerH, xAt, yAt, zeroY: yAt(0) };
}

function trendSegments(series, xAt, yAt) {
  const segs = [];
  for (let i = 1; i < series.length; i += 1) {
    const a = series[i - 1];
    const b = series[i];
    const falling = b.score < a.score - 0.05;
    segs.push({
      d: `M${xAt(a.t).toFixed(1)},${yAt(a.score).toFixed(1)} L${xAt(b.t).toFixed(1)},${yAt(b.score).toFixed(1)}`,
      color: falling ? "#EF4444" : "#22C55E",
    });
  }
  return segs;
}

function xTicks(t0, tSpan, xAt) {
  const ticks = [];
  for (let i = 0; i < 4; i += 1) {
    const t = t0 + (tSpan * i) / 3;
    ticks.push({ x: xAt(t), t });
  }
  return ticks;
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
  const { series, minS, maxS, t0, tSpan, axes, padL, padR, padT, innerW, innerH, xAt, yAt, zeroY } = chartLayout(points, width, height);
  const segs = trendSegments(series, xAt, yAt);
  const ticks = xTicks(t0, tSpan, xAt);
  const yTicks = placedYTicks(yTickValues(minS, maxS), yAt);
  const end = series[series.length - 1];
  const yTitleY = padT + innerH / 2;

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Running time minus stop time">
      <text x="12" y={yTitleY} fill="#8A877C" fontSize="11" textAnchor="middle" transform={`rotate(-90 12 ${yTitleY})`}>
        {axes.yTitle}
      </text>
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="#2A2A2A" />
      <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#2A2A2A" strokeDasharray="4 4" />
      {yTicks.map((tick) => (
        <text key={tick.value} x={padL - 6} y={tick.y + 3} fill="#A8A59C" fontSize="11" textAnchor="end">
          {formatNetMinutes(tick.value)}
        </text>
      ))}
      {segs.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <circle cx={xAt(end.t)} cy={yAt(end.score)} r="4" fill="#F5C518" stroke="#F2F0EA" strokeWidth="1.5" />
      {ticks.map((tick) => (
        <text key={tick.x} x={tick.x} y={height - 22} textAnchor="middle" fill="#A8A59C" fontSize="11">{formatAxisTime(tick.t, axes)}</text>
      ))}
      <text x={padL + innerW / 2} y={height - 6} textAnchor="middle" fill="#8A877C" fontSize="11">{axes.xTitle}</text>
    </svg>
  );
}

/** HTML string version for daily PDF reports. */
export function stockChartSvgHtml(points, { esc }) {
  if (!points?.length) {
    return `<p class="note">No run/stop timeline on this phone yet for a productivity chart.</p>`;
  }
  const w = 760;
  const h = 280;
  const { series, minS, maxS, t0, tSpan, axes, padL, padR, padT, innerW, innerH, xAt, yAt, zeroY } = chartLayout(points, w, h);
  const segs = trendSegments(series, xAt, yAt)
    .map((seg) => `<path d="${seg.d}" fill="none" stroke="${seg.color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join("");
  const yTicks = placedYTicks(yTickValues(minS, maxS), yAt)
    .map((tick) => `<text x="${padL - 6}" y="${(tick.y + 3).toFixed(1)}" text-anchor="end" class="trend-tick">${esc(formatNetMinutes(tick.value))}</text>`)
    .join("");
  const ticks = xTicks(t0, tSpan, xAt)
    .map((tick) => `<text x="${tick.x.toFixed(1)}" y="${h - 22}" text-anchor="middle" class="trend-tick">${esc(formatAxisTime(tick.t, axes))}</text>`)
    .join("");
  const yTitleY = (padT + innerH / 2).toFixed(1);
  const end = series[series.length - 1];
  return `<svg class="trend-svg stock-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Running time minus stop time">
    <text x="12" y="${yTitleY}" class="trend-tick" text-anchor="middle" transform="rotate(-90 12 ${yTitleY})">${esc(axes.yTitle)}</text>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#D9D7D0"/>
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" stroke="#D9D7D0" stroke-dasharray="4 4"/>
    ${yTicks}
    ${segs}
    <circle cx="${xAt(end.t).toFixed(1)}" cy="${yAt(end.score).toFixed(1)}" r="4" fill="#F5C518" stroke="#1C1917" stroke-width="1.5"/>
    ${ticks}
    <text x="${(padL + innerW / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="trend-tick">${esc(axes.xTitle)}</text>
  </svg>
  <div class="chart-legend">
    <span class="leg-bill">Now ${esc(formatNetMinutes(end.score))}</span>
    <span class="leg-run">Green: running</span>
    <span class="leg-down">Red: stopped</span>
  </div>`;
}
