/** One settings-style list. Gold is only the cue, not a filled button. */
export function MoreMenu({ items }) {
  return (
    <div className="ops-menu">
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick} className="ops-menu-row">
          <span>{item.label}</span>
          <span className="ops-menu-chevron" aria-hidden>›</span>
        </button>
      ))}
    </div>
  );
}
