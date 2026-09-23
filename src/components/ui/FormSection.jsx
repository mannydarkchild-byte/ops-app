/** Clear labelled section so operators know exactly what they are filling in */
export function FormSection({ step, title, description, children, accent = "#F5C518" }) {
  return (
    <section className="border border-ops-border rounded-2xl p-4 mb-4 bg-ops-card shadow-ops-sm">
      {step != null && (
        <p className="font-ui text-xs font-semibold mb-1" style={{ color: accent }}>
          Step {step}
        </p>
      )}
      <h3 className="font-ui text-base font-semibold text-ops-text mb-1">{title}</h3>
      {description && (
        <p className="font-body text-sm text-ops-muted mb-4 leading-relaxed">{description}</p>
      )}
      {children}
    </section>
  );
}
