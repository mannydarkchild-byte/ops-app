/** Short guide under a chosen option — same pattern as pre-start statuses. */
export function ChoiceHint({ children }) {
  if (!children) return null;
  return (
    <p className="choice-hint font-body text-ops-text leading-snug mt-2 mb-3">
      {children}
    </p>
  );
}

export function statusGuide(guides, value, fallback) {
  if (!value) return "";
  return guides?.[value] || fallback || "This choice is saved on the record.";
}
