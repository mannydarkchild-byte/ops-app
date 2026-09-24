import { getPendingCount, getStuckQueueErrors, getSyncMeta, ensureDB } from "../db.js";
import { syncMachineLocks } from "../machineLock.js";
import { pushPendingQueue } from "./push.js";
import { pullIncremental, pullBootstrap } from "./pull.js";
import { uploadPendingMedia } from "../media.js";

let syncInProgress = false;
let syncListeners = new Set();
let debounceTimer = null;
let syncSiteId = null;
/** @type {Promise<any> | null} */
let activeSyncPromise = null;

export function onSyncStateChange(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

function notify(state) {
  syncListeners.forEach((fn) => { try { fn(state); } catch {} });
}

function finishState(state, { silent = true } = {}) {
  notify({ ...state, complete: true, silent });
  return state;
}

export async function runSync({ silent = true, forceBootstrap = false, forcePush = false, siteId = null } = {}) {
  if (syncInProgress && activeSyncPromise) {
    return activeSyncPromise;
  }

  const effectiveSiteId = siteId ?? syncSiteId;
  syncInProgress = true;

  activeSyncPromise = (async () => {
    const state = {
      status: navigator.onLine ? "syncing" : "offline",
      pushed: 0,
      pulled: 0,
      mediaUploaded: 0,
      pending: 0,
      errors: [],
      lastSyncAt: null,
    };

    notify(state);

    if (!navigator.onLine) {
      state.status = "offline";
      state.pending = await getPendingCount();
      syncInProgress = false;
      notify(state);
      return { ok: false, ...state };
    }

    try {
      await ensureDB();

      const bootstrapped = await getSyncMeta("bootstrapped_at");
      if (!bootstrapped || forceBootstrap) {
        const boot = await pullBootstrap({ siteId: effectiveSiteId });
        state.pulled += boot.pulled;
        if (boot.errors?.length) state.errors.push(...boot.errors);
      }

      const media = await uploadPendingMedia();
      state.mediaUploaded = media.uploaded;
      if (media.errors?.length) state.errors.push(...media.errors);

      await syncMachineLocks();

      const push = await pushPendingQueue({ force: forcePush });
      state.pushed = push.pushed;
      if (push.errors?.length) state.errors.push(...push.errors);

      const pull = await pullIncremental({ siteId: effectiveSiteId });
      state.pulled += pull.pulled;
      if (pull.errors?.length) state.errors.push(...pull.errors);

      state.pending = await getPendingCount();
      if (state.pending > 0 && state.errors.length === 0) {
        const stuck = await getStuckQueueErrors();
        if (stuck.length) state.errors.push(...stuck);
        else state.errors.push(`${state.pending} item(s) still waiting to upload.`);
      }
      state.lastSyncAt = new Date().toISOString();
      const hardFail = state.pending > 0 && state.pushed === 0 && state.pulled === 0;
      const softFail = state.pending > 0 && state.errors.length > 0;
      state.status = hardFail || softFail ? "error" : "synced";

      finishState(state, { silent });
      return { ok: !hardFail, ...state };
    } catch (e) {
      state.status = "error";
      state.errors.push(e.message);
      state.pending = await getPendingCount();
      state.lastSyncAt = new Date().toISOString();
      finishState(state, { silent });
      return { ok: false, ...state };
    } finally {
      syncInProgress = false;
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/** Saves stay on the phone until the operator taps Update. */
export function scheduleSync() {
  clearTimeout(debounceTimer);
}

export function initSyncListeners({ siteId = null } = {}) {
  syncSiteId = siteId || null;
  const markConnection = () => {
    notify({ status: navigator.onLine ? "idle" : "offline" });
  };
  window.addEventListener("online", markConnection);
  window.addEventListener("offline", markConnection);
  markConnection();

  return () => {
    window.removeEventListener("online", markConnection);
    window.removeEventListener("offline", markConnection);
    clearTimeout(debounceTimer);
  };
}
