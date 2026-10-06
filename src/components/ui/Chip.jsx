/** Filter or attention chip — always a real tap target. */
export function Chip({
  children,
  onClick,
  selected = false,
  tone = "default",
  className = "",
  type = "button",
  ...props
}) {
  const toneClass =
    tone === "attention" ? "ops-chip-attention"
      : tone === "gold" ? "ops-chip-gold"
        : tone === "warn" ? "ops-chip-warn"
          : tone === "danger" ? "ops-chip-danger"
            : "";

  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={selected || undefined}
      className={`ops-chip ${selected ? "ops-chip-on" : ""} ${toneClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
