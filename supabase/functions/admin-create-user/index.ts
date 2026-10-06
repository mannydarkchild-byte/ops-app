import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATABLE_ROLES = new Set(["operator", "mechanic", "supervisor", "manager"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerProfile, error: profileErr } = await callerClient
      .from("profiles")
      .select("role, active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.active === false || callerProfile.role !== "admin") {
      return json({ error: "Admin only" }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const siteId = body.siteId || null;
    const machineId = body.machineId || null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const shiftBand = body.shiftBand || "any";

    if (!email || !password || password.length < 6 || !name) {
      return json({ error: "Email, name, and password (6+ chars) required" }, 400);
    }
    if (!CREATABLE_ROLES.has(role)) {
      return json({ error: "Invalid role for new user" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (createErr) {
      return json({ error: createErr.message || "Could not create user" }, 400);
    }
    if (!created?.user?.id) {
      return json({ error: "User was not created" }, 500);
    }

    const profile = {
      id: created.user.id,
      email,
      name,
      role,
      site_id: siteId,
      machine_id: role === "operator" ? machineId : null,
      phone,
      shift_band: shiftBand,
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
    if (upsertErr) {
      return json({ error: upsertErr.message || "User created but profile update failed" }, 500);
    }

    return json({
      user: { id: created.user.id, email },
      profile,
      needsEmailConfirm: false,
    });
  } catch (e) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
});
