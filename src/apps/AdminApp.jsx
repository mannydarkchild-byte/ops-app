import { useMemo, useState } from "react";

import { useOps } from "../context/OpsContext.jsx";

import { AppPage } from "../components/AppShell.jsx";

import { updateUserRole, updateProfileFields } from "../lib/auth.js";

import { deactivateUser, reactivateUser } from "../services/users.js";

import { clearSyncedTables } from "../lib/db.js";

import { pullBootstrap } from "../lib/sync/pull.js";

import { ROLES } from "../lib/constants.js";

import { computeAdminDashboard, formatAdminMetric } from "../lib/adminMetrics.js";

import { formatDurationMinutes, HOUR_LABELS, shiftBillableHours } from "../lib/shiftMetrics.js";
import { billableDetail, dieselDetail, downtimeDetail, expenseDetail, machineHourDetail, revenueDetail, shiftsStartedInPeriod, sumMeterHours } from "../lib/dashboardBreakdown.js";
import { DashboardKpi, KpiDetailModal, MachineSelect } from "../components/DashboardKpi.jsx";
import { DispatchKpis } from "../components/DispatchKpis.jsx";

import { getBillingPeriod, inPeriod, money, shiftBillableValue } from "../lib/utils.js";

import { AlertModal } from "../components/ui/Modal.jsx";

import { BackdateReadingModal } from "../components/BackdateReadingModal.jsx";

import { AddUserModal } from "../components/AddUserModal.jsx";
import { AdminSitesPanel } from "../components/admin/AdminSitesPanel.jsx";
import { AdminMachinesPanel } from "../components/admin/AdminMachinesPanel.jsx";
import { AdminChecklistsPanel } from "../components/admin/AdminChecklistsPanel.jsx";
import { AdminActivityPanel } from "../components/admin/AdminActivityPanel.jsx";
import { RolePulse } from "../components/RolePulse.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { MoreMenu } from "../components/MoreMenu.jsx";
import { SiteExpensesPanel } from "../components/SiteExpensesPanel.jsx";
import { Button } from "../components/ui/Button.jsx";

const TABS = [
  { id: "home", label: "Home" },
  { id: "pulse", label: "Pulse" },
  { id: "users", label: "People" },
  { id: "sites", label: "Sites" },
  { id: "setup", label: "Setup" },
];



const MANAGEABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.DISPATCH, ROLES.STOREROOM];



