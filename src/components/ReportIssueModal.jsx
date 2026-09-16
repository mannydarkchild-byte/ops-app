import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { ISSUE_AREA_GROUPS, ISSUE_PRIORITIES, ROLES, issueAreaRequiresMachine } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
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

  const [machineId, setMachineId] = useState(initialNeedsMachine ? defaultMachineId : SITE_WIDE_MACHINE);
  const [area, setArea] = useState(initialArea);
  const [priority, setPriority] = useState(initialPriority);
  const [description, setDescription] = useState(initialDescription);
  const [mediaRef, setMediaRef] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [busy, setBusy] = useState(false);

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

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await wf.reportIssue(user, selectedMachine, site, profiles, {
        area, priority, description, mediaRef, mediaType: mediaPreview ? "photo" : null,
      });
      await onDone?.();
      onClose();
    } finally { setBusy(false); }
  };

  const showMachinePicker = allowSiteWide
    ? machineOptions.length > 0 || needsMachine
    : machineOptions.length > 1;

  return (
    <Modal title="REPORT PROBLEM" color="red" onClose={onClose}>
      <FormSection
        step={1}
        title="What kind of problem?"
        description="Machine faults, site issues, suppliers, staffing — pick the closest match."
        accent="#EF4444"
      >
        <select value={area} onChange={(e) => handleAreaChange(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]">
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
              : "Optional — link to a machine if relevant, or leave as site-wide."
          }
          accent="#EF4444"
        >
          <select
            value={needsMachine && !selectedMachine ? "" : machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]"
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

      <FormSection step={3} title="How urgent?" description="Critical problems need immediate attention." accent="#EF4444">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]">
          {ISSUE_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </FormSection>

      <FormSection
        step={4}
        title="Describe the problem"
        description={
          isManager
            ? "Downward issues go to the operator on site. Site/commercial issues go to the supervisor."
            : isSupervisor
              ? "Log what is happening on site — send to someone from the problem inbox if action is needed."
              : "What happened? What action or support is needed?"
        }
        accent="#EF4444"
      >
        <VoiceInput value={description} onChange={setDescription} placeholder="Describe the problem…" rows={3} />
        <button type="button" onClick={() => pickMedia("photo", ({ ref, data }) => { setMediaRef(ref); setMediaPreview(data); })}
          className="w-full mt-2 py-3 border border-[#2A2A2A] rounded-xl font-logo text-xs text-[#F2F0EA]/70">
          {mediaPreview ? "✓ Photo attached" : "+ Add photo (optional)"}
        </button>
      </FormSection>

      <button type="button" onClick={submit} disabled={busy || !canSubmit} className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40">
        {busy ? "SUBMITTING…" : "SUBMIT PROBLEM"}
      </button>
    </Modal>
  );
}
