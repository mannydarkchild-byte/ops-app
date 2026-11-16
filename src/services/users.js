import { supabase, createEphemeralAuthClient } from "../lib/supabase.js";
import { saveLocal, readTable } from "../lib/db.js";
import { ROLES } from "../lib/constants.js";
import { nowISO } from "../lib/utils.js";

const CREATABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.DISPATCH, ROLES.STOREROOM];
const CONFIRM_REDIRECT = "https://opsapp.africa/";

export { CREATABLE_ROLES };

/** Create auth user + profile without replacing the admin's login. */
export async function adminCreateUser({ email, password, name, role, siteId, machineId, phone, shiftBand }) {
  if (!CREATABLE_ROLES.includes(role)) throw new Error("Invalid role for new user");
  if (!email?.trim() || !password || password.length < 6) throw new Error("Email and password (6+ chars) required");
  if (!name?.trim()) throw new Error("Enter the person's name");

  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession) throw new Error("Sign in as admin first");

  const guest = createEphemeralAuthClient();
  const { data, error } = await guest.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: CONFIRM_REDIRECT,
      data: {
        name: name.trim(),
        role,
        site_id: siteId || "",
        machine_id: role === ROLES.OPERATOR ? (machineId || "") : "",
      },
    },
  });
  try { await guest.auth.signOut(); } catch {}

  if (error) {
    const msg = error.message || "Could not create user";
    if (/already/i.test(msg) || error.status === 422) {
      throw new Error("That email is already on OPS.");
    }
    throw new Error(msg);
  }
  if (!data.user?.id) throw new Error("User was not created — try a different email");

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
  if (profileErr) throw new Error(profileErr.message || "Account created, but the profile did not save. Open People and set their site and role.");

  await saveLocal("profiles", { ...profile, created_at: nowISO(), _sync_status: "synced" }, { enqueue: false });

  const { data: { session: stillAdmin } } = await supabase.auth.getSession();
  if (!stillAdmin && adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }

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
