import { supabase } from "../lib/supabase.js";
import { saveLocal, readTable } from "../lib/db.js";
import { ROLES } from "../lib/constants.js";
import { nowISO } from "../lib/utils.js";

const CREATABLE_ROLES = [ROLES.OPERATOR, ROLES.MECHANIC, ROLES.SUPERVISOR, ROLES.MANAGER];

export { CREATABLE_ROLES };

/**
 * Create auth user + profile via Edge Function (service_role server-side).
 * Requires deployed function `admin-create-user` and Dashboard Auth public sign-ups OFF.
 */
export async function adminCreateUser({ email, password, name, role, siteId, machineId, phone, shiftBand }) {
  if (!CREATABLE_ROLES.includes(role)) throw new Error("Invalid role for new user");
  if (!email?.trim() || !password || password.length < 6) throw new Error("Email and password (6+ chars) required");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Admin session required");

  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      email: email.trim(),
      password,
      name: name.trim(),
      role,
      siteId: siteId || null,
      machineId: machineId || null,
      phone: phone?.trim() || null,
      shiftBand: shiftBand || "any",
    },
  });

  if (error) {
    const detail = error.message || "Could not create user";
    throw new Error(
      /Failed to send|FunctionsFetchError|not found|404/i.test(detail)
        ? "User create function is not deployed. Deploy supabase/functions/admin-create-user and disable public Auth sign-ups."
        : detail
    );
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.user?.id || !data?.profile) throw new Error("User was not created — check if email already exists");

  const profile = {
    ...data.profile,
    updated_at: data.profile.updated_at || nowISO(),
  };

  await saveLocal("profiles", { ...profile, created_at: nowISO(), _sync_status: "synced" }, { enqueue: false });

  return {
    user: data.user,
    profile,
    needsEmailConfirm: Boolean(data.needsEmailConfirm),
  };
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
