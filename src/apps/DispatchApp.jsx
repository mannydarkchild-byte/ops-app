import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { DispatchDayForm } from "../components/DispatchDayForm.jsx";
import { RolePulse } from "../components/RolePulse.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { tonnesPerBucket } from "../lib/siteConfig.js";
import { getSiteSupervisors, suggestSupervisor, localDayKey } from "../lib/utils.js";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import { openWhatsApp } from "../lib/whatsapp.js";
import { buildDispatchWhatsApp } from "../lib/dispatchWhatsApp.js";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "today", label: "Day" },
  { id: "pulse", label: "Pulse" },
];

export function DispatchApp() {
  const { user, activeSite, profiles, siteDispatch, getSettingsForSite, refreshLocal, syncNow } = useOps();
  const [tab, setTab] = useState("today");
  const [alert, setAlert] = useState({ isOpen: false });
  const [preview, setPreview] = useState(null);
  const siteId = user?.site_id || activeSite?.id;
  const siteConfig = useMemo(() => getSettingsForSite(siteId), [getSettingsForSite, siteId]);
  const supervisors = useMemo(() => getSiteSupervisors(profiles, siteId), [profiles, siteId]);
  const suggested = useMemo(() => suggestSupervisor(supervisors, new Date()), [supervisors]);
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const site = activeSite?.id ? activeSite : { id: siteId, name: "Site" };
  const factors = {
    excavator_bucket_tonnes: tonnesPerBucket(siteConfig.excavator_bucket_tonnes),
    fel_bucket_tonnes: tonnesPerBucket(siteConfig.fel_bucket_tonnes),
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
      openHeaderTools
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {tab !== "pulse" && (
        <div className="mb-4">
          <WorkHoursPanel variant="clock" />
        </div>
      )}
      {tab === "pulse" && <RolePulse />}
      {tab === "today" && (
        <div className="space-y-4">
          <p className="font-body text-sm text-[#F2F0EA]/70">One day, one record. Enter buckets, send for sign-off, done.</p>
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
              if (navigator.onLine) await syncNow();
              const link = buildDispatchWhatsApp(supervisor?.phone, row, site);
              if (link) {
                openWhatsApp(link);
                showAlert("Sent", `Daily report sent to ${supervisor?.name || "the supervisor"} for sign-off.`, "success");
              } else {
                showAlert(
                  "Saved in OPS",
                  `${supervisor?.name || "The supervisor"} can sign it in OPS. Add their phone in People to open WhatsApp.`,
                  "info"
                );
              }
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
