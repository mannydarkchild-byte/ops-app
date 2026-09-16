import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { IssueTimeline } from "./IssueTimeline.jsx";
import { ISSUE, issueAreaRequiresMachine } from "../lib/constants.js";
import { issueStatusLabel } from "../lib/issueTimeline.js";
import { canCloseIssue, fmtDate } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

const PRIORITY_COLOR = { Critical: "#EF4444", High: "#F97316", Medium: "#F5C518", Low: "#22C55E" };

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
      <Modal title={`PROBLEM · ${selected.area}`} color="red" onClose={() => setSelectedId(null)}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-logo" style={{ backgroundColor: `${PRIORITY_COLOR[selected.priority] || "#F5C518"}22`, color: PRIORITY_COLOR[selected.priority] }}>
            {selected.priority}
          </span>
          <span className="text-[10px] text-[#F2F0EA]/40 font-logo">{issueStatusLabel(selected.status)}</span>
          <span className="text-[10px] text-[#F2F0EA]/40 font-logo">· {machineName(selected.machine_id)}</span>
        </div>
        <p className="font-body text-sm text-[#F2F0EA]/80 mb-2">{selected.description}</p>
        <p className="text-[10px] text-[#F2F0EA]/40 mb-4">Reported by {selected.reporter_name}</p>

        <IssueTimeline issue={selected} messages={threadMessages} />

        {selected.status !== ISSUE.RESOLVED && (
          <>
            {!showClose ? (
              <>
                <VoiceInput value={reply} onChange={setReply} placeholder="Reply…" rows={2} />
                <button onClick={sendReply} disabled={busy || !reply.trim()} className="w-full mt-3 bg-[#EF4444] text-white py-3 rounded font-logo font-bold disabled:opacity-50">
                  {busy ? "SENDING…" : "SEND REPLY"}
                </button>
                <div className="flex flex-wrap gap-2 mt-3">
                  {onSendTo && (
                    <button type="button" onClick={() => { onSendTo(selected); setSelectedId(null); }}
                      className="flex-1 min-w-[120px] border border-[#00A4A6] text-[#00A4A6] py-2.5 rounded-lg font-logo text-xs tracking-wider">
                      SEND TO…
                    </button>
                  )}
                  {onSendToMechanic && issueAreaRequiresMachine(selected.area) && selected.status !== ISSUE.WITH_MECHANIC && selected.status !== ISSUE.WAITING_FOR_PARTS && (
                    <button type="button" onClick={() => { onSendToMechanic(selected); setSelectedId(null); }}
                      className="flex-1 min-w-[120px] border border-[#F5C518] text-[#F5C518] py-2.5 rounded-lg font-logo text-xs tracking-wider">
                      SEND TO MECHANIC
                    </button>
                  )}
                  {onMarkPartsOrdered && selected.status === ISSUE.WAITING_FOR_PARTS && (
                    <button type="button" onClick={async () => { setBusy(true); try { await onMarkPartsOrdered(selected); await onDone?.(); } finally { setBusy(false); } }}
                      className="flex-1 min-w-[120px] border border-[#F5C518] text-[#F5C518] py-2.5 rounded-lg font-logo text-xs tracking-wider">
                      PARTS ORDERED
                    </button>
                  )}
                  {onMarkPartsOnSite && selected.status === ISSUE.WAITING_FOR_PARTS && (
                    <button type="button" onClick={async () => { setBusy(true); try { await onMarkPartsOnSite(selected); await onDone?.(); } finally { setBusy(false); } }}
                      className="flex-1 min-w-[120px] border border-[#22C55E] text-[#22C55E] py-2.5 rounded-lg font-logo text-xs tracking-wider">
                      PARTS ON SITE
                    </button>
                  )}
                  {userCanClose && (
                    <button type="button" onClick={() => setShowClose(true)}
                      className="flex-1 min-w-[120px] border border-[#22C55E] text-[#22C55E] py-2.5 rounded-lg font-logo text-xs tracking-wider">
                      CLOSE PROBLEM
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <VoiceInput value={closeNote} onChange={setCloseNote} placeholder="Closing note (optional)…" rows={2} />
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => { setShowClose(false); setCloseNote(""); }}
                    className="flex-1 border border-[#2A2A2A] py-2.5 rounded-lg font-logo text-xs">
                    CANCEL
                  </button>
                  <button type="button" onClick={handleClose} disabled={busy}
                    className="flex-1 bg-[#22C55E] text-black py-2.5 rounded-lg font-logo text-xs font-bold disabled:opacity-50">
                    {busy ? "CLOSING…" : "CONFIRM CLOSE"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    );
  }

  const listContent = (
    <>
      {filteredIssues.length > 0 && (
        <p className="font-logo text-[10px] text-[#F5C518] mb-3 tracking-wider">{filteredIssues.length} open problem(s)</p>
      )}
      <div className={`${variant === "modal" ? "max-h-[60vh]" : ""} overflow-y-auto space-y-2`}>
        {filteredIssues.length === 0 && (
          <p className="text-sm text-[#F2F0EA]/40 text-center py-8">No open problems.</p>
        )}
        {filteredIssues.map((issue) => {
          const msgs = issueMessages.filter((m) => m.issue_id === issue.id);
          const last = msgs[msgs.length - 1];
          return (
            <button key={issue.id} type="button" onClick={() => setSelectedId(issue.id)}
              className="w-full text-left bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 active:scale-[0.99]">
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="font-logo text-xs text-[#F2F0EA]">{issue.area}</span>
                <span className="font-logo text-[10px]" style={{ color: PRIORITY_COLOR[issue.priority] }}>{issue.priority}</span>
              </div>
              <p className="font-body text-xs text-[#F2F0EA]/60 line-clamp-2 mb-1">{issue.description}</p>
              <div className="flex justify-between text-[10px] text-[#F2F0EA]/40 font-logo">
                <span>{issueStatusLabel(issue.status)} · {machineName(issue.machine_id)}</span>
                <span>{last ? fmtDate(last.created_at) : fmtDate(issue.created_at)}</span>
              </div>
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
