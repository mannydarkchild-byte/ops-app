import { ISSUE } from "./constants.js";

const TYPE_META = {
  report: { icon: "●", label: "Problem reported", color: "#EF4444" },
  reply: { icon: "💬", label: "Reply", color: "#F2F0EA" },
  delegation: { icon: "→", label: "Sent to", color: "#00A4A6" },
  repair_job: { icon: "🔧", label: "Repair job opened", color: "#00A4A6" },
  parts_request: { icon: "📦", label: "Parts requested", color: "#F97316" },
  parts_ordered: { icon: "🛒", label: "Manager: parts ordered", color: "#F5C518" },
  parts_on_site: { icon: "✓", label: "Manager: parts on site", color: "#22C55E" },
  repair_done: { icon: "🔧", label: "Repair finished", color: "#22C55E" },
  resolution: { icon: "✓", label: "Note", color: "#22C55E" },
  closed: { icon: "✓", label: "Problem closed", color: "#22C55E" },
};

export function issueStatusLabel(status) {
  const labels = {
    [ISSUE.OPEN]: "Open",
    [ISSUE.IN_PROGRESS]: "With assignee",
    [ISSUE.WITH_MECHANIC]: "With mechanic",
    [ISSUE.WAITING_FOR_PARTS]: "Waiting for parts",
    [ISSUE.REPAIR_DONE]: "Repair done — close when sorted",
    [ISSUE.RESOLVED]: "Closed",
  };
  return labels[status] || status?.replace(/_/g, " ") || "Open";
}

export function buildIssueTimeline(issue, messages) {
  const items = (messages || [])
    .filter((m) => m.issue_id === issue?.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((m) => {
      const meta = TYPE_META[m.type] || { icon: "•", label: m.type?.replace(/_/g, " ") || "Update", color: "#F2F0EA" };
      return {
        id: m.id,
        at: m.created_at,
        icon: meta.icon,
        label: meta.label,
        color: meta.color,
        who: m.sender_name,
        text: m.text,
      };
    });

  return items;
}
