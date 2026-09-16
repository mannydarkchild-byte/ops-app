import { buildIssueTimeline, issueStatusLabel } from "../lib/issueTimeline.js";
import { fmtDate } from "../lib/utils.js";

export function IssueTimeline({ issue, messages }) {
  const items = buildIssueTimeline(issue, messages);

  return (
    <div className="mb-4">
      <p className="font-logo text-[10px] text-[#F5C518] mb-2 tracking-wider">
        {issueStatusLabel(issue?.status)}
      </p>
      <div className="relative pl-4 border-l-2 border-[#2A2A2A] space-y-3 max-h-[40vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-[#F2F0EA]/40 py-2">No activity yet</p>
        ) : items.map((item) => (
          <div key={item.id} className="relative">
            <span
              className="absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-[#0A0A0A]"
              style={{ backgroundColor: item.color }}
            />
            <p className="font-logo text-[10px] text-[#F2F0EA]/50">
              {item.label} · {item.who} · {fmtDate(item.at)}
            </p>
            {item.text && (
              <p className="font-body text-sm text-[#F2F0EA]/80 mt-0.5 whitespace-pre-wrap">{item.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
