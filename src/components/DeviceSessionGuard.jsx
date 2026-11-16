import { useEffect, useRef } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { supabase } from "../lib/supabase.js";
import { adoptDeviceLogin, isTakenOver, recentlyClaimed } from "../lib/deviceLogin.js";
import { hasPendingVerifyLink } from "../lib/machineStatus.js";

/** If this account signed in elsewhere, leave this device quietly. Never block a fresh login. */
export function DeviceSessionGuard() {
  const { user, signOut } = useOps();
  const kicking = useRef(false);

  useEffect(() => {
    kicking.current = false;
    if (!user?.id || !navigator.onLine) return undefined;
    let cancelled = false;

    const leaveQuietly = async () => {
      if (kicking.current || cancelled || recentlyClaimed() || hasPendingVerifyLink()) return;
      kicking.current = true;
      try { await signOut(); } catch {}
    };

    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("active_login_id").eq("id", user.id).maybeSingle();
        if (cancelled) return;
        if (isTakenOver(data)) {
          await leaveQuietly();
          return;
        }
        await adoptDeviceLogin(user.id, data);
      } catch {}
    })();

    const channel = supabase
      .channel(`login-guard:${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        if (isTakenOver(payload.new)) leaveQuietly();
      })
      .subscribe();

    const poll = window.setInterval(async () => {
      if (!navigator.onLine || kicking.current || recentlyClaimed() || hasPendingVerifyLink()) return;
      try {
        const { data } = await supabase.from("profiles").select("active_login_id").eq("id", user.id).maybeSingle();
        if (isTakenOver(data)) await leaveQuietly();
      } catch {}
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [user?.id, signOut]);

  return null;
}
