import { getDB, ensureDB } from "./db.js";
import { supabase } from "./supabase.js";
import { MEDIA_BUCKET } from "./constants.js";
import { makeId } from "./utils.js";

const MAX_PHOTO_EDGE = 1280;
const PHOTO_QUALITY = 0.72;
const SMALL_PHOTO_BYTES = 180_000;

function shouldCompressImage(kind, mimeType) {
  const k = String(kind || "").toLowerCase();
  if (k === "audio" || k.includes("signature")) return false;
  return k === "photo" || k.includes("photo") || String(mimeType || "").startsWith("image/");
}

export async function compressImageBlob(blob, { maxEdge = MAX_PHOTO_EDGE, quality = PHOTO_QUALITY } = {}) {
  if (!blob || typeof createImageBitmap !== "function") return blob;
  const type = blob.type || "image/jpeg";
  if (!type.startsWith("image/") && type !== "application/octet-stream") return blob;
  if (blob.size <= SMALL_PHOTO_BYTES && blob.type === "image/jpeg") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const compressed = await new Promise((resolve) => {
      canvas.toBlob((next) => resolve(next || blob), "image/jpeg", quality);
    });
    return compressed.size < blob.size ? compressed : blob;
  } catch {
    return blob;
  }
}

/** Store a blob locally; returns media ref id */
export async function storeMediaBlob(blob, { mimeType = "image/jpeg", kind = "photo" } = {}) {
  const database = await ensureDB();
  let stored = blob;
  let storedType = mimeType || blob.type || "image/jpeg";
  if (shouldCompressImage(kind, storedType)) {
    stored = await compressImageBlob(blob);
    storedType = stored.type || "image/jpeg";
  }
  const id = makeId("MEDIA");
  await database.media_blobs.put({
    id,
    blob: stored,
    mime_type: storedType,
    kind,
    status: "pending",
    remote_url: null,
    created_at: new Date().toISOString(),
  });
  return id;
}

/** Store base64 data URL as blob */
export async function storeMediaDataUrl(dataUrl, kind = "photo") {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const byteString = atob(b64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: mime });
  return storeMediaBlob(blob, { mimeType: mime, kind });
}

/** Resolve media ref to displayable URL (local blob URL or remote) */
export async function resolveMediaUrl(ref) {
  if (!ref) return null;
  if (ref.startsWith("http") || ref.startsWith("data:") || ref.startsWith("blob:")) return ref;
  const database = await ensureDB();
  const row = await database.media_blobs.get(ref);
  if (!row) return null;
  if (row.remote_url) return row.remote_url;
  if (row.blob) return URL.createObjectURL(row.blob);
  return null;
}

function formatMediaUploadError(mediaId, msg) {
  const tag = mediaId?.startsWith("MEDIA_") ? mediaId : `MEDIA_${mediaId}`;
  return `${tag}: ${msg}`;
}

function safePathPart(value) {
  return String(value || "general").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "general";
}

function sessionLooksFresh(session) {
  const exp = Number(session?.expires_at || 0);
  if (!exp) return Boolean(session?.access_token);
  return exp * 1000 > Date.now() + 30_000;
}

async function ensureAuthForUpload() {
  const { data: { session } } = await supabase.auth.getSession();
  if (sessionLooksFresh(session)) return session;
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data?.session) {
    throw new Error("Session expired. Sign in again to send photos.");
  }
  return data.session;
}

async function uploadToBucket(path, blob, mime) {
  const options = { contentType: mime, cacheControl: "31536000" };
  const first = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { ...options, upsert: false });
  if (!first.error) return first;
  if (/already exists|Duplicate|resource already/i.test(first.error.message || "")) {
    return supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { ...options, upsert: true });
  }
  return first;
}

/** Drop local media ids so row data can upload without a photo URL */
export function stripUnresolvedMediaRefs(record) {
  const out = { ...record };
  for (const [key, val] of Object.entries(out)) {
    if (typeof val === "string" && val.startsWith("MEDIA_")) delete out[key];
  }
  return out;
}

