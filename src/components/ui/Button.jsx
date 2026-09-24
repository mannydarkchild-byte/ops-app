const VARIANT = {
  primary: "bg-ops-gold text-ops-black hover:bg-ops-gold/90 border border-ops-gold/80",
  secondary: "bg-ops-card text-ops-text border border-ops-border hover:border-ops-gold/40",
  ghost: "bg-transparent text-ops-text/80 border border-transparent hover:bg-ops-card hover:border-ops-border",
  danger: "bg-ops-red/15 text-ops-red border border-ops-red/35 hover:bg-ops-red/25",
  sync: "bg-ops-card text-ops-text border border-ops-border hover:border-ops-teal/50",
  teal: "bg-ops-teal text-white border border-ops-teal hover:bg-ops-teal/90",
};

const SIZE = {
  sm: "px-3 py-2 text-sm min-h-[40px] rounded-lg",
  md: "px-4 py-2.5 text-sm min-h-[44px] rounded-xl",
  lg: "px-5 py-4 text-lg min-h-[56px] rounded-2xl",
};

/** Field-friendly button — Inter, sentence case (not Russo caps) */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={`font-ui font-semibold inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none ${VARIANT[variant] || VARIANT.primary} ${SIZE[size] || SIZE.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
