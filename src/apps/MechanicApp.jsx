import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useInspectionDraft } from "../hooks/useInspectionDraft.js";
import { mechanicDraftKey } from "../lib/inspectionDraft.js";
import { AppPage } from "../components/AppShell.jsx";
import { RequestPartsModal } from "../components/RequestPartsModal.jsx";
import { MechanicInspectionWizard } from "../components/MechanicInspectionWizard.jsx";
import { IssueTimeline } from "../components/IssueTimeline.jsx";
import { Modal, AlertModal } from "../components/ui/Modal.jsx";
import { VoiceInput } from "../components/ui/VoiceInput.jsx";
import { ISSUE, MAINTENANCE_STATUS } from "../lib/constants.js";
import { issueStatusLabel } from "../lib/issueTimeline.js";
import { inspectionGroupsForMachine, machineUsesEarthmovingPrestart } from "../lib/siteConfig.js";
import { fmtDate } from "../lib/utils.js";
import { saveLocal } from "../lib/db.js";
import { scheduleSync } from "../lib/sync/engine.js";
import { openMechanicInspectionReport } from "../services/reports.js";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { RolePulse } from "../components/RolePulse.jsx";
import { Button } from "../components/ui/Button.jsx";
import { FieldSelect } from "../components/ui/FieldSelect.jsx";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "repairs", label: "Repairs" },
  { id: "pulse", label: "Pulse" },
  { id: "inspections", label: "Inspections" },
];

