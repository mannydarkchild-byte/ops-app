const PREFIX = "ops-inspection-draft:";

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function asPhotoList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((p) => p && (p.ref || p.preview));
  if (val.ref || val.preview) return [val];
  return [];
}

/** Strip blob/data previews — keep media refs for restore after reload */
function serializePhotos(photos = {}) {
  const out = {};
  for (const [key, val] of Object.entries(photos || {})) {
    const refs = asPhotoList(val).filter((p) => p.ref).map((p) => ({ ref: p.ref }));
    if (refs.length) out[key] = refs;
  }
  return out;
}

export function loadInspectionDraft(key) {
  if (!key) return null;
  return safeParse(sessionStorage.getItem(`${PREFIX}${key}`));
}

export function saveInspectionDraft(key, draft) {
  if (!key || !draft) return;
  try {
    sessionStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({
        ...draft,
        photos: serializePhotos(draft.photos),
        savedAt: Date.now(),
      })
    );
  } catch {
    // Quota exceeded — drop oldest draft keys and retry once
    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));
      if (keys.length) sessionStorage.removeItem(keys[0]);
      sessionStorage.setItem(
        `${PREFIX}${key}`,
        JSON.stringify({ ...draft, photos: serializePhotos(draft.photos), savedAt: Date.now() })
      );
    } catch {}
  }
}

export function clearInspectionDraft(key) {
  if (!key) return;
  sessionStorage.removeItem(`${PREFIX}${key}`);
}

export function prestartDraftKey(userId, machineId, clockIn) {
  if (!userId || !machineId || !clockIn) return null;
  return `prestart:${userId}:${machineId}:${clockIn}`;
}

export function mechanicDraftKey(userId, machineId) {
  if (!userId || !machineId) return null;
  return `mech:${userId}:${machineId}`;
}
