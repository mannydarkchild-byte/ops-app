export const WEIGHBRIDGE_PHOTO_MAX = 3;
export const WEIGHBRIDGE_PHOTO_MIN = 2;

function isRef(value) {
  return typeof value === "string" && value.trim();
}

function photoUrlOrNull(ref) {
  if (!isRef(ref)) return null;
  const t = ref.trim();
  return t.startsWith("http") || t.startsWith("data:") ? t : null;
}

/** Up to three weighbridge ticket photos from a day row or form payload. */
export function weighbridgePhotoRefs(row) {
  if (!row) return [];
  const extra = Array.isArray(row.photoRefs)
    ? row.photoRefs
    : Array.isArray(row.weighbridge_photo_refs)
      ? row.weighbridge_photo_refs
      : [];
  const slots = [
    row.weighbridge_photo_ref || row.weighbridge_photo || row.photoRef,
    row.weighbridge_photo_2_ref || row.weighbridge_photo_2,
    row.weighbridge_photo_3_ref || row.weighbridge_photo_3,
    ...extra,
  ];
  const seen = new Set();
  const out = [];
  for (const value of slots) {
    if (!isRef(value)) continue;
    const t = value.trim();
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= WEIGHBRIDGE_PHOTO_MAX) break;
  }
  return out;
}

export function weighbridgePhotoFields(refs) {
  const list = weighbridgePhotoRefs({ photoRefs: refs });
  return {
    weighbridge_photo_ref: list[0] || null,
    weighbridge_photo_2_ref: list[1] || null,
    weighbridge_photo_3_ref: list[2] || null,
    weighbridge_photo: photoUrlOrNull(list[0]),
    weighbridge_photo_2: photoUrlOrNull(list[1]),
    weighbridge_photo_3: photoUrlOrNull(list[2]),
  };
}
