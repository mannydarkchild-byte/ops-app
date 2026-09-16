import { getPendingCount, getSyncMeta, ensureDB } from "../db.js";
import { pushPendingQueue } from "./push.js";
import { pullIncremental, pullBootstrap } from "./pull.js";
import { uploadPendingMedia } from "../media.js";

let syncInProgress = false;
let syncListeners = new Set();
let debounceTimer = null;

export function onSyncStateChange(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

function notify(state) {
  syncListeners.forEach((fn) => { try { fn(state); } catch {} });
}

export async function runSync({ silent = true, forceBootstrap = false, siteId = null } = {}) {
  if (syncInProgress) return { ok: false, skipped: true };
  syncInProgress = true;

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
      const boot = await pullBootstrap({ siteId });
      state.pulled += boot.pulled;
      if (boot.errors?.length) state.errors.push(...boot.errors);
    }

    const media = await uploadPendingMedia();
    state.mediaUploaded = media.uploaded;
    if (media.errors?.length) state.errors.push(...media.errors);

    const push = await pushPendingQueue();
    state.pushed = push.pushed;
    if (push.errors?.length) state.errors.push(...push.errors);

    const pull = await pullIncremental({ siteId });
    state.pulled += pull.pulled;
    if (pull.errors?.length) state.errors.push(...pull.errors);

    state.pending = await getPendingCount();
    state.lastSyncAt = new Date().toISOString();
    state.status = state.errors.length ? "error" : "synced";

    if (!silent) notify(state);
    return { ok: state.errors.length === 0, ...state };
  } catch (e) {
    state.status = "error";
    state.errors.push(e.message);
    state.pending = await getPendingCount();
    notify(state);
    return { ok: false, ...state };
  } finally {
    syncInProgress = false;
  }
}

export function scheduleSync(delayMs = 3000) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runSync({ silent: true }).catch(() => {});
  }, delayMs);
}

export function initSyncListeners({ siteId = null } = {}) {
  const onOnline = () => runSync({ silent: true, siteId });
  window.addEventListener("online", onOnline);

  // Sync when app becomes visible after being hidden (not on every tab switch)
  let hiddenAt = null;
  const onVis = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (document.visibilityState === "visible" && hiddenAt && Date.now() - hiddenAt > 60000) {
      runSync({ silent: true, siteId });
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVis);
    clearTimeout(debounceTimer);
  };
}
