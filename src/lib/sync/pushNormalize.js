import { STORAGE_REF_PREFIX, parseStoragePath } from "../media.js";

function isPersistableMediaRef(v) {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("http")) return true;
  if (v.startsWith(STORAGE_REF_PREFIX)) return true;
  return Boolean(parseStoragePath(v));
}

/** Map local *_ref fields to Supabase media columns; drop unresolved local MEDIA_ ids. */
export function normalizeForSupabasePush(row, table) {
  const out = { ...row };

  const setMedia = (target, ...sources) => {
    const ref = sources.find(isPersistableMediaRef);
    if (ref) out[target] = ref.startsWith(STORAGE_REF_PREFIX) || ref.startsWith("http")
      ? ref
      : `${STORAGE_REF_PREFIX}${parseStoragePath(ref)}`;
  };

  setMedia("photo_data", out.photo_ref, out.photo_data);
  setMedia("photo", out.photo_ref, out.photo);
  setMedia("photo_pump", out.photo_pump_ref, out.photo_pump);
  setMedia("photo_dipstick", out.photo_dipstick_ref, out.photo_dipstick);
  setMedia("receipt_photo", out.receipt_ref, out.receipt_photo);
  setMedia("media_url", out.media_ref, out.media_url);

  if (table === "machine_hour_readings") {
    setMedia("photo_data", out.photo_ref, out.photo_data);
  }

  if (table === "shifts") {
    setMedia("supervisor_signature_ref", out.supervisor_signature_ref, out.supervisor_signature);
  } else if (table === "work_sessions") {
    setMedia("supervisor_signature", out.supervisor_signature_ref, out.supervisor_signature);
  }

  if (table === "issue_messages") {
    if (!isPersistableMediaRef(out.media_url)) delete out.media_url;
  }

  if (table === "events") {
    setMedia("photo_data", out.photo_ref, out.photo_data);
    delete out.photo_ref;
    delete out.photo;
  }

  for (const key of Object.keys(out)) {
    if (!key.endsWith("_ref")) continue;
    if (table === "shifts" && key === "supervisor_signature_ref") continue;
    delete out[key];
  }

  return out;
}
