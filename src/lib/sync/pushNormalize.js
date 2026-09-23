function isHttpUrl(v) {
  return typeof v === "string" && v.startsWith("http");
}

/** Map local *_ref fields to Supabase URL columns; drop refs (not in prod schema). */
export function normalizeForSupabasePush(row, table) {
  const out = { ...row };

  const setUrl = (target, ...sources) => {
    const url = sources.find(isHttpUrl);
    if (url) out[target] = url;
  };

  setUrl("photo_data", out.photo_ref, out.photo_data);
  setUrl("photo", out.photo_ref, out.photo);
  setUrl("photo_pump", out.photo_pump_ref, out.photo_pump);
  setUrl("photo_dipstick", out.photo_dipstick_ref, out.photo_dipstick);
  setUrl("receipt_photo", out.receipt_ref, out.receipt_photo);
  setUrl("media_url", out.media_ref, out.media_url);

  if (table === "machine_hour_readings") {
    setUrl("photo_data", out.photo_ref, out.photo_data);
  }

  if (table === "shifts") {
    setUrl("supervisor_signature_ref", out.supervisor_signature_ref, out.supervisor_signature);
  } else if (table === "work_sessions") {
    setUrl("supervisor_signature", out.supervisor_signature_ref, out.supervisor_signature);
  }

  if (table === "issue_messages") {
    if (!isHttpUrl(out.media_url)) delete out.media_url;
  }

  if (table === "events") {
    setUrl("photo_data", out.photo_ref, out.photo_data);
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
