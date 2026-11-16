import { buildIssueTimeline, issueStatusLabel } from "../lib/issueTimeline.js";
import { fmtDate } from "../lib/utils.js";

function inboxWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function IssueTimeline({ issue, messages, variant = "card" }) {
  const items = buildIssueTimeline(issue, messages);

  if (variant === "mail") {
    if (!items.length) return null;
    return (
      <div className="mb-4 border-t border-[#2A2A2A] pt-3 space-y-4">
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-ui text-sm font-semibold text-[#F2F0EA] truncate">{item.who || item.label}</p>
              <p className="font-body text-[11px] text-[#F2F0EA]/40 shrink-0">{inboxWhen(item.at)}</p>
            </div>
            {item.who && item.label !== "Reply" && (
              <p className="font-body text-[11px] text-[#F2F0EA]/45 mt-0.5">{item.label}</p>
            )}
            {item.text && (
              <p className="text-[14px] text-[#F2F0EA]/85 mt-1.5 leading-relaxed whitespace-pre-wrap">{item.text}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 border border-[#2A2A2A] rounded-xl overflow-hidden">
      <p className="px-4 py-3 bg-[#0A0A0A] font-logo text-sm text-[#F5C518] border-b border-[#2A2A2A]">
        History · {issueStatusLabel(issue?.status)}
      </p>
      <div className="max-h-[45vh] overflow-y-auto divide-y divide-[#2A2A2A]">
        {items.length === 0 ? (
          <p className="text-base text-[#F2F0EA]/50 px-4 py-6 text-center">No activity yet</p>
        ) : items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <p className="text-sm text-[#F2F0EA]/50">{fmtDate(item.at)}</p>
            <p className="text-base text-[#F2F0EA] mt-1">{item.label}</p>
            <p className="text-sm text-[#F5C518]/80 mt-0.5">{item.who}</p>
            {item.text && (
              <p className="text-base text-[#F2F0EA]/85 mt-2 leading-relaxed whitespace-pre-wrap">{item.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
