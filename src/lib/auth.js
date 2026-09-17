import { supabase } from "./supabase.js";
import { saveLocal, readTable, ensureDB } from "./db.js";

const AUTH_CACHE_KEY = "ops-auth-cache";

export function cacheAuthUser(userId, profile, email) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
      userId,
      profile,
      email,
      savedAt: Date.now(),
    }));
  } catch {}
}

export function readCachedAuthUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCachedAuthUser() {
  try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch {}
}

function offlineProfile(userId, userEmail, cached) {
  if (cached) return { ...cached, email: cached.email || userEmail };
  return {
    id: userId,
    email: userEmail || "",
    name: (userEmail || "").split("@")[0] || "Operator",
    role: "operator",
    site_id: "00000000-0000-0000-0000-000000000001",
    machine_id: "W2100-001",
    active: true,
  };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  clearCachedAuthUser();
  try { await supabase.auth.signOut(); } catch {}
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Load profile from local cache first, then network if online */
export async function loadProfile(userId, userEmail) {
  await ensureDB();
  const localProfiles = await readTable("profiles");
  const cached = localProfiles.find((p) => p.id === userId);

  if (!navigator.onLine) {
    return offlineProfile(userId, userEmail, cached);
  }

  try {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (existing) {
      const profile = { ...existing, email: existing.email || userEmail };
      await saveLocal("profiles", { ...profile, _sync_status: "synced" }, { enqueue: false });
      cacheAuthUser(userId, profile, userEmail);
      return profile;
    }

    const defaultName = (userEmail || "").split("@")[0] || "Operator";
    const newProfile = {
      id: userId,
      email: userEmail || "",
      name: defaultName,
      role: "operator",
      site_id: "00000000-0000-0000-0000-000000000001",
      machine_id: "W2100-001",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (navigator.onLine) {
      const { error: insErr } = await supabase.from("profiles").insert(newProfile);
      if (!insErr) {
        await saveLocal("profiles", { ...newProfile, _sync_status: "synced" }, { enqueue: false });
        cacheAuthUser(userId, newProfile, userEmail);
        return newProfile;
      }
    }

    await saveLocal("profiles", newProfile);
    cacheAuthUser(userId, newProfile, userEmail);
    return newProfile;
  } catch (e) {
    return offlineProfile(userId, userEmail, cached);
  }
}

export async function updateUserRole(userId, newRole) {
  const { error } = await supabase.from("profiles").update({ role: newRole, updated_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
  const profiles = await readTable("profiles");
  const p = profiles.find((x) => x.id === userId);
  if (p) await saveLocal("profiles", { ...p, role: newRole, updated_at: new Date().toISOString() }, { enqueue: false });
}

export async function updateProfileFields(userId, fields) {
  const payload = { ...fields, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
  const profiles = await readTable("profiles");
  const p = profiles.find((x) => x.id === userId);
  if (p) await saveLocal("profiles", { ...p, ...payload, _sync_status: "synced" }, { enqueue: false });
}
