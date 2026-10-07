import { useMemo, useState } from "react";

import { useOps } from "../context/OpsContext.jsx";

import { AppPage } from "../components/AppShell.jsx";

import { updateUserRole, updateProfileFields } from "../lib/auth.js";

import { deactivateUser, reactivateUser } from "../services/users.js";

import { clearSyncedTables } from "../lib/db.js";

import { pullBootstrap } from "../lib/sync/pull.js";

import { computeAdminDashboard, formatAdminMetric } from "../lib/adminMetrics.js";

import { HOUR_LABELS } from "../lib/shiftMetrics.js";

import { getBillingPeriod } from "../lib/utils.js";

import { AlertModal } from "../components/ui/Modal.jsx";

import { BackdateReadingModal } from "../components/BackdateReadingModal.jsx";

import { AddUserModal } from "../components/AddUserModal.jsx";
import { AdminSitesPanel } from "../components/admin/AdminSitesPanel.jsx";
import { AdminMachinesPanel } from "../components/admin/AdminMachinesPanel.jsx";
import { AdminChecklistsPanel } from "../components/admin/AdminChecklistsPanel.jsx";
import { AdminActivityPanel } from "../components/admin/AdminActivityPanel.jsx";
import { ProductivityPulseScreen } from "../components/ProductivityPulseScreen.jsx";
import { MoreMenu } from "../components/MoreMenu.jsx";
import { SiteExpensesPanel } from "../components/SiteExpensesPanel.jsx";
import { EditUserSheet } from "../components/admin/EditUserSheet.jsx";
import { MoreSubpage } from "../components/MoreSubpage.jsx";
import { Button } from "../components/ui/Button.jsx";



const TABS = [
  { id: "dashboard", label: "Home" },
  { id: "users", label: "People" },
  { id: "sites", label: "Sites" },
  { id: "more", label: "More" },
];



