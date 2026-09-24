import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../lib/media.js";
import { asPhotoList, clearInspectionDraft, loadInspectionDraft, saveInspectionDraft } from "../lib/inspectionDraft.js";

async function hydratePhotoPreviews(photos = {}) {
  const out = {};
  await Promise.all(
    Object.entries(photos || {}).map(async ([item, meta]) => {
      const next = await Promise.all(
        asPhotoList(meta).map(async (p) => {
          if (!p?.ref || p.preview) return p;
          const preview = await resolveMediaUrl(p.ref);
          return preview ? { ...p, preview } : p;
        })
      );
      out[item] = next;
    })
  );
  return out;
}

/**
 * Persist in-progress inspection answers across camera / gallery handoff (mobile reload).
 */
export function useInspectionDraft(storageKey, { enabled = true, extra = null } = {}) {
  const hydratedKey = useRef(null);
  const [results, setResults] = useState({});
  const [remarks, setRemarks] = useState({});
  const [photos, setPhotos] = useState({});
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("walk");

  // Load draft when key becomes active
  useEffect(() => {
    if (!enabled || !storageKey) {
      hydratedKey.current = null;
      return;
    }
    if (hydratedKey.current === storageKey) return;
    hydratedKey.current = storageKey;

    const draft = loadInspectionDraft(storageKey);
    if (!draft) {
      setResults({});
      setRemarks({});
      setPhotos({});
      setStep(0);
      setMode("walk");
      return;
    }

    setResults(draft.results || {});
    setRemarks(draft.remarks || {});
    setStep(Number(draft.step) || 0);
    setMode(draft.mode || "walk");

    hydratePhotoPreviews(draft.photos || {}).then(setPhotos);
  }, [enabled, storageKey]);

  const draftPayload = useRef({ results, remarks, photos, step, mode, extra });
  draftPayload.current = { results, remarks, photos, step, mode, extra };

  const flushDraft = useCallback(() => {
    if (!enabled || !storageKey || hydratedKey.current !== storageKey) return;
    saveInspectionDraft(storageKey, draftPayload.current);
  }, [enabled, storageKey]);

  // Save on every change (debounced)
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!enabled || !storageKey || hydratedKey.current !== storageKey) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushDraft, 150);
    return () => clearTimeout(saveTimer.current);
  }, [enabled, storageKey, results, remarks, photos, step, mode, extra, flushDraft]);

  // Flush when camera/gallery hides the page (common on mobile)
  useEffect(() => {
    if (!enabled || !storageKey) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [enabled, storageKey, flushDraft]);

  const clearDraft = useCallback(() => {
    if (storageKey) clearInspectionDraft(storageKey);
    hydratedKey.current = null;
    setResults({});
    setRemarks({});
    setPhotos({});
    setStep(0);
    setMode("walk");
  }, [storageKey]);

  return {
    results,
    setResults,
    remarks,
    setRemarks,
    photos,
    setPhotos,
    step,
    setStep,
    mode,
    setMode,
    clearDraft,
  };
}
