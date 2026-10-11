import { useMemo, useState } from "react";
import { buildActivityFeed } from "../lib/activityFeed.js";
import { issueStatusLabel } from "../lib/issueTimeline.js";
import { IssueTimeline } from "./IssueTimeline.jsx";
import { Modal } from "./ui/Modal.jsx";

function shortTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function fullWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-[#2A2A2A] last:border-0">
      <p className="font-ui text-xs text-[#F2F0EA]/45">{label}</p>
      <p className="font-body text-base text-[#F2F0EA] mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ActivityDetail({ item, issueMessages }) {
  const source = item.source || {};
  if (item.kind === "issue") {
    const messages = (issueMessages || []).filter((m) => m.issue_id === item.sourceId);
    return (
      <div className="space-y-3">
        <DetailRow label="When" value={fullWhen(item.at)} />
        <DetailRow label="Machine" value={item.machine} />
        <DetailRow label="Reported by" value={item.operator} />
        <DetailRow label="Area" value={source.area} />
        <DetailRow label="Priority" value={source.priority} />
        <DetailRow label="Status" value={issueStatusLabel(source.status)} />
        <DetailRow label="What happened" value={source.description} />
        <IssueTimeline issue={source} messages={messages} />
      </div>
    );
  }
  if (item.kind === "fuel") {
    return (
      <div>
        <DetailRow label="When" value={fullWhen(item.at)} />
        <DetailRow label="Machine" value={item.machine} />
        <DetailRow label="Logged by" value={item.operator} />
        <DetailRow label="Litres" value={source.litres != null ? `${Number(source.litres).toFixed(1)} L` : ""} />
        <DetailRow label="Hour meter" value={source.hour_meter != null ? `${source.hour_meter}h` : ""} />
        <DetailRow label="Tank" value={source.tank_level} />
        <DetailRow label="Note" value={source.note} />
      </div>
    );
  }
  return (
    <div>
      <DetailRow label="When" value={fullWhen(item.at)} />
      <DetailRow label="Machine" value={item.machine} />
      <DetailRow label="Operator" value={item.operator} />
      <DetailRow label="Reason" value={source.reason} />
      <DetailRow label="Note" value={source.note} />
      <DetailRow label="Status" value={source.status && source.status !== "closed" ? source.status : ""} />
    </div>
  );
}

/** One line per event. Tap a row for the full record. */
export function ActivityFeed({ events, fuelLogs, issues, issueMessages = [], machines, siteId, limit = 40 }) {
  const items = useMemo(
    () => buildActivityFeed({ events, fuelLogs, issues, machines, siteId }, { limit }),
    [events, fuelLogs, issues, machines, siteId, limit]
  );
  const [openId, setOpenId] = useState(null);
  const open = items.find((item) => item.id === openId) || null;

  if (!items.length) {
    return <p className="text-sm text-ops-muted text-center py-6">No activity yet today.</p>;
  }

  return (
    <>
      <div className="max-h-[50vh] overflow-y-auto">
        {items.map((item) => {
          const summary = [item.label, item.operator, item.detail].filter(Boolean).join(" · ");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenId(item.id)}
              className="w-full flex items-baseline gap-3 py-2.5 border-b border-ops-border last:border-0 text-left"
            >
              <span className="font-ui text-xs text-ops-muted w-12 shrink-0">{shortTime(item.at)}</span>
              <p className="font-ui text-sm text-ops-text min-w-0 truncate flex-1">{summary}</p>
              <span className="font-ui text-xs text-[#F5C518] shrink-0">Open</span>
            </button>
          );
        })}
      </div>
      {open && (
        <Modal title={open.label} color={open.kind === "issue" ? "red" : "yellow"} onClose={() => setOpenId(null)}>
          <ActivityDetail item={open} issueMessages={issueMessages} />
        </Modal>
      )}
    </>
  );
}
