/** Clear labelled section so operators know exactly what they are filling in */
export function FormSection({ step, title, description, children, accent = "#F5C518" }) {
  return (
    <section className="border border-[#2A2A2A] rounded-xl p-4 mb-4 bg-[#0A0A0A]/50">
      {step != null && (
        <p className="font-logo text-[10px] tracking-[0.2em] mb-1" style={{ color: accent }}>
          STEP {step}
        </p>
      )}
      <h3 className="font-logo text-sm sm:text-base tracking-wider text-[#F2F0EA] uppercase mb-1">{title}</h3>
      {description && (
        <p className="font-body text-xs text-[#F2F0EA]/55 mb-4 leading-relaxed">{description}</p>
      )}
      {children}
    </section>
  );
}
