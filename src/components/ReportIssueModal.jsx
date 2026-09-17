import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { ISSUE_AREA_GROUPS, ISSUE_PRIORITIES, ROLES, issueAreaRequiresMachine } from "../lib/constants.js";
import { pickMedia, resolveMediaUrl } from "../lib/media.js";
import * as wf from "../services/workflows.js";

const SITE_WIDE_MACHINE = "__site__";

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

  // Restore draft after camera / page handoff
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

  const isManager = user?.role === ROLES.MANAGER;
  const isSupervisor = user?.role === ROLES.SUPERVISOR;

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
      <FormSection
        step={1}
        title="What kind of problem?"
        description="Pick the closest match — mechanical, site, staffing, etc."
        accent="#EF4444"
      >
        <select value={area} onChange={(e) => handleAreaChange(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#444] p-3.5 rounded-xl text-[#F2F0EA] text-base">
          <option value="">Select type…</option>
          {ISSUE_AREA_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.areas.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </FormSection>

      {showMachinePicker && (
        <FormSection
          step={2}
          title={needsMachine ? "Which machine?" : "Related to a machine?"}
          description={
            needsMachine
              ? "This problem type needs a machine."
              : "Optional — link to a machine or leave site-wide."
          }
          accent="#EF4444"
        >
          <select
            value={needsMachine && !selectedMachine ? "" : machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#444] p-3.5 rounded-xl text-[#F2F0EA] text-base"
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
        </FormSection>
      )}

      <FormSection step={3} title="How urgent?" description="Critical = immediate attention." accent="#EF4444">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#444] p-3.5 rounded-xl text-[#F2F0EA] text-base">
          {ISSUE_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </FormSection>

      <FormSection
        step={4}
        title="Describe the problem"
        description={
          isManager
            ? "Downward issues go to the operator on site."
            : isSupervisor
              ? "Log what is happening on site."
              : "What happened? What support is needed?"
        }
        accent="#EF4444"
      >
        <VoiceInput value={description} onChange={setDescription} placeholder="Describe the problem…" rows={3} />
        <button
          type="button"
          onClick={attachPhoto}
          className={`w-full mt-3 py-4 rounded-xl font-logo text-sm tracking-wider border-2 active:scale-[0.99] ${
            mediaPreview
              ? "bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]"
              : "bg-[#0A0A0A] border-[#444] text-[#F2F0EA]"
          }`}
        >
          {mediaPreview ? "✓ PHOTO ATTACHED — TAP TO REPLACE" : "📷 ADD PHOTO (OPTIONAL)"}
        </button>
        {mediaPreview && (
          <img src={mediaPreview} alt="" className="w-full max-h-44 object-contain rounded-xl mt-2 border border-[#444]" />
        )}
      </FormSection>

      {error && <p className="text-[#EF4444] text-sm mb-3 font-body">{error}</p>}

      <button type="button" onClick={submit} disabled={busy || !canSubmit} className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold text-base disabled:opacity-40">
        {busy ? "SUBMITTING…" : "SUBMIT PROBLEM"}
      </button>
    </Modal>
  );
}
