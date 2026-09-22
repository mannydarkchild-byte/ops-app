import { getDB, ensureDB } from "./db.js";
import { supabase } from "./supabase.js";
import { MEDIA_BUCKET } from "./constants.js";
import { makeId } from "./utils.js";

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

export function pickMedia(kind, onResult) {
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "photo" ? "image/*" : kind === "audio" ? "audio/*" : "*/*";
    input.capture = kind === "photo" ? "environment" : undefined;
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
  pickMedia("photo", onResult);
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
