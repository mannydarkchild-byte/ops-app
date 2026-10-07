/** Nested More screen chrome — title + Back, same on every role. */
export function MoreSubpage({ title, onBack, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="ops-chip ops-chip-gold shrink-0"
          aria-label="Back"
        >
          ← Back
        </button>
        {title ? (
          <h2 className="font-ui text-lg font-semibold text-ops-text truncate">{title}</h2>
        ) : null}
      </div>
      {children}
    </div>
  );
}
