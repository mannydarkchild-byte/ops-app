import { buildIssueTimeline, issueStatusLabel } from "../lib/issueTimeline.js";
import { fmtDate } from "../lib/utils.js";

export function IssueTimeline({ issue, messages }) {
  const items = buildIssueTimeline(issue, messages);

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
