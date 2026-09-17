import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { IssueTimeline } from "./IssueTimeline.jsx";
import { ISSUE, issueAreaRequiresMachine } from "../lib/constants.js";
import { issueStatusLabel } from "../lib/issueTimeline.js";
import { canCloseIssue, fmtDate } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

const PRIORITY_COLOR = { Critical: "#EF4444", High: "#F97316", Medium: "#F5C518", Low: "#22C55E" };

const actionBtn = "w-full py-4 rounded-xl font-logo text-base font-bold";

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
      list = list.filter(
        (i) => i.reporter_id === user.id || i.current_owner_id === user.id || i.status === ISSUE.WAITING_FOR_PARTS
      );
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
        <div className="space-y-2 mb-4">
          <p className="text-base font-logo" style={{ color: PRIORITY_COLOR[selected.priority] || "#F5C518" }}>
            {selected.priority} priority
          </p>
          <p className="text-base text-[#F2F0EA]/70">{issueStatusLabel(selected.status)}</p>
          <p className="text-base text-[#F2F0EA]/70">{machineName(selected.machine_id)}</p>
          <p className="text-sm text-[#F2F0EA]/50">Reported by {selected.reporter_name}</p>
        </div>

        <p className="text-base text-[#F2F0EA] leading-relaxed mb-4">{selected.description}</p>

        <IssueTimeline issue={selected} messages={threadMessages} />

        {selected.status !== ISSUE.RESOLVED && (
          <div className="space-y-3">
            {!showClose ? (
              <>
                <VoiceInput value={reply} onChange={setReply} placeholder="Type a reply…" rows={3} />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  className={`${actionBtn} bg-[#EF4444] text-white disabled:opacity-50`}
                >
                  {busy ? "SENDING…" : "SEND REPLY"}
                </button>

                {onSendTo && (
                  <button
                    type="button"
                    onClick={() => { onSendTo(selected); setSelectedId(null); }}
                    className={`${actionBtn} border-2 border-[#00A4A6] text-[#00A4A6]`}
                  >
                    SEND TO SOMEONE
                  </button>
                )}
                {onSendToMechanic && issueAreaRequiresMachine(selected.area) && selected.status !== ISSUE.WITH_MECHANIC && selected.status !== ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={() => { onSendToMechanic(selected); setSelectedId(null); }}
                    className={`${actionBtn} border-2 border-[#F5C518] text-[#F5C518]`}
                  >
                    SEND TO MECHANIC
                  </button>
                )}
                {onMarkPartsOrdered && selected.status === ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={async () => { setBusy(true); try { await onMarkPartsOrdered(selected); await onDone?.(); } finally { setBusy(false); } }}
                    className={`${actionBtn} border-2 border-[#F5C518] text-[#F5C518]`}
                  >
                    PARTS ORDERED
                  </button>
                )}
                {onMarkPartsOnSite && selected.status === ISSUE.WAITING_FOR_PARTS && (
                  <button
                    type="button"
                    onClick={async () => { setBusy(true); try { await onMarkPartsOnSite(selected); await onDone?.(); } finally { setBusy(false); } }}
                    className={`${actionBtn} border-2 border-[#22C55E] text-[#22C55E]`}
                  >
                    PARTS ON SITE
                  </button>
                )}
                {userCanClose && (
                  <button
                    type="button"
                    onClick={() => setShowClose(true)}
                    className={`${actionBtn} border-2 border-[#22C55E] text-[#22C55E]`}
                  >
                    CLOSE PROBLEM
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
                  {busy ? "CLOSING…" : "CONFIRM CLOSE"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowClose(false); setCloseNote(""); }}
                  className={`${actionBtn} border border-[#2A2A2A] text-[#F2F0EA]`}
                >
                  CANCEL
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    );
  }

  const listContent = (
    <>
      {filteredIssues.length > 0 && (
        <p className="font-logo text-sm text-[#F5C518] mb-3">{filteredIssues.length} open problem(s)</p>
      )}
      <div className={`${variant === "modal" ? "max-h-[70vh]" : ""} overflow-y-auto space-y-3`}>
        {filteredIssues.length === 0 && (
          <p className="text-base text-[#F2F0EA]/50 text-center py-10">No open problems.</p>
        )}
        {filteredIssues.map((issue) => {
          const msgs = issueMessages.filter((m) => m.issue_id === issue.id);
          const last = msgs[msgs.length - 1];
          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => setSelectedId(issue.id)}
              className="block w-full text-left bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 active:bg-[#1A1A1A]"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <span className="font-logo text-base text-[#F2F0EA] leading-snug">{issue.area}</span>
                <span className="font-logo text-sm shrink-0" style={{ color: PRIORITY_COLOR[issue.priority] }}>
                  {issue.priority}
                </span>
              </div>
              <p className="text-base text-[#F2F0EA]/75 leading-relaxed line-clamp-3 mb-2">{issue.description}</p>
              <p className="text-sm text-[#F2F0EA]/50">{issueStatusLabel(issue.status)} · {machineName(issue.machine_id)}</p>
              <p className="text-sm text-[#F2F0EA]/40 mt-1">{last ? fmtDate(last.created_at) : fmtDate(issue.created_at)}</p>
            </button>
          );
        })}
      </div>
    </>
  );

  if (variant === "inline") return listContent;

  return (
    <Modal title="PROBLEMS" color="red" onClose={onClose}>
      {listContent}
    </Modal>
  );
}
