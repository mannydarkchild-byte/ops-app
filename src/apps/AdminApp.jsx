import { useMemo, useState } from "react";

import { useOps } from "../context/OpsContext.jsx";

import { AppPage } from "../components/AppShell.jsx";

import { updateUserRole, updateProfileFields } from "../lib/auth.js";

import { deactivateUser, reactivateUser } from "../services/users.js";

import { getDB, clearSyncedTables } from "../lib/db.js";

import { pullBootstrap } from "../lib/sync/pull.js";

import { ROLES } from "../lib/constants.js";

import { computeAdminDashboard, formatAdminMetric } from "../lib/adminMetrics.js";

import { getBillingPeriod } from "../lib/utils.js";

import { AlertModal } from "../components/ui/Modal.jsx";

import { BackdateReadingModal } from "../components/BackdateReadingModal.jsx";

import { AddUserModal } from "../components/AddUserModal.jsx";
import { AdminSitesPanel } from "../components/admin/AdminSitesPanel.jsx";
import { AdminMachinesPanel } from "../components/admin/AdminMachinesPanel.jsx";
import { AdminChecklistsPanel } from "../components/admin/AdminChecklistsPanel.jsx";
import { AdminActivityPanel } from "../components/admin/AdminActivityPanel.jsx";



const TABS = [

  { id: "dashboard", label: "Dashboard", icon: "📊" },

  { id: "sites", label: "Sites", icon: "🏗" },

  { id: "machines", label: "Machines", icon: "🔧" },

  { id: "checklists", label: "Checklists", icon: "📋" },

  { id: "activity", label: "Activity", icon: "📜" },

  { id: "users", label: "Users", icon: "👥" },

  { id: "sync", label: "Sync", icon: "🔄" },

];



const MANAGEABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.ADMIN];



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

  const showAlert = (title, message) => setAlert({ isOpen: true, title, message, onConfirm: () => setAlert({ isOpen: false }) });

  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), getSettingsForSite(activeSite?.id).billing_cycle_start_day),
    [getSettingsForSite, activeSite?.id]
  );

  const dashboard = useMemo(
    () => computeAdminDashboard({
      profiles, machines, shifts, events, issues, expenses, fuelLogs,
      inspections, maintenanceJobs, breakdowns, workSessions, syncState,
    }, billingPeriod),
    [profiles, machines, shifts, events, issues, expenses, fuelLogs, inspections, maintenanceJobs, breakdowns, workSessions, syncState, billingPeriod]
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
      onTabChange={setTab}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label="Billable hours" value={formatAdminMetric(dashboard.overview.billableHours, "hours")} sub={`${dashboard.overview.machinesRunning} running`} color="#22C55E" />
              <Kpi label="Revenue" value={formatAdminMetric(dashboard.overview.revenue, "money")} sub="Verified shifts" color="#F5C518" />
              <Kpi label="Expenses" value={formatAdminMetric(dashboard.overview.expenseTotal, "money")} sub={`Net ${formatAdminMetric(dashboard.overview.net, "money")}`} color="#F97316" />
              <Kpi label="Open problems" value={dashboard.overview.openIssues} sub={`${dashboard.overview.criticalIssues} critical`} color="#EF4444" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label="Pending sign-off" value={dashboard.overview.pendingVerify} sub="Shifts awaiting supervisor" color="#00A4A6" />
              <Kpi label="Downtime" value={formatAdminMetric(dashboard.overview.downtimeMin, "duration")} sub={`Runtime ${formatAdminMetric(dashboard.overview.runtimeMin, "duration")}`} color="#F2F0EA" />
              <Kpi label="Diesel" value={formatAdminMetric(dashboard.overview.litres, "litres")} sub="This billing period" color="#F5C518" />
              <Kpi label="Sync queue" value={dashboard.overview.syncPending} sub={(syncState.status || "idle").toUpperCase()} color="#00A4A6" />
            </div>

            <section>
              <p className="font-logo text-[10px] text-[#F5C518] mb-2 tracking-wider">BY ROLE</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <RoleCard title="Operators" icon="👷" metrics={[
                  { label: "Active staff", value: dashboard.roles.operator.headcount },
                  { label: "Clocked in now", value: dashboard.roles.operator.clockedIn },
                  { label: "Verified shifts", value: dashboard.roles.operator.verifiedShifts },
                  { label: "Billable hours", value: formatAdminMetric(dashboard.roles.operator.billableHours, "hours") },
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

            <button type="button" onClick={() => syncNow()} className="w-full bg-[#00A4A6] text-white py-3 rounded-xl font-logo font-bold text-xs">
              🔄 SYNC ALL DATA
            </button>
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

        {tab === "checklists" && (
          <AdminChecklistsPanel
            sites={sites}
            siteSettings={siteSettings}
            onSaved={refreshLocal}
            showAlert={showAlert}
          />
        )}

        {tab === "activity" && (
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
        )}

        {tab === "users" && (

          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">

            <div className="flex flex-wrap gap-2 mb-4">

              <button type="button" onClick={() => setShowAddUser(true)}

                className="flex-1 min-w-[140px] bg-[#22C55E] text-black py-3 rounded-xl font-logo font-bold text-xs tracking-wider">

                + ADD USER

              </button>

              <button type="button" onClick={() => setShowInactive(!showInactive)}

                className="px-4 py-3 rounded-xl font-logo text-xs border border-[#2A2A2A] text-[#F2F0EA]/70">

                {showInactive ? "Hide inactive" : "Show inactive"}

              </button>

            </div>



            {visibleProfiles.length === 0 ? (

              <p className="text-sm text-[#F2F0EA]/40">No users. Sync when online or add a user.</p>

            ) : visibleProfiles.map((p) => (

              <div key={p.id} className={`py-3 border-b border-[#2A2A2A] last:border-0 space-y-2 ${p.active === false ? "opacity-50" : ""}`}>

                <div className="flex justify-between items-start gap-2">

                  <div className="min-w-0 flex-1">

                    <p className="font-logo text-xs truncate">{p.name || p.email}</p>

                    <p className="text-[9px] text-[#F2F0EA]/40 truncate">{p.email}</p>

                    {p.active === false && <p className="text-[9px] text-[#EF4444] font-logo mt-1">INACTIVE</p>}

                  </div>

                  <select value={p.role || ROLES.OPERATOR} onChange={(e) => handleRoleChange(p.id, e.target.value)}

                    disabled={p.active === false}

                    className="bg-[#0A0A0A] border border-[#2A2A2A] p-1 rounded font-logo text-[10px]">

                    {MANAGEABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}

                  </select>

                </div>

                {p.active !== false && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      defaultValue={p.site_id || ""}
                      onChange={(e) => updateProfileFields(p.id, { site_id: e.target.value || null }).then(() => refreshLocal())}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded font-logo text-[10px] text-[#F2F0EA]"
                    >
                      <option value="">No site</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {(p.role === ROLES.OPERATOR) && (
                      <select
                        defaultValue={p.machine_id || ""}
                        onChange={(e) => updateProfileFields(p.id, { machine_id: e.target.value || null }).then(() => refreshLocal())}
                        className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded font-logo text-[10px] text-[#F2F0EA]"
                      >
                        <option value="">Default machine</option>
                        {machines.filter((m) => m.site_id === p.site_id).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {p.role === ROLES.SUPERVISOR && p.active !== false && (

                  <div className="grid grid-cols-2 gap-2">

                    <input type="tel" defaultValue={p.phone || ""} placeholder="WhatsApp phone"

                      onBlur={(e) => updateProfileFields(p.id, { phone: e.target.value.trim() || null }).then(() => refreshLocal())}

                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded font-body text-[10px] text-[#F2F0EA]" />

                    <select defaultValue={p.shift_band || "any"}

                      onChange={(e) => updateProfileFields(p.id, { shift_band: e.target.value }).then(() => refreshLocal())}

                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded font-logo text-[10px] text-[#F2F0EA]">

                      <option value="day">Day shift</option>

                      <option value="night">Night shift</option>

                      <option value="any">All shifts</option>

                    </select>

                  </div>

                )}

                <div className="flex gap-2">

                  {p.active !== false && p.id !== user?.id && (

                    <button type="button" onClick={() => handleDeactivate(p)}

                      className="text-[10px] font-logo text-[#EF4444] tracking-wider py-1">

                      REMOVE USER

                    </button>

                  )}

                  {p.active === false && (

                    <button type="button" onClick={() => handleReactivate(p)}

                      className="text-[10px] font-logo text-[#22C55E] tracking-wider py-1">

                      REACTIVATE

                    </button>

                  )}

                </div>

              </div>

            ))}

          </div>

        )}



        {tab === "machines" && (
          <AdminMachinesPanel
            sites={sites}
            machines={machines}
            onSaved={refreshLocal}
            showAlert={showAlert}
          />
        )}



        {tab === "sync" && (

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

              <button onClick={() => syncNow()} className="flex-1 bg-[#F5C518] text-black py-3 rounded-lg font-logo font-bold text-xs min-w-[120px]">FORCE SYNC</button>

              <button onClick={handleFullRefresh} className="flex-1 bg-[#EF4444] text-white py-3 rounded-lg font-logo font-bold text-xs min-w-[120px]">FULL REFRESH</button>

              <button onClick={exportJson} className="flex-1 bg-[#00A4A6] text-white py-3 rounded-lg font-logo font-bold text-xs min-w-[120px]">EXPORT JSON</button>

            </div>

            {syncState.errors?.length > 0 && (

              <div className="bg-[#2a1616] border border-[#EF4444]/30 rounded-xl p-3 text-xs text-[#EF4444]">

                {syncState.errors.slice(0, 5).join(" · ")}

              </div>

            )}

          </div>

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

    </AppPage>

  );

}

function Kpi({ label, value, sub, color = "#F2F0EA" }) {
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3">
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