export function AdminApp() {

  const {
    user, profiles, machines, sites, activeSite, activeMachine, syncState, syncNow, refreshLocal,
    shifts, events, expenses, fuelLogs, issues, inspections, maintenanceJobs, breakdowns, workSessions,
    siteSettings, siteDispatch, getSettingsForSite,
  } = useOps();

  const [tab, setTab] = useState("home");

  const [showBackdate, setShowBackdate] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const [alert, setAlert] = useState({ isOpen: false });
  const [kpiDetail, setKpiDetail] = useState(null);
  const [focusMachineId, setFocusMachineId] = useState("");
  const [moreView, setMoreView] = useState(null);

  const showAlert = (title, message) => setAlert({ isOpen: true, title, message, onConfirm: () => setAlert({ isOpen: false }) });

  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), getSettingsForSite(activeSite?.id).billing_cycle_start_day),
    [getSettingsForSite, activeSite?.id]
  );

  const siteMachines = useMemo(
    () => machines.filter((machine) => (!activeSite?.id || machine.site_id === activeSite.id) && machine.active !== false),
    [machines, activeSite?.id]
  );
  const selectedMachine = useMemo(
    () => siteMachines.find((machine) => machine.id === focusMachineId) || siteMachines[0] || null,
    [siteMachines, focusMachineId]
  );
  const machineDash = useMemo(() => {
    const settings = getSettingsForSite(activeSite?.id);
    const rows = shiftsStartedInPeriod(shifts.filter((shift) => shift.machine_id === selectedMachine?.id), billingPeriod);
    const nameOf = (id) => machines.find((machine) => machine.id === id)?.name || selectedMachine?.name || "Machine";
    const scope = `${selectedMachine?.name || "This machine"} · ${billingPeriod.label}`;
    const withScope = (detail) => ({ ...detail, scope });
    const cycleFuel = fuelLogs.filter((row) => row.machine_id === selectedMachine?.id && inPeriod(row.timestamp, billingPeriod));
    const machineExpenses = expenses.filter((row) => row.machine_id === selectedMachine?.id);
    const cycleExpenses = machineExpenses.filter((row) => inPeriod(row.date || row.created_at, billingPeriod));
    return {
      billableHours: rows.reduce((sum, shift) => sum + shiftBillableHours(shift, events, settings), 0),
      machineHours: sumMeterHours(rows),
      meterShiftCount: rows.filter((shift) => shift.end_hour_meter != null && shift.start_hour_meter != null).length,
      shiftCount: rows.length,
      revenue: rows.reduce((sum, shift) => sum + shiftBillableValue(shift, machines, events, settings), 0),
      expenseTotal: cycleExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      earlierExpenses: Math.max(0, machineExpenses.length - cycleExpenses.length),
      litres: cycleFuel.reduce((sum, row) => sum + Number(row.litres || 0), 0),
      downtimeMin: rows.reduce((sum, shift) => sum + Number(shift.downtime_minutes || 0), 0),
      details: {
        billable: withScope(billableDetail(rows, events, settings, nameOf)),
        machine: withScope(machineHourDetail(rows, nameOf)),
        revenue: withScope(revenueDetail(rows, machines, events, settings, nameOf)),
        expenses: withScope(expenseDetail(cycleExpenses, nameOf)),
        diesel: withScope(dieselDetail(cycleFuel, nameOf)),
        downtime: withScope(downtimeDetail(rows, nameOf)),
      },
    };
  }, [shifts, events, expenses, fuelLogs, machines, selectedMachine?.id, selectedMachine?.name, billingPeriod, activeSite?.id, getSettingsForSite]);

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

  const headerContext = `${activeSite?.name || "All sites"} - ${dashboard.periodLabel}`;

  return (

    <AppPage
      subtitle="Admin"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setMoreView(null); }}
      onSync={syncNow}
      openHeaderTools
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {tab !== "pulse" && moreView !== "review" && (
          <div className="mb-4">
            <WorkHoursPanel variant="clock" />
          </div>
        )}

        {tab === "pulse" && <RolePulse />}

        {tab === "home" && (
          <div className="space-y-4">
            {selectedMachine && (
              <MachineSelect machines={siteMachines} value={selectedMachine.id} onChange={setFocusMachineId} />
            )}
            <p className="font-body text-xs text-[#F2F0EA]/50">{selectedMachine?.name || "This machine"} · {dashboard.periodLabel}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <DashboardKpi label={HOUR_LABELS.billable} value={formatAdminMetric(machineDash.billableHours, "hours")} sub={`${machineDash.shiftCount} shifts on this machine`} color="#22C55E" onClick={() => setKpiDetail(machineDash.details.billable)} />
              <DashboardKpi label={HOUR_LABELS.machine} value={formatAdminMetric(machineDash.machineHours, "hours")} sub={`${machineDash.meterShiftCount} with a closing meter`} color="#22C55E" onClick={() => setKpiDetail(machineDash.details.machine)} />
              <DashboardKpi label={HOUR_LABELS.revenue} value={formatAdminMetric(machineDash.revenue, "money")} sub={selectedMachine ? `${money(selectedMachine.billable_rate)}/h` : "This machine"} color="#F5C518" onClick={() => setKpiDetail(machineDash.details.revenue)} />
              <DashboardKpi label={HOUR_LABELS.expenses} value={formatAdminMetric(machineDash.expenseTotal, "money")} sub={machineDash.earlierExpenses > 0 ? `This cycle · ${machineDash.earlierExpenses} earlier` : "This cycle"} color="#F97316" onClick={() => setKpiDetail(machineDash.details.expenses)} />
              <DashboardKpi label={HOUR_LABELS.downtime} value={formatDurationMinutes(machineDash.downtimeMin)} sub="Stopped time on this machine" color="#F2F0EA" onClick={() => setKpiDetail(machineDash.details.downtime)} />
              <DashboardKpi label={HOUR_LABELS.diesel} value={formatAdminMetric(machineDash.litres, "litres")} sub={machineDash.machineHours > 0 ? `${(machineDash.litres / machineDash.machineHours).toFixed(2)} L per machine hour` : "This cycle"} color="#F5C518" onClick={() => setKpiDetail(machineDash.details.diesel)} />
            </div>

            <DispatchKpis records={siteDispatch} siteId={activeSite?.id} period={billingPeriod} factors={getSettingsForSite(activeSite?.id)} onOpen={setKpiDetail} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <DashboardKpi label="Pending sign-off" value={dashboard.overview.pendingVerify} sub="All machines · awaiting supervisor" color="#00A4A6" />
              <DashboardKpi label="Open problems" value={dashboard.overview.openIssues} sub={`${dashboard.overview.criticalIssues} critical · all machines`} color="#EF4444" />
            </div>
            <p className="font-body text-xs text-[#F2F0EA]/40">Sync queue {dashboard.overview.syncPending}</p>

            <section>
              <p className="font-ui text-sm font-semibold text-ops-muted mb-2">Fleet now</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dashboard.fleet.length === 0 ? (
                  <p className="text-sm text-[#F2F0EA]/40">No machines configured.</p>
                ) : dashboard.fleet.map((f) => (
                  <div key={f.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 flex justify-between items-center gap-2">
                    <div>
                      <p className="font-ui text-sm font-semibold">{f.name}</p>
                      {f.stopReason && <p className="text-xs text-[#F97316] mt-0.5">{f.stopReason}</p>}
                    </div>
                    <span className={`font-ui text-xs px-2.5 py-1 rounded-full ${
                      f.status === "running" ? "bg-[#22C55E]/20 text-[#22C55E]"
                        : f.status === "stopped" ? "bg-[#EF4444]/20 text-[#EF4444]"
                          : "bg-[#2A2A2A] text-[#F2F0EA]/50"
                    }`}>
                      {f.status === "running" ? "Running" : f.status === "stopped" ? "Stopped" : "Idle"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {tab === "setup" && !moreView && (
          <div className="space-y-3">
            <p className="font-body text-sm text-[#F2F0EA]/70">Checklists, hours, expenses, and sync. Sites and machines live under Sites.</p>
            <MoreMenu
              items={[
                { label: "Checklists", onClick: () => setMoreView("checklists") },
                { label: "Hours and activity", onClick: () => setMoreView("review") },
                { label: "Expenses", onClick: () => setMoreView("expenses") },
                { label: "Sync and backup", onClick: () => setMoreView("sync") },
              ]}
            />
          </div>
        )}

        {tab === "setup" && moreView && (
          <button type="button" onClick={() => setMoreView(null)} className="mb-3 font-ui text-sm text-[#F5C518]">
            Back to setup steps
          </button>
        )}

        {tab === "setup" && moreView === "checklists" && (
          <AdminChecklistsPanel
            sites={sites}
            siteSettings={siteSettings}
            onSaved={refreshLocal}
            showAlert={showAlert}
          />
        )}

        {tab === "setup" && moreView === "review" && (
          <div className="space-y-4">
            <WorkHoursPanel />
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
          </div>
        )}

        {tab === "setup" && moreView === "expenses" && (
          <SiteExpensesPanel
            expenses={expenses}
            machines={machines}
            siteId={activeSite?.id}
            cycleStartDay={getSettingsForSite(activeSite?.id).billing_cycle_start_day}
            scopeLabel={activeSite?.name || "This site"}
            canEdit
            onSaved={refreshLocal}
          />
        )}

        {tab === "sites" && (
          <div className="space-y-4">
            <AdminSitesPanel sites={sites} machines={machines} siteSettings={siteSettings} onSaved={syncNow} showAlert={showAlert} />
            <AdminMachinesPanel
              sites={sites}
              machines={machines}
              onSaved={refreshLocal}
              showAlert={showAlert}
            />
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 min-w-[140px]" onClick={() => setShowAddUser(true)}>
                Add user
              </Button>
              <Button variant="secondary" onClick={() => setShowInactive(!showInactive)}>
                {showInactive ? "Hide inactive" : "Show inactive"}
              </Button>
            </div>

            {visibleProfiles.length === 0 ? (
              <p className="text-sm text-[#F2F0EA]/40">No users. Sync when online or add a user.</p>
            ) : visibleProfiles.map((p) => (
              <div key={p.id} className={`bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3 ${p.active === false ? "opacity-50" : ""}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-sm font-semibold truncate">{p.name || p.email}</p>
                    <p className="font-body text-xs text-[#F2F0EA]/40 truncate">{p.email}</p>
                    {p.active === false && <p className="text-xs text-[#EF4444] mt-1">Inactive</p>}
                  </div>
                  <select
                    value={p.role || ROLES.OPERATOR}
                    onChange={(e) => handleRoleChange(p.id, e.target.value)}
                    disabled={p.active === false}
                    className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl font-ui text-sm text-[#F2F0EA]"
                  >
                    {MANAGEABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{r === ROLES.DISPATCH ? "Dispatch" : r === ROLES.STOREROOM ? "Storeroom" : r}</option>
                    ))}
                  </select>
                </div>

                {p.active !== false && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      defaultValue={p.site_id || ""}
                      onChange={(e) => updateProfileFields(p.id, { site_id: e.target.value || null }).then(() => refreshLocal())}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl font-ui text-sm text-[#F2F0EA]"
                    >
                      <option value="">No site</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {p.role === ROLES.OPERATOR && (
                      <select
                        defaultValue={p.machine_id || ""}
                        onChange={(e) => updateProfileFields(p.id, { machine_id: e.target.value || null }).then(() => refreshLocal())}
                        className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl font-ui text-sm text-[#F2F0EA]"
                      >
                        <option value="">No default machine</option>
                        {machines.filter((m) => m.site_id === p.site_id).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {p.role === ROLES.OPERATOR && p.active !== false && (
                  <p className="font-body text-xs text-[#F2F0EA]/45">One login records every machine on this site. Each machine still gets its own shift and report.</p>
                )}

                {p.role === ROLES.SUPERVISOR && p.active !== false && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      defaultValue={p.phone || ""}
                      placeholder="WhatsApp phone"
                      onBlur={(e) => updateProfileFields(p.id, { phone: e.target.value.trim() || null }).then(() => refreshLocal())}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl font-body text-sm text-[#F2F0EA]"
                    />
                    <select
                      defaultValue={p.shift_band || "any"}
                      onChange={(e) => updateProfileFields(p.id, { shift_band: e.target.value }).then(() => refreshLocal())}
                      className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl font-ui text-sm text-[#F2F0EA]"
                    >
                      <option value="day">Day shift</option>
                      <option value="night">Night shift</option>
                      <option value="any">All shifts</option>
                    </select>
                  </div>
                )}

                {p.active !== false && p.id !== user?.id && (
                  <Button variant="ghost" className="text-[#EF4444]" onClick={() => handleDeactivate(p)}>
                    Remove user
                  </Button>
                )}
                {p.active === false && (
                  <Button variant="secondary" onClick={() => handleReactivate(p)}>
                    Reactivate
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}



        {tab === "setup" && moreView === "sync" && (

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

            <Button variant="teal" className="w-full mb-3" onClick={() => setShowBackdate(true)}>
              Backdate hour reading
            </Button>

            <div className="flex flex-wrap gap-2">

              <Button className="flex-1 min-w-[120px]" onClick={() => syncNow()}>Force sync</Button>
              <Button variant="danger" className="flex-1 min-w-[120px]" onClick={handleFullRefresh}>Full refresh</Button>
              <Button variant="teal" className="flex-1 min-w-[120px]" onClick={exportJson}>Export JSON</Button>

            </div>

            {syncState.errors?.length > 0 && (

              <div className="bg-[#2a1616] border border-[#EF4444]/30 rounded-xl p-3 text-xs text-[#EF4444]">

                {syncState.errors.slice(0, 5).join(" · ")}

              </div>

            )}

          </div>

        )}



      <KpiDetailModal detail={kpiDetail} onClose={() => setKpiDetail(null)} />

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

