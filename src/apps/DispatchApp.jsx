import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { ProductivityPulseScreen } from "../components/ProductivityPulseScreen.jsx";
import { DispatchDayForm } from "../components/DispatchDayForm.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { getSiteSupervisors, suggestSupervisor, hoursBetween, localDayKey } from "../lib/utils.js";
import { SupervisorPicker } from "../components/SupervisorPicker.jsx";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import { openWhatsApp } from "../lib/whatsapp.js";
import { buildDispatchWhatsApp } from "../lib/dispatchWhatsApp.js";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "dispatch", label: "Dispatch" },
  { id: "pulse", label: "Pulse" },
];

export function DispatchApp() {
  const { user, activeSite, profiles, siteDispatch, workSession, getSettingsForSite, refreshLocal, syncNow } = useOps();
  const [clockSupervisorId, setClockSupervisorId] = useState("");
  const [clockBusy, setClockBusy] = useState(false);
  const [tab, setTab] = useState("dispatch");
  const [alert, setAlert] = useState({ isOpen: false });
  const [preview, setPreview] = useState(null);
  const siteId = user?.site_id || activeSite?.id;
  const siteConfig = useMemo(() => getSettingsForSite(siteId), [getSettingsForSite, siteId]);
  const supervisors = useMemo(() => getSiteSupervisors(profiles, siteId), [profiles, siteId]);
  const suggested = useMemo(() => suggestSupervisor(supervisors, new Date()), [supervisors]);
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const site = activeSite?.id ? activeSite : { id: siteId, name: "Site" };
  const factors = {
    excavator_bucket_tonnes: siteConfig.excavator_bucket_tonnes,
    fel_bucket_tonnes: siteConfig.fel_bucket_tonnes,
  };

  return (
    <AppPage
      subtitle="Dispatch"
      context={activeSite?.name || "Site"}
      showSite={false}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {tab === "pulse" && <ProductivityPulseScreen embedded />}
      {tab === "dispatch" && (
        <div className="space-y-4">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
          <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">TIME ON SITE</p>
          {workSession ? (
            <>
              <p className="font-body text-sm text-[#F2F0EA]">
                Clocked in at {new Date(workSession.clock_in).toLocaleTimeString()} · {hoursBetween(workSession.clock_in).toFixed(1)}h
              </p>
              <button
                type="button"
                disabled={clockBusy}
                onClick={async () => {
                  setClockBusy(true);
                  try {
                    await wf.clockOut(user, workSession, { note: "Dispatch clocked out" });
                    await refreshLocal();
                    showAlert("Clocked out", "Your time on site is closed.", "success");
                  } catch (e) {
                    showAlert("Could not clock out", e.message, "error");
                  } finally {
                    setClockBusy(false);
                  }
                }}
                className="w-full py-3 rounded-full bg-[#F5C518] text-black font-logo disabled:opacity-40"
              >
                {clockBusy ? "Clocking out…" : "Clock out"}
              </button>
            </>
          ) : (
            <>
              <p className="font-body text-sm text-[#F2F0EA]/70">Clock in when you start, and clock out when you leave. This records your time. It does not start a machine.</p>
              <SupervisorPicker
                supervisors={supervisors}
                value={clockSupervisorId || suggested?.id || ""}
                onChange={setClockSupervisorId}
                suggestedId={suggested?.id || null}
                title="WHO IS ON DUTY?"
              />
              <button
                type="button"
                disabled={clockBusy || !(clockSupervisorId || suggested?.id)}
                onClick={async () => {
                  const id = clockSupervisorId || suggested?.id;
                  const supervisor = supervisors.find((s) => s.id === id);
                  setClockBusy(true);
                  try {
                    await wf.clockIn(user, null, site, { assignedSupervisor: supervisor });
                    await refreshLocal();
                    showAlert("Clocked in", "Your time on site has started.", "success");
                  } catch (e) {
                    showAlert("Could not clock in", e.message, "error");
                  } finally {
                    setClockBusy(false);
                  }
                }}
                className="w-full py-3 rounded-full bg-[#22C55E] text-black font-logo disabled:opacity-40"
              >
                {clockBusy ? "Clocking in…" : "Clock in"}
              </button>
            </>
          )}
        </div>
        <DispatchDayForm
          records={siteDispatch}
          siteId={siteId}
          factors={factors}
          supervisors={supervisors}
          suggestedSupervisorId={suggested?.id || null}
          onSave={async (fields) => {
            await wf.saveSiteDispatch(user, site, fields, factors);
            await refreshLocal();
            showAlert("Saved", "Draft kept on this phone.", "success");
          }}
          onSubmit={async (fields, supervisor) => {
            const row = await wf.submitSiteDispatch(user, site, fields, factors, supervisor);
            await refreshLocal();
            const link = buildDispatchWhatsApp(supervisor?.phone, row, site);
            if (link) openWhatsApp(link);
            showAlert("Sent", `Daily report sent to ${supervisor?.name || "the supervisor"} for sign-off.`, "success");
          }}
          onPreview={async (row) => setPreview(await dispatchDayReport({ ...row, dispatch_date: row.dispatch_date || localDayKey() }, site))}
        />
        </div>
      )}
      {preview && (
        <ReportPreviewModal html={preview.html} title={preview.title} sheets={preview.sheets} onClose={() => setPreview(null)} />
      )}
    </AppPage>
  );
}
