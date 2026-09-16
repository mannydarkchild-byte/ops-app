import { supabase } from "../lib/supabase.js";
import { saveLocal, readTable } from "../lib/db.js";
import { ROLES } from "../lib/constants.js";
import { nowISO } from "../lib/utils.js";

const CREATABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER];

export { CREATABLE_ROLES };

/** Create auth user + profile (admin only). Restores admin session after signUp. */
export async function adminCreateUser({ email, password, name, role, siteId, machineId, phone, shiftBand }) {
  if (!CREATABLE_ROLES.includes(role)) throw new Error("Invalid role for new user");
  if (!email?.trim() || !password || password.length < 6) throw new Error("Email and password (6+ chars) required");

  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession) throw new Error("Admin session required");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name.trim(), role },
    },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error("User was not created — check if email already exists");

  const profile = {
    id: data.user.id,
    email: email.trim(),
    name: name.trim(),
    role,
    site_id: siteId || null,
    machine_id: role === ROLES.OPERATOR ? machineId || null : null,
    phone: phone?.trim() || null,
    shift_band: shiftBand || "any",
    active: true,
    updated_at: nowISO(),
  };

  const { error: profileErr } = await supabase.from("profiles").update(profile).eq("id", data.user.id);
  if (profileErr) throw profileErr;

  await saveLocal("profiles", { ...profile, created_at: nowISO(), _sync_status: "synced" }, { enqueue: false });

  await supabase.auth.setSession({
    access_token: adminSession.access_token,
    refresh_token: adminSession.refresh_token,
  });

  return { user: data.user, profile, needsEmailConfirm: !data.session };
}

/** Soft-remove — cannot delete auth.users from client */
export async function deactivateUser(userId) {
  const { error } = await supabase.from("profiles").update({ active: false, updated_at: nowISO() }).eq("id", userId);
  if (error) throw error;
  const profiles = await readTable("profiles");
  const p = profiles.find((x) => x.id === userId);
  if (p) await saveLocal("profiles", { ...p, active: false, updated_at: nowISO(), _sync_status: "synced" }, { enqueue: false });
}

export async function reactivateUser(userId) {
  const { error } = await supabase.from("profiles").update({ active: true, updated_at: nowISO() }).eq("id", userId);
  if (error) throw error;
  const profiles = await readTable("profiles");
  const p = profiles.find((x) => x.id === userId);
  if (p) await saveLocal("profiles", { ...p, active: true, updated_at: nowISO(), _sync_status: "synced" }, { enqueue: false });
}
