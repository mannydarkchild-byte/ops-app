import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { IssueTimeline } from "./IssueTimeline.jsx";
import { ISSUE, issueAreaRequiresMachine } from "../lib/constants.js";
import { issueStatusLabel } from "../lib/issueTimeline.js";
import { canCloseIssue, localDayKey, sameOperatorId } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

const PRIORITY_COLOR = { Critical: "#EF4444", High: "#F97316", Medium: "#F5C518", Low: "#22C55E" };
const AVATAR = ["#F5C518", "#00A4A6", "#F97316", "#A78BFA", "#22C55E", "#EF4444"];
const actionBtn = "w-full py-3 rounded-xl font-ui text-sm font-semibold";

function avatarColor(name) {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash + char.charCodeAt(0)) % AVATAR.length;
  return AVATAR[hash];
}

function initial(name) {
  return (String(name || "?").trim().charAt(0) || "?").toUpperCase();
}

function issueDayLabel(key) {
  if (!key || key === "undated") return "Undated";
  const today = localDayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function groupIssuesByDay(issues) {
  const map = new Map();
  for (const issue of issues) {
    const iso = issue.created_at || issue.updated_at;
    const key = iso ? (localDayKey(iso) || "undated") : "undated";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, rows]) => ({ key, label: issueDayLabel(key), rows }));
}

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

