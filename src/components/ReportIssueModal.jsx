import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { ISSUE_AREA_GROUPS, ISSUE_PRIORITIES, ROLES, issueAreaRequiresMachine } from "../lib/constants.js";
import { pickMedia, resolveMediaUrl } from "../lib/media.js";
import * as wf from "../services/workflows.js";

const SITE_WIDE_MACHINE = "__site__";
const fieldClass = "w-full bg-[#0A0A0A] border border-[#444] p-4 rounded-xl text-[#F2F0EA] text-base mb-4";
const labelClass = "block font-logo text-sm text-[#F2F0EA] mb-2";

export function ReportIssueModal({
  onClose, user, machine, machines, site, profiles, onDone,
  initialArea = "", initialDescription = "", initialPriority = "Medium",
  allowSiteWide = true,
}) {
  const machineOptions = machines?.length ? machines : machine ? [machine] : [];
  const defaultMachineId = machine?.id || machineOptions[0]?.id || "";
  const initialNeedsMachine = initialArea ? issueAreaRequiresMachine(initialArea) : true;
  const draftKey = `ops-report:${user?.id}:${site?.id || "site"}`;

  const [machineId, setMachineId] = useState(initialNeedsMachine ? defaultMachineId : SITE_WIDE_MACHINE);
  const [area, setArea] = useState(initialArea);
  const [priority, setPriority] = useState(initialPriority);
  const [description, setDescription] = useState(initialDescription);
  const [mediaRef, setMediaRef] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.area) setArea(draft.area);
      if (draft.priority) setPriority(draft.priority);
      if (draft.description) setDescription(draft.description);
      if (draft.machineId) setMachineId(draft.machineId);
      if (draft.mediaRef) {
        setMediaRef(draft.mediaRef);
        resolveMediaUrl(draft.mediaRef).then((url) => { if (url) setMediaPreview(url); });
      }
    } catch {}
  }, [draftKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        area, priority, description, machineId, mediaRef,
      }));
    } catch {}
  }, [draftKey, area, priority, description, machineId, mediaRef]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") {
        try {
          sessionStorage.setItem(draftKey, JSON.stringify({
            area, priority, description, machineId, mediaRef,
          }));
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [draftKey, area, priority, description, machineId, mediaRef]);

  const needsMachine = issueAreaRequiresMachine(area);
  const selectedMachine = machineId && machineId !== SITE_WIDE_MACHINE
    ? (machineOptions.find((m) => m.id === machineId) || machine)
    : null;

  const canSubmit = useMemo(() => {
    if (!area) return false;
    if (needsMachine && !selectedMachine) return false;
    return true;
  }, [area, needsMachine, selectedMachine]);

  const handleAreaChange = (nextArea) => {
    setArea(nextArea);
    if (!issueAreaRequiresMachine(nextArea)) {
      setMachineId(SITE_WIDE_MACHINE);
    } else if (machineId === SITE_WIDE_MACHINE && defaultMachineId) {
      setMachineId(defaultMachineId);
    }
  };

  const attachPhoto = () => {
    pickMedia("photo", ({ ref, data }) => {
      setMediaRef(ref);
      setMediaPreview(data);
      setError("");
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await wf.reportIssue(user, selectedMachine, site, profiles, {
        area, priority, description, mediaRef, mediaType: mediaRef ? "photo" : null,
      });
      sessionStorage.removeItem(draftKey);
      await onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Could not submit — saved locally when possible");
    } finally {
      setBusy(false);
    }
  };

  const showMachinePicker = allowSiteWide
    ? machineOptions.length > 0 || needsMachine
    : machineOptions.length > 1;

  return (
    <Modal title="REPORT PROBLEM" color="red" onClose={onClose}>
      <label className={labelClass}>What kind of problem?</label>
      <select value={area} onChange={(e) => handleAreaChange(e.target.value)} className={fieldClass}>
        <option value="">Select type…</option>
        {ISSUE_AREA_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.areas.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {showMachinePicker && (
        <>
          <label className={labelClass}>{needsMachine ? "Which machine?" : "Related machine (optional)"}</label>
          <select
            value={needsMachine && !selectedMachine ? "" : machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className={fieldClass}
            disabled={needsMachine && machineOptions.length === 1 && !!defaultMachineId}
          >
            {!needsMachine && allowSiteWide && (
              <option value={SITE_WIDE_MACHINE}>Site-wide (no specific machine)</option>
            )}
            {needsMachine && machineOptions.length !== 1 && (
              <option value="">Select machine…</option>
            )}
            {machineOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </>
      )}

      <label className={labelClass}>How urgent?</label>
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
        {ISSUE_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
      </select>

      <label className={labelClass}>Describe the problem</label>
      <VoiceInput value={description} onChange={setDescription} placeholder="What happened? What help is needed?" rows={4} />

      <button
        type="button"
        onClick={attachPhoto}
        className={`w-full mt-3 mb-4 py-4 rounded-xl font-logo text-base border-2 ${
          mediaPreview
            ? "bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]"
            : "bg-[#0A0A0A] border-[#444] text-[#F2F0EA]"
        }`}
      >
        {mediaPreview ? "PHOTO ATTACHED — TAP TO REPLACE" : "ADD PHOTO (OPTIONAL)"}
      </button>
      {mediaPreview && (
        <img src={mediaPreview} alt="" className="w-full max-h-52 object-contain rounded-xl mb-4 border border-[#444]" />
      )}

      {error && <p className="text-[#EF4444] text-base mb-4">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canSubmit}
        className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold text-base disabled:opacity-40"
      >
        {busy ? "SUBMITTING…" : "SUBMIT PROBLEM"}
      </button>
    </Modal>
  );
}