export function AdminApp() {

  const {
    user, profiles, machines, sites, activeSite, activeMachine, syncState, syncNow, refreshLocal,
    shifts, events, expenses, fuelLogs, issues, inspections, maintenanceJobs, breakdowns, workSessions,
    siteSettings, getSettingsForSite,
  } = useOps();

  const [tab, setTab] = useState("dashboard");

  const [showBackdate, setShowBackdate] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const [alert, setAlert] = useState({ isOpen: false });
  const [moreView, setMoreView] = useState(null);
  const [editUser, setEditUser] = useState(null);

  const showAlert = (title, message) => setAlert({ isOpen: true, title, message, onConfirm: () => setAlert({ isOpen: false }) });

  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), getSettingsForSite(activeSite?.id).billing_cycle_start_day),
    [getSettingsForSite, activeSite?.id]
  );

  const dashboard = useMemo(
    () => computeAdminDashboard({
      profiles, machines, shifts, events, issues, expenses, fuelLogs,
      inspections, maintenanceJobs, breakdowns, workSessions, syncState,
      siteSettings,
      siteId: activeSite?.id || null,
    }, billingPeriod),
    [profiles, machines, shifts, events, issues, expenses, fuelLogs, inspections, maintenanceJobs, breakdowns, workSessions, syncState, billingPeriod, siteSettings, activeSite?.id]
  );

  const visibleProfiles = profiles

    .filter((p) => showInactive || p.active !== false)

    .sort((a, b) => (a.active === false ? 1 : 0) - (b.active === false ? 1 : 0));



  const handleRoleChange = async (userId, role) => {

    try {

      await updateUserRole(userId, role);

      await refreshLocal();

      showAlert("Updated", "Role changed.");

    } catch (e) {

      showAlert("Failed", e.message);

    }

  };



  const handleDeactivate = async (p) => {

    if (p.id === user?.id) {

      showAlert("Not allowed", "You cannot deactivate your own account.");

      return;

    }

    if (!window.confirm(`Deactivate ${p.name || p.email}? They will not be able to sign in.`)) return;

    try {

      await deactivateUser(p.id);

      await refreshLocal();

      showAlert("Deactivated", `${p.name || p.email} can no longer sign in.`);

    } catch (e) {

      showAlert("Failed", e.message);

    }

  };



  const handleReactivate = async (p) => {

    try {

      await reactivateUser(p.id);

      await refreshLocal();

      showAlert("Reactivated", `${p.name || p.email} can sign in again.`);

    } catch (e) {

      showAlert("Failed", e.message);

    }

  };



  const handleUserCreated = async (result) => {

    await refreshLocal();

    if (result.needsEmailConfirm) {

      showAlert("User Created", "User created — they must confirm email before first login (if enabled in Supabase).");

    } else {

      showAlert("User Created", `${result.profile.name} can sign in now.`);

    }

  };



  const handleFullRefresh = async () => {

    if (!window.confirm("Clear synced local cache and re-download from server? Unsynced work is kept.")) return;

    await clearSyncedTables({ keepPending: true });

    await pullBootstrap();

    await refreshLocal();

    showAlert("Refreshed", "Local cache refreshed from server.");

  };



  const exportJson = () => {

    const data = { profiles, machines, sites, shifts, events, expenses, fuelLogs, issues, exportedAt: new Date().toISOString() };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = `OPS_Backup_${new Date().toISOString().slice(0, 10)}.json`;

    a.click();

  };



  const tabItems = useMemo(() => TABS.map((t) => ({ ...t, badge: 0 })), []);

  const headerContext = `${activeSite?.name || "All sites"} · ${dashboard.periodLabel}`;

  return (

    <AppPage
      subtitle="Admin"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setMoreView(null); }}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {tab === "dashboard" && (
          <div className="space-y-4">
            <p className="font-body text-xs text-[#F2F0EA]/50">This site · this cycle</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label={HOUR_LABELS.billable} value={formatAdminMetric(dashboard.overview.billableHours, "hours")} sub={`${dashboard.overview.cycleShiftCount} shifts · 8h each minus Darkchild downtime`} color="#22C55E" />
              <Kpi label={HOUR_LABELS.machine} value={formatAdminMetric(dashboard.overview.machineHours, "hours")} sub={HOUR_LABELS.machineHint} color="#22C55E" />
              <Kpi label={HOUR_LABELS.revenue} value={formatAdminMetric(dashboard.overview.revenue, "money")} sub={HOUR_LABELS.revenueHint} color="#F5C518" />
              <Kpi label={HOUR_LABELS.expenses} value={formatAdminMetric(dashboard.overview.expenseTotal, "money")} sub={dashboard.overview.earlierExpenses > 0 ? `Net ${formatAdminMetric(dashboard.overview.net, "money")} · ${dashboard.overview.earlierExpenses} earlier` : `Net ${formatAdminMetric(dashboard.overview.net, "money")}`} color="#F97316" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label="Pending sign-off" value={dashboard.overview.pendingVerify} sub="Shifts awaiting supervisor" color="#00A4A6" />
              <Kpi label={HOUR_LABELS.downtime} value={formatAdminMetric(dashboard.overview.downtimeMin, "duration")} sub={`${HOUR_LABELS.runtime} ${formatAdminMetric(dashboard.overview.runtimeMin, "duration")}`} color="#F2F0EA" />
              <Kpi label={HOUR_LABELS.diesel} value={formatAdminMetric(dashboard.overview.litres, "litres")} sub={dashboard.overview.machineHours > 0 ? `${(dashboard.overview.litres / dashboard.overview.machineHours).toFixed(2)} L per machine hour` : HOUR_LABELS.expensesHint} color="#F5C518" />
              <Kpi label="Open problems" value={dashboard.overview.openIssues} sub={`${dashboard.overview.criticalIssues} critical`} color="#EF4444" />
            </div>
            <p className="font-body text-xs text-[#F2F0EA]/40">Sync queue {dashboard.overview.syncPending}</p>

            <section>
              <p className="font-logo text-[10px] text-[#F5C518] mb-2 tracking-wider">BY ROLE</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <RoleCard title="Operators" icon="👷" metrics={[
                  { label: "Active staff", value: dashboard.roles.operator.headcount },
                  { label: "Clocked in now", value: dashboard.roles.operator.clockedIn },
                  { label: "Verified shifts", value: dashboard.roles.operator.verifiedShifts },
                  { label: HOUR_LABELS.billable, value: formatAdminMetric(dashboard.roles.operator.billableHours, "hours") },
                  { label: HOUR_LABELS.machine, value: formatAdminMetric(dashboard.roles.operator.machineHours, "hours") },
                  { label: "Pre-starts", value: dashboard.roles.operator.prestartInspections },
                  { label: "Early clock-outs", value: dashboard.roles.operator.earlyClockOuts },
                  { label: "Top operator", value: `${dashboard.roles.operator.topName} (${dashboard.roles.operator.topShifts})` },
                ]} />
                <RoleCard title="Supervisors" icon="✅" metrics={[
                  { label: "Active staff", value: dashboard.roles.supervisor.headcount },
                  { label: "Awaiting sign-off", value: dashboard.roles.supervisor.pendingVerify },
                  { label: "Signed this period", value: dashboard.roles.supervisor.verifiedThisPeriod },
                  { label: "Open site problems", value: dashboard.roles.supervisor.openSiteIssues },
                  { label: "Most sign-offs", value: `${dashboard.roles.supervisor.topName} (${dashboard.roles.supervisor.topCount})` },
                ]} />
                <RoleCard title="Mechanics" icon="🔧" metrics={[
                  { label: "Active staff", value: dashboard.roles.mechanic.headcount },
                  { label: "Active repair jobs", value: dashboard.roles.mechanic.activeJobs },
                  { label: "Completed (period)", value: dashboard.roles.mechanic.completedJobs },
                  { label: "Full inspections", value: dashboard.roles.mechanic.inspections },
                  { label: "Open breakdowns", value: dashboard.roles.mechanic.openBreakdowns },
                ]} />
                <RoleCard title="Managers" icon="📊" metrics={[
                  { label: "Active staff", value: dashboard.roles.manager.headcount },
                  { label: "Revenue", value: formatAdminMetric(dashboard.roles.manager.revenue, "money") },
                  { label: "Expenses", value: formatAdminMetric(dashboard.roles.manager.expenses, "money") },
                  { label: "Net", value: formatAdminMetric(dashboard.roles.manager.net, "money") },
                  { label: "Waiting for parts", value: dashboard.roles.manager.waitingParts },
                  { label: "Critical problems", value: dashboard.roles.manager.criticalIssues },
                ]} />
              </div>
            </section>

            <section>
              <p className="font-logo text-[10px] text-[#F5C518] mb-2 tracking-wider">FLEET NOW</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dashboard.fleet.length === 0 ? (
                  <p className="text-sm text-[#F2F0EA]/40">No machines configured.</p>
                ) : dashboard.fleet.map((f) => (
                  <div key={f.id} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 flex justify-between items-center gap-2">
                    <div>
                      <p className="font-logo text-sm">{f.name}</p>
                      {f.stopReason && <p className="text-[10px] text-[#F97316] mt-0.5">{f.stopReason}</p>}
                    </div>
                    <span className={`font-logo text-[10px] px-2 py-1 rounded ${
                      f.status === "running" ? "bg-[#22C55E]/20 text-[#22C55E]"
                        : f.status === "stopped" ? "bg-[#EF4444]/20 text-[#EF4444]"
                          : "bg-[#2A2A2A] text-[#F2F0EA]/50"
                    }`}>
                      {f.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "sites" && (
          <AdminSitesPanel
            sites={sites}
            machines={machines}
            siteSettings={siteSettings}
            onSaved={refreshLocal}
            showAlert={showAlert}
          />
        )}

        {tab === "more" && !moreView && (
          <MoreMenu
            items={[
              { label: "Machine pulse", onClick: () => setMoreView("pulse") },
              { label: "Machines", onClick: () => setMoreView("machines") },
              { label: "Checklists", onClick: () => setMoreView("checklists") },
              { label: "Expenses", onClick: () => setMoreView("expenses") },
              { label: "Activity", onClick: () => setMoreView("activity") },
              { label: "Sync", onClick: () => setMoreView("sync") },
            ]}
          />
        )}

        {tab === "more" && moreView === "pulse" && (
          <MoreSubpage title="Machine pulse" onBack={() => setMoreView(null)}>
            <ProductivityPulseScreen embedded />
          </MoreSubpage>
        )}

        {tab === "more" && moreView === "checklists" && (
          <MoreSubpage title="Checklists" onBack={() => setMoreView(null)}>
            <AdminChecklistsPanel
              sites={sites}
              siteSettings={siteSettings}
              onSaved={refreshLocal}
              showAlert={showAlert}
            />
          </MoreSubpage>
        )}

        {tab === "more" && moreView === "expenses" && (
          <MoreSubpage title="Expenses" onBack={() => setMoreView(null)}>
            <SiteExpensesPanel
              expenses={expenses}
              machines={machines}
              siteId={activeSite?.id}
              cycleStartDay={getSettingsForSite(activeSite?.id).billing_cycle_start_day}
              scopeLabel={activeSite?.name || "This site"}
            />
          </MoreSubpage>
        )}

        {tab === "more" && moreView === "activity" && (
          <MoreSubpage title="Activity" onBack={() => setMoreView(null)}>
            <AdminActivityPanel
              events={events}
              workSessions={workSessions}
              shifts={shifts}
              issues={issues}
              fuelLogs={fuelLogs}
              inspections={inspections}
              expenses={expenses}
              machines={machines}
              sites={sites}
            />
          </MoreSubpage>
        )}

        {tab === "users" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="teal" size="md" className="flex-1 min-w-[140px]" onClick={() => setShowAddUser(true)}>
                Add user
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => setShowInactive(!showInactive)}>
                {showInactive ? "Hide inactive" : "Show inactive"}
              </Button>
            </div>
            {visibleProfiles.length === 0 ? (
              <p className="text-sm text-ops-muted">No users. Sync when online or add a user.</p>
            ) : (
              <div className="space-y-2">
                {visibleProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEditUser(p)}
                    className={`ops-list-row ${p.active === false ? "opacity-50" : ""}`}
                  >
                    <div className="ops-list-row-body">
                      <p className="ops-list-row-title">{p.name || p.email}</p>
                      <p className="ops-list-row-meta">
                        {(p.role || "operator")}
                        {p.active === false ? " · inactive" : ""}
                        {p.email ? ` · ${p.email}` : ""}
                      </p>
                    </div>
                    <span className="ops-list-row-chevron" aria-hidden>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "more" && moreView === "machines" && (
          <MoreSubpage title="Machines" onBack={() => setMoreView(null)}>
            <AdminMachinesPanel
              sites={sites}
              machines={machines}
              onSaved={refreshLocal}
              showAlert={showAlert}
            />
          </MoreSubpage>
        )}



        {tab === "more" && moreView === "sync" && (
          <MoreSubpage title="Sync" onBack={() => setMoreView(null)}>
          <div className="space-y-4">

            <div className="grid grid-cols-3 gap-3">

              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">

                <p className="font-logo text-[10px] text-[#F2F0EA]/50">PENDING</p>

                <p className="font-logo text-3xl text-[#F5C518]">{syncState.pending || 0}</p>

              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">

                <p className="font-logo text-[10px] text-[#F2F0EA]/50">STATUS</p>

                <p className="font-logo text-lg text-[#22C55E]">{(syncState.status || "idle").toUpperCase()}</p>

              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">

                <p className="font-logo text-[10px] text-[#F2F0EA]/50">LOCAL RECORDS</p>

                <p className="font-logo text-lg">{shifts.length + events.length + fuelLogs.length}</p>

              </div>

            </div>

            <button type="button" onClick={() => setShowBackdate(true)}

              className="w-full mb-3 border border-[#00A4A6] text-[#00A4A6] py-4 rounded-xl font-logo font-bold text-xs tracking-wider">

              📸 BACKDATE HOUR READING (ADMIN)

            </button>

            <div className="flex flex-wrap gap-2">

              <Button onClick={() => syncNow()} variant="primary" size="md" className="flex-1 min-w-[120px]">Force sync</Button>
              <Button onClick={handleFullRefresh} variant="danger" size="md" className="flex-1 min-w-[120px]">Full refresh</Button>
              <Button onClick={exportJson} variant="teal" size="md" className="flex-1 min-w-[120px]">Export JSON</Button>

            </div>

            {syncState.errors?.length > 0 && (

              <div className="bg-[#2a1616] border border-[#EF4444]/30 rounded-xl p-3 text-xs text-[#EF4444]">

                {syncState.errors.slice(0, 5).join(" · ")}

              </div>

            )}

          </div>
          </MoreSubpage>
        )}



      {showAddUser && (

        <AddUserModal

          onClose={() => setShowAddUser(false)}

          sites={sites}

          machines={machines}

          defaultSiteId={activeSite?.id}

          onDone={handleUserCreated}

        />

      )}

      {showBackdate && (

        <BackdateReadingModal

          onClose={() => setShowBackdate(false)}

          user={user}

          machine={activeMachine}

          site={activeSite}

          onDone={refreshLocal}

        />

      )}

      {editUser && (
        <EditUserSheet
          profile={editUser}
          sites={sites}
          machines={machines}
          currentUserId={user?.id}
          onClose={() => setEditUser(null)}
          onSaveRole={async (id, role) => { await handleRoleChange(id, role); }}
          onSaveFields={async (id, fields) => {
            await updateProfileFields(id, fields);
            await refreshLocal();
            showAlert("Updated", "Saved.");
          }}
          onDeactivate={async (p) => { await handleDeactivate(p); setEditUser(null); }}
          onReactivate={async (p) => { await handleReactivate(p); setEditUser(null); }}
        />
      )}

    </AppPage>

  );

}

function Kpi({ label, value, sub, color = "#F2F0EA" }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: "var(--ops-gold-wash)", borderColor: "var(--ops-gold-line)" }}>
      <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">{label}</p>
      <p className="font-logo text-xl mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#F2F0EA]/40 mt-1">{sub}</p>}
    </div>
  );
}

function RoleCard({ title, icon, metrics }) {
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
      <p className="font-logo text-sm text-[#F5C518] mb-3">{icon} {title}</p>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between gap-3 text-xs">
            <span className="text-[#F2F0EA]/50">{m.label}</span>
            <span className="font-logo text-[#F2F0EA] text-right">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

