import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { initDB, readTable, saveLocal, getPendingCount } from "../lib/db.js";
import { loadProfile, signIn, signOut, readCachedAuthUser, cacheAuthUser } from "../lib/auth.js";
import { runSync, scheduleSync, initSyncListeners, onSyncStateChange } from "../lib/sync/engine.js";
import { syncMachineLocks } from "../lib/machineLock.js";
import { fetchMachineStatus, isBlockedByOther } from "../lib/machineStatus.js";
import { SHIFT } from "../lib/constants.js";
import { seedLocalDefaults } from "../lib/seed.js";
import { resolveSiteSettings, defaultSiteSettings } from "../lib/siteConfig.js";

const OpsContext = createContext(null);

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used within OpsProvider");
  return ctx;
}

export function OpsProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [syncState, setSyncState] = useState({ status: "idle", pending: 0, errors: [] });

  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [issues, setIssues] = useState([]);
  const [issueMessages, setIssueMessages] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [hourReadings, setHourReadings] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [siteSettings, setSiteSettings] = useState([]);
  const [machineStatus, setMachineStatus] = useState(null);

  const userRef = useRef(null);
  const activeMachineRef = useRef(null);

  const refreshLocal = useCallback(async () => {
    try {
      const [
        s, m, p, sh, ev, ex, ins, iss, msgs, ws, fl, subs, hr, bd, mj, inv, settings,
      ] = await Promise.all([
        readTable("sites"), readTable("machines"), readTable("profiles"),
        readTable("shifts"), readTable("events"), readTable("expenses"),
        readTable("inspections"), readTable("issues"), readTable("issue_messages"),
        readTable("work_sessions"), readTable("fuel_logs"), readTable("shift_submissions"),
        readTable("machine_hour_readings"), readTable("breakdowns"),
        readTable("maintenance_jobs"), readTable("inventory_items"), readTable("site_settings"),
      ]);
      setSites(s); setMachines(m); setProfiles(p);
      setShifts(sh); setEvents(ev); setExpenses(ex); setInspections(ins);
      setIssues(iss); setIssueMessages(msgs); setWorkSessions(ws); setFuelLogs(fl);
      setSubmissions(subs); setHourReadings(hr); setBreakdowns(bd);
      setMaintenanceJobs(mj); setInventoryItems(inv); setSiteSettings(settings);
      const pending = await getPendingCount();
      setSyncState((prev) => ({
        ...prev,
        pending,
        status: navigator.onLine ? prev.status : "offline",
      }));
      if (activeMachineRef.current?.id) {
        try {
          const status = await fetchMachineStatus(activeMachineRef.current.id);
          setMachineStatus(status);
        } catch {}
      }
    } catch (e) {
      console.warn("refreshLocal:", e);
    }
  }, []);

  const activeSite = useMemo(() => {
    const siteId = user?.site_id || sites[0]?.id;
    return sites.find((s) => s.id === siteId) || sites[0] || null;
  }, [user, sites]);

  const activeMachine = useMemo(() => {
    const machineId = user?.machine_id || machines[0]?.id;
    return machines.find((m) => m.id === machineId) || machines[0] || null;
  }, [user, machines]);

  useEffect(() => { activeMachineRef.current = activeMachine; }, [activeMachine]);

  const machineRun = useMemo(
    () => shifts.find((s) =>
      s.machine_id === activeMachine?.id &&
      (s.shift_status === SHIFT.RUNNING || s.status === SHIFT.RUNNING)
    ),
    [shifts, activeMachine]
  );

  const workSession = useMemo(() => {
    if (!user?.id) return null;
    return workSessions
      .filter((s) => s.status === "active" && s.operator_id === user.id)
      .sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in))[0] || null;
  }, [workSessions, user]);

  const downtime = useMemo(() => {
    if (!machineRun) return null;
    return events.find((e) => e.shift_id === machineRun.id && e.type === "STOP" && e.status === "open") || null;
  }, [events, machineRun]);

  const machineBlocked = useMemo(() => {
    if (!user?.id || !machineStatus) return null;
    if (!isBlockedByOther(machineStatus, user.id)) return null;
    return machineStatus;
  }, [machineStatus, user?.id]);

  const siteSettingsMap = useMemo(
    () => Object.fromEntries(siteSettings.map((row) => [row.site_id, resolveSiteSettings(row)])),
    [siteSettings]
  );

  const getSettingsForSite = useCallback(
    (siteId) => siteSettingsMap[siteId] || resolveSiteSettings(defaultSiteSettings(siteId)),
    [siteSettingsMap]
  );

  const hourMeter = useMemo(() => {
    const verified = shifts.filter((s) => s.machine_id === activeMachine?.id && s.shift_status === SHIFT.VERIFIED && s.end_hour_meter != null);
    if (verified.length) {
      const latest = verified.reduce((a, b) => new Date(b.ended_at || 0) > new Date(a.ended_at || 0) ? b : a);
      return Number(latest.end_hour_meter);
    }
    return Number(activeMachine?.start_hour_meter || 0);
  }, [shifts, activeMachine]);

  const handleSignIn = async (email, password) => {
    setAuthError("");
    try {
      await signIn(email, password);
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        const profile = await loadProfile(s.user.id, s.user.email);
        if (profile.active === false) {
          await signOut();
          setAuthError("This account has been deactivated. Contact your admin.");
          return;
        }
        const merged = { ...s.user, ...profile };
        setUser(merged);
        cacheAuthUser(s.user.id, profile, s.user.email);
      }
    } catch (e) {
      setAuthError(e.message || "Sign in failed");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setSession(null);
  };

  const persistAndSync = useCallback(async (table, record) => {
    await saveLocal(table, record);
    await refreshLocal();
    scheduleSync();
  }, [refreshLocal]);

  const siteIdForSync = user?.site_id || activeSite?.id || null;

  const syncNow = useCallback(async () => {
    await syncMachineLocks();
    const res = await runSync({ silent: false, siteId: siteIdForSync });
    await refreshLocal();
    return res;
  }, [refreshLocal, siteIdForSync]);

  // Auth bootstrap — must never hang on "Loading…" when offline
  useEffect(() => {
    let mounted = true;

    const applyUser = (s, profile) => {
      if (!mounted || !s || !profile) return;
      if (profile.active === false) return false;
      setSession(s);
      setUser({ ...s.user, ...profile });
      cacheAuthUser(s.user.id, profile, s.user.email);
      return true;
    };

    (async () => {
      try {
        await initDB();
        await seedLocalDefaults();

        let session = null;
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          session = s;
        } catch {}

        if (session?.user) {
          try {
            const profile = await loadProfile(session.user.id, session.user.email);
            if (profile.active === false) {
              await signOut();
              setUser(null);
              setSession(null);
            } else {
              applyUser(session, profile);
            }
          } catch {
            const cached = readCachedAuthUser();
            if (cached?.userId === session.user.id) {
              applyUser(session, cached.profile);
            }
          }
        } else if (!navigator.onLine) {
          const cached = readCachedAuthUser();
          if (cached?.profile) {
            setUser({ id: cached.userId, email: cached.email, ...cached.profile });
          }
        }

        if (mounted) {
          setSyncState((prev) => ({
            ...prev,
            status: navigator.onLine ? prev.status : "offline",
          }));
        }
      } catch (e) {
        console.warn("Auth bootstrap:", e);
        const cached = readCachedAuthUser();
        if (cached?.profile && mounted) {
          setUser({ id: cached.userId, email: cached.email, ...cached.profile });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (!s?.user) return;
        try {
          const profile = await loadProfile(s.user.id, s.user.email);
          if (profile.active === false) {
            await signOut();
            setUser(null);
            setSession(null);
            return;
          }
          applyUser(s, profile);
        } catch {
          const cached = readCachedAuthUser();
          if (cached?.userId === s.user.id) applyUser(s, cached.profile);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
      }
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  // Data bootstrap after login
  useEffect(() => {
    if (!user?.id) return;
    userRef.current = user;
    let cleanupSync = () => {};

    (async () => {
      try {
        await refreshLocal();
        const siteId = user?.site_id || activeSite?.id || null;
        if (navigator.onLine) {
          await runSync({ silent: true, siteId });
          await refreshLocal();
        } else {
          setSyncState((prev) => ({ ...prev, status: "offline" }));
        }
        cleanupSync = initSyncListeners({ siteId });
      } catch (e) {
        console.warn("Data bootstrap:", e);
        try { await refreshLocal(); } catch {}
      }
    })();

    const unsub = onSyncStateChange((state) => {
      if (state.complete) {
        if (state.lastSyncAt) {
          setSyncState((prev) => ({
            ...prev,
            status: state.status ?? prev.status,
            pending: state.pending ?? prev.pending,
            lastSyncAt: state.lastSyncAt,
            errors: state.errors?.length ? state.errors : prev.errors,
          }));
        }
        refreshLocal();
        return;
      }
      setSyncState((prev) => ({ ...prev, ...state }));
    });

    return () => { cleanupSync(); unsub(); };
  }, [user?.id, user?.site_id, activeSite?.id, refreshLocal]);

  const value = {
    user, session, loading, authError,
    syncState, syncNow,
    sites, machines, profiles, activeSite, activeMachine,
    shifts, events, expenses, inspections, issues, issueMessages,
    workSessions, fuelLogs, submissions, hourReadings, breakdowns,
    maintenanceJobs, inventoryItems, siteSettings, siteSettingsMap, getSettingsForSite,
    machineRun, workSession, downtime, hourMeter, machineStatus, machineBlocked,
    refreshLocal, persistAndSync, saveLocal,
    setAuthError, signIn: handleSignIn, signOut: handleSignOut,
  };

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
