/** Summary number tile — tappable when onClick is set (opens a detail sheet). */
export function KpiTile({ label, value, sub, color = "#F2F0EA", onClick, className = "" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl p-3 sm:p-4 border text-left w-full ${onClick ? "cursor-pointer active:scale-[0.99]" : ""} ${className}`}
      style={{ background: "var(--ops-gold-wash)", borderColor: "var(--ops-gold-line)" }}
      aria-label={onClick ? `${label}: ${value}. Tap for details.` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">{label}</p>
        {onClick ? (
          <span className="font-logo text-sm text-[#F5C518] leading-none shrink-0" aria-hidden>›</span>
        ) : null}
      </div>
      <p className="font-logo text-xl sm:text-2xl mt-1" style={{ color }}>{value}</p>
      {sub ? <p className="font-body text-[10px] sm:text-xs text-[#F2F0EA]/45 mt-1">{sub}</p> : null}
      {onClick ? (
        <p className="font-ui text-[10px] text-[#F5C518]/80 mt-1.5">Tap for details</p>
      ) : null}
    </Tag>
  );
}

/** @deprecated Alias — prefer KpiTile */
export function Kpi(props) {
  return <KpiTile {...props} />;
}
