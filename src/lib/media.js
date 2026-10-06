import { getDB, ensureDB } from "./db.js";
import { supabase } from "./supabase.js";
import { MEDIA_BUCKET } from "./constants.js";
import { makeId } from "./utils.js";

/** Stored in DB / media_blobs instead of public URLs (private bucket). */
export const STORAGE_REF_PREFIX = "storage:";

const SIGNED_URL_TTL_SEC = 60 * 60;
const signedUrlCache = new Map();

/** Store a blob locally; returns media ref id */
export async function storeMediaBlob(blob, { mimeType = "image/jpeg", kind = "photo" } = {}) {
  const database = await ensureDB();
  const id = makeId("MEDIA");
  await database.media_blobs.put({
    id,
    blob,
    mime_type: mimeType,
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

export function toStorageRef(path) {
  if (!path) return null;
  if (path.startsWith(STORAGE_REF_PREFIX)) return path;
  return `${STORAGE_REF_PREFIX}${path.replace(/^\/+/, "")}`;
}

/** Extract bucket-relative path from storage: refs or legacy public/signed URLs. */
export function parseStoragePath(ref) {
  if (!ref || typeof ref !== "string") return null;
  if (ref.startsWith(STORAGE_REF_PREFIX)) return ref.slice(STORAGE_REF_PREFIX.length);
  if (ref.startsWith("MEDIA_") || ref.startsWith("data:") || ref.startsWith("blob:")) return null;

  const m = ref.match(/\/storage\/v1\/object\/(?:public|sign)\/ops-media\/([^?]+)/i);
  if (m) return decodeURIComponent(m[1]);

  // Bare relative path written by older clients after upload
  if (!ref.includes("://") && !ref.includes(" ") && ref.includes("/")) return ref.replace(/^\/+/, "");

  return null;
}

async function createSignedMediaUrl(path, expiresIn = SIGNED_URL_TTL_SEC) {
  const cacheKey = path;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;

  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  const url = data?.signedUrl;
  if (!url) throw new Error("Could not create signed media URL");
  signedUrlCache.set(cacheKey, { url, expiresAt: Date.now() + expiresIn * 1000 });
  return url;
}

/** Resolve media ref to displayable URL (local blob URL, signed remote, or data) */
export async function resolveMediaUrl(ref) {
  if (!ref) return null;
  if (ref.startsWith("data:") || ref.startsWith("blob:")) return ref;

  const storagePath = parseStoragePath(ref);
  if (storagePath) {
    try {
      return await createSignedMediaUrl(storagePath);
    } catch (e) {
      console.warn("resolveMediaUrl signed:", e);
      return null;
    }
  }

  if (ref.startsWith("http")) return ref;

  const database = await ensureDB();
  const row = await database.media_blobs.get(ref);
  if (!row) return null;
  if (row.remote_url) {
    const path = parseStoragePath(row.remote_url);
    if (path) {
      try {
        return await createSignedMediaUrl(path);
      } catch (e) {
        console.warn("resolveMediaUrl blob signed:", e);
      }
    }
    if (row.remote_url.startsWith("http")) return row.remote_url;
  }
  if (row.blob) return URL.createObjectURL(row.blob);
  return null;
}

function formatMediaUploadError(mediaId, msg) {
  const tag = mediaId?.startsWith("MEDIA_") ? mediaId : `MEDIA_${mediaId}`;
  return `${tag}: ${msg}`;
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
  let uploaded = 0;
  const errors = [];

  for (const item of pending) {
    try {
      const ext = (item.mime_type?.split("/")[1] || "bin").split("+")[0];
      const path = `${machineCode}/${item.kind}_${item.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, item.blob, { contentType: item.mime_type, upsert: true, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const storageRef = toStorageRef(path);
      await database.media_blobs.update(item.id, { status: "uploaded", remote_url: storageRef });
      uploaded++;
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push(formatMediaUploadError(item.id, msg));
    }
  }

  return { uploaded, errors };
}

/** Replace media refs in payload with storage refs (or signed-ready paths) before push */
export async function resolveMediaRefsInRecord(record) {
  const out = { ...record };
  const refFields = Object.keys(out).filter((k) => k.endsWith("_ref") || k === "media_ref");
  for (const field of refFields) {
    const ref = out[field];
    if (!ref || ref.startsWith("http") || ref.startsWith(STORAGE_REF_PREFIX)) continue;
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
        await uploadPendingMedia();
        const database = getDB();
        const row = await database.media_blobs.get(ref);
        if (row?.remote_url) {
          const target = field.endsWith("_ref") ? field : field;
          out[target] = row.remote_url;
        }
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
        const url = URL.createObjectURL(file);
        onResult({ ref, data: url, type: file.type, file });
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
