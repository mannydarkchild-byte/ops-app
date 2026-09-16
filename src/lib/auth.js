import { supabase } from "./supabase.js";
import { saveLocal, readTable, ensureDB } from "./db.js";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
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

  if (!navigator.onLine && cached) {
    return { ...cached, email: cached.email || userEmail };
  }

  try {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (existing) {
      await saveLocal("profiles", { ...existing, _sync_status: "synced" }, { enqueue: false });
      return { ...existing, email: existing.email || userEmail };
    }

    if (!navigator.onLine && cached) return cached;

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
        return newProfile;
      }
    }

    await saveLocal("profiles", newProfile);
    return newProfile;
  } catch (e) {
    if (cached) return cached;
    throw e;
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
