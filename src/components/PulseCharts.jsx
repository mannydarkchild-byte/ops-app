import { formatDurationMinutes } from "../lib/shiftMetrics.js";
import { OWNER_ROLES } from "../lib/stopReasons.js";

const ROLE_COLOR = {
  [OWNER_ROLES.CONTRACTOR]: "#EF4444",
  [OWNER_ROLES.WEAR]: "#F97316",
  [OWNER_ROLES.SITE]: "#F5C518",
};

function ownerColor(role) {
  return ROLE_COLOR[role] || "#A8A59C";
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function donutSlice(cx, cy, rOuter, rInner, start, end) {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, start);
  const [x2, y2] = polar(cx, cy, rOuter, end);
  const [x3, y3] = polar(cx, cy, rInner, end);
  const [x4, y4] = polar(cx, cy, rInner, start);
  return [
    `M ${x1.toFixed(1)} ${y1.toFixed(1)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    `L ${x3.toFixed(1)} ${y3.toFixed(1)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}`,
    "Z",
  ].join(" ");
}

/** Part-to-whole downtime by owner. */
export function OwnerDowntimeChart({ rows = [] }) {
  const slices = (rows || []).filter((row) => Number(row.minutes) > 0);
  const total = slices.reduce((sum, row) => sum + Number(row.minutes || 0), 0);
  if (!slices.length || total <= 0) {
    return <p className="font-body text-sm text-[#F2F0EA]/50">No downtime in this window.</p>;
  }

  const cx = 80;
  const cy = 80;
  const rOuter = 72;
  const rInner = 42;
  let cursor = -Math.PI / 2;
  const paths = slices.map((row) => {
    const sweep = (Number(row.minutes) / total) * Math.PI * 2;
    const start = cursor;
    const end = cursor + Math.max(sweep, 0.02);
    cursor += sweep;
    return { ...row, d: donutSlice(cx, cy, rOuter, rInner, start, end) };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img" aria-label="Downtime by owner">
        {paths.map((row) => (
          <path key={row.owner} d={row.d} fill={ownerColor(row.role)}>
            <title>{`${row.owner} · ${formatDurationMinutes(row.minutes)}`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#F2F0EA" fontSize="14" fontWeight="600">
          {formatDurationMinutes(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#A8A59C" fontSize="10">stopped</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((row) => (
          <li key={row.owner} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ownerColor(row.role) }} />
            <span className="font-body text-sm text-[#F2F0EA] truncate flex-1">{row.owner}</span>
            <span className="font-ui text-sm shrink-0" style={{ color: ownerColor(row.role) }}>
              {formatDurationMinutes(row.minutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars of stop reasons by minutes. */
export function StopReasonChart({ rows = [] }) {
  const bars = (rows || []).filter((row) => Number(row.minutes) > 0);
  if (!bars.length) {
    return <p className="font-body text-sm text-[#F2F0EA]/50">No stops in this window.</p>;
  }
  const max = Math.max(...bars.map((row) => Number(row.minutes) || 0), 1);

  return (
    <div className="space-y-3" role="img" aria-label="Stops by reason">
      {bars.map((row) => {
        const pct = Math.max(4, (Number(row.minutes) / max) * 100);
        const color = ownerColor(row.role);
        return (
          <div key={row.reason}>
            <div className="flex justify-between gap-3 mb-1">
              <p className="font-ui text-sm text-[#F2F0EA] truncate">{row.reason}</p>
              <p className="font-ui text-sm shrink-0" style={{ color }}>{formatDurationMinutes(row.minutes)}</p>
            </div>
            <div className="h-2 rounded-full bg-black/35 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            {row.owner && (
              <p className="font-body text-[11px] text-[#F2F0EA]/45 mt-1">
                {row.owner}{row.count > 1 ? ` · ${row.count} stops` : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
