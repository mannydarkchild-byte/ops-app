/** Clear labelled section so operators know exactly what they are filling in */
export function FormSection({ step, title, description, children, accent = "#F5C518" }) {
  return (
    <section className="form-section border border-ops-border rounded-2xl p-5 mb-4 bg-ops-card shadow-ops-sm">
      {step != null && (
        <p className="font-ui text-base font-semibold mb-1" style={{ color: accent }}>
          Step {step}
        </p>
      )}
      <h3 className="font-ui text-2xl font-semibold text-ops-text mb-2">{title}</h3>
      {description && (
        <p className="font-body text-lg text-ops-muted mb-4 leading-relaxed">{description}</p>
      )}
      {children}
    </section>
  );
}