export function MechanicApp() {
  const {
    user, activeSite, machines, breakdowns, maintenanceJobs, inventoryItems,
    issues, issueMessages, inspections, refreshLocal, syncNow, getSettingsForSite,
  } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(user?.site_id || activeSite?.id),
    [getSettingsForSite, user?.site_id, activeSite?.id]
  );

  const [tab, setTab] = useState("repairs");
  const [selected, setSelected] = useState(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [labourHours, setLabourHours] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [showParts, setShowParts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false });
  const [reportPreview, setReportPreview] = useState(null);

  const [inspectionFlow, setInspectionFlow] = useState(null);
  const [inspectionMachineId, setInspectionMachineId] = useState("");

  const mechanicDraftStorageKey = useMemo(
    () => mechanicDraftKey(user?.id, inspectionMachineId),
    [user?.id, inspectionMachineId]
  );

  const {
    results: inspectionResults,
    setResults: setInspectionResults,
    remarks: inspectionRemarks,
    setRemarks: setInspectionRemarks,
    photos: inspectionPhotos,
    setPhotos: setInspectionPhotos,
    step: inspectionStep,
    setStep: setInspectionStep,
    mode: inspectionMode,
    setMode: setInspectionMode,
    clearDraft: clearMechanicDraft,
  } = useInspectionDraft(mechanicDraftStorageKey, {
    enabled: inspectionFlow === "wizard",
  });

  const showAlert = (title, message) => setAlert({ isOpen: true, title, message, onConfirm: () => setAlert({ isOpen: false }) });

  const siteMachines = useMemo(
    () => machines.filter((m) => m.site_id === user?.site_id && m.active !== false),
    [machines, user?.site_id]
  );

  const myJobs = useMemo(
    () => maintenanceJobs.filter(
      (j) => j.mechanic_id === user?.id && j.status !== MAINTENANCE_STATUS.COMPLETED
    ),
    [maintenanceJobs, user?.id]
  );

  const myInspectionBatches = useMemo(() => {
    const batches = {};
    for (const row of inspections) {
      if (row.type !== "Mechanic Inspection" || row.operator_id !== user?.id) continue;
      const batchId = row.inspection_id;
      if (!batches[batchId]) {
        batches[batchId] = {
          id: batchId,
          machine_id: row.machine_id,
          timestamp: row.timestamp,
          mechanic_name: row.operator_name,
          items: [],
        };
      }
      batches[batchId].items.push(row);
    }
    return Object.values(batches).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [inspections, user?.id]);

  const machineName = (machineId) => siteMachines.find((m) => m.id === machineId)?.name || machineId;

  const jobIssue = (job) => {
    const bd = breakdowns.find((b) => b.id === job.breakdown_id);
    return issues.find((i) => i.id === bd?.issue_id);
  };

  const openJob = (job) => {
    setSelected(job);
    setDiagnosis(job.diagnosis || "");
    setWorkPerformed(job.work_performed || "");
    setLabourHours(String(job.labour_hours || ""));
    setRecommendations(job.recommendations || "");
  };

  const openNewInspection = () => {
    const defaultId = siteMachines[0]?.id || "";
    setInspectionMachineId(defaultId);
    setInspectionFlow(siteMachines.length > 1 ? "pick-machine" : "wizard");
  };

  const startInspectionWizard = () => {
    if (!inspectionMachineId && siteMachines.length) {
      showAlert("Select machine", "Choose which machine you are inspecting.");
      return;
    }
    setInspectionFlow("wizard");
  };

  const handleSubmitInspection = async () => {
    const machine = siteMachines.find((m) => m.id === inspectionMachineId);
    if (!machine) {
      showAlert("Select machine", "Choose which machine you are inspecting.");
      return;
    }
    setBusy(true);
    try {
      await wf.completeMechanicInspection(user, machine, activeSite, {
        results: inspectionResults,
        remarks: inspectionRemarks,
        photos: inspectionPhotos,
      });
      setInspectionFlow(null);
      clearMechanicDraft();
      await refreshLocal();
      showAlert("Inspection saved", "Full inspection recorded. Open it below to view the report.");
    } catch (e) {
      showAlert("Incomplete", e.message);
    }
    setBusy(false);
  };

  const handleViewInspectionReport = async (batch) => {
    const machine = siteMachines.find((m) => m.id === batch.machine_id) || machines.find((m) => m.id === batch.machine_id);
    try {
      const doc = await openMechanicInspectionReport(batch, batch.items, {
        machine,
        site: activeSite,
        mechanicName: batch.mechanic_name || user?.name,
      });
      setReportPreview(doc);
    } catch (e) {
      showAlert("Could not open report", e.message);
    }
  };

  const saveJob = async () => {
    if (!selected) return;
    await saveLocal("maintenance_jobs", {
      ...selected,
      diagnosis,
      work_performed: workPerformed,
      labour_hours: Number(labourHours) || 0,
      recommendations,
      updated_at: new Date().toISOString(),
    });
    scheduleSync();
    await refreshLocal();
    showAlert("Saved", "Work saved on this device.");
  };

  const handleRequestParts = async (partsText) => {
    const issue = jobIssue(selected);
    if (!issue) {
      showAlert("No problem linked", "This repair is not linked to a problem.");
      return;
    }
    setBusy(true);
    try {
      await wf.requestParts(user, issue, partsText);
      await refreshLocal();
      setShowParts(false);
      showAlert("Sent", "Parts request sent to the manager.");
    } catch (e) {
      showAlert("Failed", e.message);
    }
    setBusy(false);
  };

  const handleRepairDone = async () => {
    const issue = jobIssue(selected);
    const bd = breakdowns.find((b) => b.id === selected.breakdown_id);
    if (!issue) {
      showAlert("No problem linked", "Cannot finish — no problem linked to this repair.");
      return;
    }
    setBusy(true);
    try {
      await saveLocal("maintenance_jobs", {
        ...selected,
        diagnosis,
        work_performed: workPerformed,
        labour_hours: Number(labourHours) || 0,
        recommendations,
        updated_at: new Date().toISOString(),
      });
      await wf.completeRepair(user, selected, issue, bd, recommendations);
      await refreshLocal();
      setSelected(null);
      showAlert("Repair done", "Reporter or manager can close the problem when the machine is OK.");
    } catch (e) {
      showAlert("Failed", e.message);
    }
    setBusy(false);
  };

  const selectedIssue = selected ? jobIssue(selected) : null;
  const selectedMessages = selectedIssue
    ? issueMessages.filter((m) => m.issue_id === selectedIssue.id)
    : [];

  const inspectionMachine = siteMachines.find((m) => m.id === inspectionMachineId);

  const tabItems = useMemo(
    () => TABS.map((t) => ({
      ...t,
      badge: t.id === "repairs" ? myJobs.length : 0,
    })),
    [myJobs.length]
  );

  return (
    <AppPage
      subtitle="Mechanic"
      context={activeSite?.name || user?.site_id}
      showSite={false}
      tabs={tabItems}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      maxWidth="max-w-2xl"
      openHeaderTools
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {tab !== "pulse" && (
        <div className="mb-4">
          <WorkHoursPanel variant="clock" />
        </div>
      )}

      <div className="space-y-4">
        {tab === "repairs" && (
          <section className="space-y-3">
            <h2 className="font-ui text-sm font-semibold text-[#F2F0EA]">My repairs ({myJobs.length})</h2>
            {myJobs.length === 0 ? (
              <p className="font-body text-sm text-[#F2F0EA]/40">
                No repair jobs assigned. The supervisor sends work to you from a problem.
              </p>
            ) : myJobs.map((j) => {
              const iss = jobIssue(j);
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => openJob(j)}
                  className="w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 active:border-[#F5C518]"
                >
                  <p className="font-ui text-sm font-semibold">{j.title}</p>
                  <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">{machineName(j.machine_id)}</p>
                  <p className="font-body text-xs text-[#F2F0EA]/40 mt-1">
                    {iss ? issueStatusLabel(iss.status) : j.status} - {fmtDate(j.started_at)}
                  </p>
                </button>
              );
            })}
          </section>
        )}

        {tab === "pulse" && <RolePulse />}

        {tab === "inspections" && (
          <section className="space-y-3">
            <Button
              variant="teal"
              size="lg"
              className="w-full"
              onClick={openNewInspection}
              disabled={siteMachines.length === 0}
            >
              Start walk-around
            </Button>
            <p className="font-body text-xs text-[#F2F0EA]/40 text-center">One item per screen - tap an answer, then Next.</p>
            {siteMachines.length === 0 && (
              <p className="font-body text-sm text-[#F2F0EA]/40 text-center">No machines configured on this site.</p>
            )}
            <h2 className="font-ui text-sm font-semibold text-[#F2F0EA]">Recent inspections ({myInspectionBatches.length})</h2>
            {myInspectionBatches.length === 0 ? (
              <p className="font-body text-sm text-[#F2F0EA]/40">No inspections yet. Run a full walk-around and submit the checklist.</p>
            ) : myInspectionBatches.map((batch) => {
              const flagged = batch.items.filter(
                (i) => i.status && !["Good", "OK", "Working", "Pass", "Present", "None"].includes(i.status)
              ).length;
              const photoCount = batch.items.filter((i) => i.photo_ref).length;
              return (
                <div key={batch.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-ui text-sm font-semibold">{machineName(batch.machine_id)}</p>
                      <p className="font-body text-xs text-[#F2F0EA]/40 mt-1">{fmtDate(batch.timestamp)} - {batch.items.length} items</p>
                    </div>
                    <div className="text-right font-body text-xs">
                      {flagged > 0 && <p className="text-[#F97316]">{flagged} flagged</p>}
                      {photoCount > 0 && <p className="text-[#22C55E]">{photoCount} photo{photoCount !== 1 ? "s" : ""}</p>}
                    </div>
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => handleViewInspectionReport(batch)}>
                    View report
                  </Button>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {selected && (
        <Modal title="Repair job" color="blue" onClose={() => setSelected(null)}>
          <p className="font-ui text-base font-semibold text-[#F5C518] mb-3">{machineName(selected.machine_id)}</p>
          {selectedIssue && (
            <div className="mb-4">
              <p className="font-ui text-xs font-semibold text-[#F2F0EA]/50 mb-2">Problem timeline</p>
              <IssueTimeline issue={selectedIssue} messages={selectedMessages} />
            </div>
          )}
          <label className="ops-field-label">Diagnosis</label>
          <VoiceInput value={diagnosis} onChange={setDiagnosis} rows={2} placeholder="What is wrong..." />
          <label className="ops-field-label mt-3">Work performed</label>
          <VoiceInput value={workPerformed} onChange={setWorkPerformed} rows={3} placeholder="What you did..." />
          <label className="ops-field-label mt-3">Labour hours</label>
          <input
            type="number"
            step="0.1"
            value={labourHours}
            onChange={(e) => setLabourHours(e.target.value)}
            placeholder="0"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
          />
          <label className="ops-field-label mt-3">Notes for close-out</label>
          <VoiceInput value={recommendations} onChange={setRecommendations} rows={2} placeholder="Anything the supervisor should know..." />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button onClick={saveJob} disabled={busy} className="w-full">Save</Button>
            <Button
              variant="secondary"
              onClick={() => setShowParts(true)}
              disabled={!selectedIssue || selectedIssue.status === ISSUE.WAITING_FOR_PARTS}
              className="w-full"
            >
              Request parts
            </Button>
          </div>
          <Button
            variant="teal"
            size="lg"
            className="w-full mt-2"
            onClick={handleRepairDone}
            disabled={busy || selectedIssue?.status === ISSUE.WAITING_FOR_PARTS}
          >
            {busy ? "Saving..." : "Repair finished"}
          </Button>
          {selectedIssue?.status === ISSUE.WAITING_FOR_PARTS && (
            <p className="font-body text-xs text-[#F97316] mt-2 text-center">Waiting for parts - manager must mark ordered / on site</p>
          )}
        </Modal>
      )}

      {inspectionFlow === "pick-machine" && (
        <Modal title="Which machine?" color="blue" onClose={() => setInspectionFlow(null)}>
          <p className="font-body text-sm text-[#F2F0EA]/60 mb-4">
            {machineUsesEarthmovingPrestart(inspectionMachine)
              ? "Excavator and loader inspection. One item at a time."
              : "Screen inspection. One item at a time."}
          </p>
          <label className="block mb-4">
            <span className="ops-field-label">Machine</span>
            <FieldSelect value={inspectionMachineId} onChange={setInspectionMachineId} placeholder="Choose a machine">
              {siteMachines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </FieldSelect>
          </label>
          <Button variant="teal" size="lg" className="w-full" onClick={startInspectionWizard}>
            Start inspection
          </Button>
        </Modal>
      )}

      {inspectionFlow === "wizard" && (
        <MechanicInspectionWizard
          machineName={inspectionMachine?.name}
          groups={inspectionGroupsForMachine(siteConfig, inspectionMachine)}
          results={inspectionResults}
          remarks={inspectionRemarks}
          photos={inspectionPhotos}
          setResults={setInspectionResults}
          setRemarks={setInspectionRemarks}
          setPhotos={setInspectionPhotos}
          step={inspectionStep}
          setStep={setInspectionStep}
          mode={inspectionMode}
          setMode={setInspectionMode}
          onComplete={handleSubmitInspection}
          onCancel={() => { clearMechanicDraft(); setInspectionFlow(null); }}
          busy={busy}
        />
      )}

      {showParts && (
        <RequestPartsModal
          onClose={() => setShowParts(false)}
          inventoryItems={inventoryItems}
          onSubmit={handleRequestParts}
          busy={busy}
        />
      )}

      {reportPreview && (
        <ReportPreviewModal
          html={reportPreview.html}
          title={reportPreview.title}
          sheets={reportPreview.sheets}
          onClose={() => setReportPreview(null)}
        />
      )}
    </AppPage>
  );
}