/** Upload pending media blobs; returns count uploaded */
export async function uploadPendingMedia({ machineCode = "general" } = {}) {
  if (!navigator.onLine) return { uploaded: 0, errors: ["offline"] };

  const database = getDB();
  const pending = await database.media_blobs.where("status").equals("pending").toArray();
  if (!pending.length) return { uploaded: 0, errors: [] };
  let uploaded = 0;
  const errors = [];

  try {
    await ensureAuthForUpload();
  } catch (e) {
    return { uploaded: 0, errors: pending.map((item) => formatMediaUploadError(item.id, e.message)) };
  }

  for (const item of pending) {
    try {
      let blob = item.blob;
      let mime = item.mime_type || blob?.type || "image/jpeg";
      if (shouldCompressImage(item.kind, mime) && blob?.size > SMALL_PHOTO_BYTES) {
        blob = await compressImageBlob(blob);
        mime = blob.type || "image/jpeg";
        await database.media_blobs.update(item.id, { blob, mime_type: mime });
      }
      const ext = (mime.split("/")[1] || "bin").split("+")[0];
      const path = `${safePathPart(machineCode)}/${safePathPart(item.kind)}_${safePathPart(item.id)}.${ext}`;
      let { error: upErr } = await uploadToBucket(path, blob, mime);
      if (upErr && /401|403|JWT|expired|row-level security|policy/i.test(upErr.message || "")) {
        await ensureAuthForUpload();
        ({ error: upErr } = await uploadToBucket(path, blob, mime));
      }
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      await database.media_blobs.update(item.id, { status: "uploaded", remote_url: publicUrl });
      uploaded++;
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push(formatMediaUploadError(item.id, msg));
    }
  }

  return { uploaded, errors };
}

/** Replace media refs in payload with remote URLs before push */
export async function resolveMediaRefsInRecord(record) {
  const out = { ...record };
  const refFields = Object.keys(out).filter((k) => k.endsWith("_ref") || k === "media_ref");
  for (const field of refFields) {
    const ref = out[field];
    if (!ref || ref.startsWith("http")) continue;
    const database = getDB();
    const row = await database.media_blobs.get(ref);
    if (row?.remote_url) out[field] = row.remote_url;
    else if (row?.status === "pending" && navigator.onLine) {
      await uploadPendingMedia();
      const updated = await database.media_blobs.get(ref);
      if (updated?.remote_url) out[field] = updated.remote_url;
    }
  }
  // Legacy: inline base64 photo fields
  for (const field of Object.keys(out)) {
    if ((field.includes("photo") || field === "supervisor_signature") && out[field]?.startsWith?.("data:")) {
      const ref = await storeMediaDataUrl(out[field], field);
      if (typeof ref === "string" && !ref.startsWith("data:")) {
        const url = await resolveMediaUrl(ref);
        if (url?.startsWith("http")) out[field.replace(/_ref$/, "")] = url;
      }
    }
  }
  return stripUnresolvedMediaRefs(out);
}

export function pickMedia(kind, onResult, { fromGallery = false } = {}) {
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "photo" ? "image/*" : kind === "audio" ? "audio/*" : "*/*";
    if (kind === "photo" && !fromGallery) input.capture = "environment";
    input.style.display = "none";
    input.setAttribute("aria-hidden", "true");

    const cleanup = () => {
      window.setTimeout(() => {
        try { input.remove(); } catch {}
      }, 30000);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        return;
      }
      try {
        const ref = await storeMediaBlob(file, { mimeType: file.type, kind });
        const stored = await getDB().media_blobs.get(ref);
        const url = stored?.blob ? URL.createObjectURL(stored.blob) : URL.createObjectURL(file);
        onResult({ ref, data: url, type: stored?.mime_type || file.type, file: stored?.blob || file });
      } finally {
        input.value = "";
        cleanup();
      }
    };

    input.oncancel = cleanup;
    document.body.appendChild(input);
    input.click();
  } catch (e) {
    console.warn("pickMedia failed:", e);
  }
}

export function takePhoto(onResult) {
  pickMedia("photo", onResult, { fromGallery: false });
}

export function pickGalleryPhoto(onResult) {
  pickMedia("photo", onResult, { fromGallery: true });
}

/** Record voice note via MediaRecorder */
export function recordVoiceNote(onResult, onError) {
  if (!navigator.mediaDevices?.getUserMedia) {
    onError?.("Microphone not supported");
    return null;
  }
  let recorder;
  let chunks = [];
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const ref = await storeMediaBlob(blob, { mimeType: blob.type, kind: "audio" });
      onResult({ ref, data: URL.createObjectURL(blob), type: blob.type });
    };
    recorder.start();
  }).catch((e) => onError?.(e.message));
  return {
    stop: () => { try { recorder?.stop(); } catch {} },
  };
}
