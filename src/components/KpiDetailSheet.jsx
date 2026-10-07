import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";

/**
 * Shared drill-down for dashboard KPIs.
 * rows: { id, title, meta?, value?, tone? }[]
 */
export function KpiDetailSheet({
  title,
  summary,
  rows = [],
  empty = "Nothing to show for this period.",
  onClose,
  actionLabel,
  onAction,
}) {
  if (!title) return null;

  return (
    <Modal title={title} color="yellow" onClose={onClose}>
      {summary ? (
        <p className="font-body text-base text-[#F2F0EA]/80 mb-4 leading-relaxed">{summary}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="font-body text-sm text-[#F2F0EA]/50 text-center py-8">{empty}</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-3"
            >
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0">
                  <p className="font-ui text-sm font-semibold text-[#F2F0EA]">{row.title}</p>
                  {row.meta ? (
                    <p className="font-body text-xs text-[#F2F0EA]/55 mt-1 leading-snug">{row.meta}</p>
                  ) : null}
                </div>
                {row.value != null && row.value !== "" ? (
                  <p
                    className="font-logo text-sm shrink-0"
                    style={{ color: row.tone || "#F5C518" }}
                  >
                    {row.value}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {actionLabel && onAction ? (
        <Button type="button" variant="primary" size="lg" className="w-full" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Modal>
  );
}