function threadOf(issue, issueMessages) {
  return (issueMessages || [])
    .filter((message) => message.issue_id === issue.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function isUnread(issue, messages, userId) {
  const last = messages[messages.length - 1];
  if (last) return !sameOperatorId(last.sender_id, userId);
  return !sameOperatorId(issue.reporter_id, userId);
}

function Avatar({ name, unread }) {
  return (
    <span
      className="relative w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-ui text-sm font-semibold text-[#0A0A0A]"
      style={{ background: avatarColor(name) }}
      aria-hidden
    >
      {initial(name)}
      {unread && (
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#1A73E8]" />
      )}
    </span>
  );
}

export function IssueInboxModal({
  onClose,
  user,
  issues,
  issueMessages,
  onDone,
  scope = "mine",
  siteId,
  onSendTo,
  onSendToMechanic,
  onMarkPartsOrdered,
  onMarkPartsOnSite,
  machines = [],
  variant = "modal",
  initialIssueId = null,
}) {
  const [selectedId, setSelectedId] = useState(initialIssueId);
  const [openIssueDay, setOpenIssueDay] = useState(null);
  const [reply, setReply] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [busy, setBusy] = useState(false);

  const machineName = (machineId) => {
    if (!machineId) return "Site-wide";
    return machines.find((m) => m.id === machineId)?.name || machineId;
  };

  const filteredIssues = useMemo(() => {
    let list = issues.filter((i) => i.status !== ISSUE.RESOLVED);
    if (scope === "site" && siteId) {
      list = list.filter((i) => i.site_id === siteId);
    } else if (scope === "mine") {
      list = list.filter((i) => i.reporter_id === user.id || i.current_owner_id === user.id);
    } else if (scope === "manager") {
      list = list.filter((issue) => issue.status !== ISSUE.RESOLVED);
    }
    return list.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  }, [issues, scope, siteId, user.id]);

  const selected = filteredIssues.find((i) => i.id === selectedId) || issues.find((i) => i.id === selectedId);
  const threadMessages = useMemo(
    () => issueMessages.filter((m) => m.issue_id === selectedId),
    [issueMessages, selectedId]
  );

  const userCanClose = selected && canCloseIssue(user, selected);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setBusy(true);
    try {
      await wf.addIssueReply(user, selected, reply.trim());
      setReply("");
      await onDone?.();
    } finally { setBusy(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await wf.closeIssue(user, selected, closeNote);
      setCloseNote("");
      setShowClose(false);
      setSelectedId(null);
      await onDone?.();
    } catch (e) {
      alert(e.message);
    } finally { setBusy(false); }
  };

  if (selected) {
    return (
      <Modal title={selected.area} color="red" onClose={() => setSelectedId(null)}>
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={selected.reporter_name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-ui text-sm font-semibold text-[#F2F0EA] truncate">{selected.reporter_name}</p>
              <p className="font-body text-[11px] text-[#F2F0EA]/45 shrink-0">{inboxWhen(selected.created_at)}</p>
            </div>
            <p className="font-body text-xs text-[#F2F0EA]/55 mt-0.5">
              {machineName(selected.machine_id)} · {issueStatusLabel(selected.status)}
            </p>
            <p className="font-ui text-xs mt-1" style={{ color: PRIORITY_COLOR[selected.priority] || "#F5C518" }}>
              {selected.priority} priority
            </p>
          </div>
        </div>

        <p className="text-[15px] text-[#F2F0EA] leading-relaxed mb-4 whitespace-pre-wrap">{selected.description}</p>

        <IssueTimeline issue={selected} messages={threadMessages} variant="mail" />

        {selected.status !== ISSUE.RESOLVED && (
          <div className="space-y-3">
            {!showClose ? (
              <>
                <VoiceInput value={reply} onChange={setReply} placeholder="Reply…" rows={3} />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  className={`${actionBtn} bg-[#1A73E8] text-white disabled:opacity-50`}
                >
                  {busy ? "Sending…" : "Send"}
                </button>

                {onSendTo && (
                  <button
                    type="button"
                    onClick={() => { onSendTo(selected); setSelectedId(null); }}
                    className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                  >
                    Send to someone
                  </button>
                )}
                {onSendToMechanic && issueAreaRequiresMachine(selected.area) && selected.status !== ISSUE.WITH_MECHANIC && selected.status !== ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={() => { onSendToMechanic(selected); setSelectedId(null); }}
                    className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                  >
                    Send to mechanic
                  </button>
                )}
                {onMarkPartsOrdered && selected.status === ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={async () => { setBusy(true); try { await onMarkPartsOrdered(selected); await onDone?.(); } finally { setBusy(false); } }}
                    className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                  >
                    Parts ordered
                  </button>
                )}
                {onMarkPartsOnSite && selected.status === ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={async () => { setBusy(true); try { await onMarkPartsOnSite(selected); await onDone?.(); } finally { setBusy(false); } }}
                    className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                  >
                    Parts on site
                  </button>
                )}
                {userCanClose && (
                  <button
                    type="button"
                    onClick={() => setShowClose(true)}
                    className={`${actionBtn} border border-[#22C55E]/50 text-[#22C55E]`}
                  >
                    Close problem
                  </button>
                )}
              </>
            ) : (
              <>
                <VoiceInput value={closeNote} onChange={setCloseNote} placeholder="Closing note (optional)…" rows={3} />
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={busy}
                  className={`${actionBtn} bg-[#22C55E] text-black disabled:opacity-50`}
                >
                  {busy ? "Closing…" : "Confirm close"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowClose(false); setCloseNote(""); }}
                  className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    );
  }

  const renderIssue = (issue) => {
    const msgs = threadOf(issue, issueMessages);
    const last = msgs[msgs.length - 1];
    const unread = isUnread(issue, msgs, user.id);
    const from = last?.sender_name || issue.reporter_name || "Someone";
    const snippet = (last?.text || issue.description || "").replace(/\s+/g, " ").trim();
    const when = inboxWhen(last?.created_at || issue.updated_at || issue.created_at);
    return (
      <li key={issue.id}>
        <button
          type="button"
          onClick={() => setSelectedId(issue.id)}
          className={`flex w-full items-start gap-3 px-2 py-3 text-left ${unread ? "bg-[#1A73E8]/5" : ""}`}
        >
          <Avatar name={from} unread={unread} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className={`truncate text-[15px] ${unread ? "font-semibold text-[#F2F0EA]" : "font-medium text-[#F2F0EA]/85"}`}>
                {from}
              </p>
              <p className={`shrink-0 text-[11px] ${unread ? "text-[#1A73E8]" : "text-[#F2F0EA]/40"}`}>{when}</p>
            </div>
            <p className={`truncate text-[13px] mt-0.5 ${unread ? "text-[#F2F0EA]" : "text-[#F2F0EA]/70"}`}>
              {issue.area}
              <span className="text-[#F2F0EA]/40"> · {machineName(issue.machine_id)}</span>
            </p>
            <p className="truncate text-[12px] text-[#F2F0EA]/45 mt-0.5">{snippet || issueStatusLabel(issue.status)}</p>
          </div>
          <span
            className="mt-1.5 w-2 h-2 rounded-full shrink-0"
            style={{ background: PRIORITY_COLOR[issue.priority] || "#A8A59C" }}
            title={issue.priority}
          />
        </button>
      </li>
    );
  };

  const issueDays = scope === "manager" ? groupIssuesByDay(filteredIssues) : [];

  const listContent = (
    <div className={`${variant === "modal" ? "max-h-[70vh]" : ""} overflow-y-auto -mx-1`}>
      {filteredIssues.length === 0 && (
        <p className="text-sm text-[#F2F0EA]/50 text-center py-12">Inbox is empty.</p>
      )}
      {scope === "manager" ? (
        <div className="space-y-2">
          {issueDays.map((day) => {
            const open = openIssueDay === day.key;
            const count = day.rows.length;
            return (
              <section key={day.key} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIssueDay(open ? null : day.key)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-body text-sm text-[#F2F0EA]/55">{count} {count === 1 ? "entry" : "entries"}</span>
                    <span className={`text-[#F5C518] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
                  </span>
                </button>
                {open && <ul className="divide-y divide-[#2A2A2A] border-t border-[#2A2A2A]">{day.rows.map(renderIssue)}</ul>}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-[#2A2A2A]">
          {filteredIssues.map(renderIssue)}
        </ul>
      )}
    </div>
  );

  if (variant === "inline") return listContent;

  return (
    <Modal title="Inbox" color="red" onClose={onClose}>
      {listContent}
    </Modal>
  );
}
