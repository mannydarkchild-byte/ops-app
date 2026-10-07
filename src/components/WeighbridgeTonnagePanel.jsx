import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { pickGalleryPhoto, resolveMediaUrl, takePhoto } from "../lib/media.js";
import { fmtDateShort } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

const BAND_OPTIONS = [
  { id: "day", label: "Day shift" },
  { id: "night", label: "Night shift" },
];

function defaultBand(user) {
  if (user?.shift_band === "day" || user?.shift_band === "night") return user.shift_band;
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function formatTonnes(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

/** Compact KPI strip for Home / Reports — tappable when callbacks are set. */
export function TonnageSummaryKpis({ rows, periodLabel, onTonnesClick, onTrucksClick }) {
  const { tonnes, trucks, count } = useMemo(() => {
    let tonnes = 0;
    let trucks = 0;
    for (const r of rows || []) {
      tonnes += Number(r.total_tonnes) || 0;
      trucks += Number(r.trucks_loaded) || 0;
    }
    return { tonnes, trucks, count: (rows || []).length };
  }, [rows]);

  const Tile = ({ label, value, sub, color, onClick }) => {
    const Tag = onClick ? "button" : "div";
    return (
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={`bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 text-left w-full ${onClick ? "cursor-pointer active:scale-[0.99]" : ""}`}
        aria-label={onClick ? `${label}: ${value}. Tap for details.` : undefined}
      >
        <div className="flex justify-between items-start gap-2">
          <p className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">{label}</p>
          {onClick ? <span className="font-logo text-sm text-[#F5C518] leading-none" aria-hidden>›</span> : null}
        </div>
        <p className="font-logo text-2xl mt-1" style={{ color }}>{value}</p>
        <p className="font-body text-xs text-[#F2F0EA]/50 mt-1">{sub}</p>
        {onClick ? <p className="font-ui text-[10px] text-[#F5C518]/80 mt-1">Tap for details</p> : null}
      </Tag>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile
        label="TONNES"
        value={formatTonnes(tonnes)}
        sub={`${periodLabel || "Selected period"} · ${count} entr${count === 1 ? "y" : "ies"}`}
        color="#F5C518"
        onClick={onTonnesClick}
      />
      <Tile
        label="TRUCKS LOADED"
        value={trucks}
        sub="Weighbridge · this site"
        color="#F2F0EA"
        onClick={onTrucksClick}
      />
    </div>
  );
}

function TonnageRow({ row, onOpenPhoto }) {
  const band = row.shift_band === "night" ? "Night" : "Day";
  const hasPhoto = !!(row.photo_ref || row.photo_url);
  return (
    <button
      type="button"
      onClick={() => hasPhoto && onOpenPhoto?.(row)}
      className={`ops-list-row w-full text-left bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-3 ${hasPhoto ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-logo text-sm text-[#F2F0EA]">
          {fmtDateShort(row.shift_date || row.period_start)} · {band}
        </p>
        <p className="font-body text-xs text-[#F2F0EA]/70 mt-0.5">
          {formatTonnes(row.total_tonnes)} t · {Number(row.trucks_loaded) || 0} trucks
          {row.submitted_by_name ? ` · ${row.submitted_by_name}` : ""}
        </p>
      </div>
      {hasPhoto ? (
        <span className="font-logo text-xs text-[#F5C518] shrink-0">Photo ›</span>
      ) : (
        <span className="font-logo text-xs text-[#F2F0EA]/30 shrink-0">No photo</span>
      )}
    </button>
  );
}

/** Supervisor entry + recent list (Live / Reports) */
export function WeighbridgeTonnagePanel({
  user,
  site,
  rows = [],
  onDone,
  showForm = true,
  title = "Weighbridge tonnage",
  emptyLabel = "No weighbridge entries yet.",
}) {
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shiftBand, setShiftBand] = useState(() => defaultBand(user));
  const [totalTonnes, setTotalTonnes] = useState("");
  const [trucksLoaded, setTrucksLoaded] = useState("");
  const [photoRef, setPhotoRef] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoView, setPhotoView] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoRef) {
      setPhotoPreview(null);
      return undefined;
    }
    resolveMediaUrl(photoRef).then((url) => {
      if (!cancelled) setPhotoPreview(url);
    });
    return () => { cancelled = true; };
  }, [photoRef]);

  useEffect(() => {
    let cancelled = false;
    if (!photoView?.id) return undefined;
    const ref = photoView.photo_ref || photoView.photo_url;
    if (!ref || photoView.url) return undefined;
    resolveMediaUrl(ref).then((url) => {
      if (!cancelled) setPhotoView((prev) => (prev && prev.id === photoView.id ? { ...prev, url } : prev));
    });
    return () => { cancelled = true; };
  }, [photoView]);

  const sorted = useMemo(
    () => [...(rows || [])].sort((a, b) => String(b.shift_date || "").localeCompare(String(a.shift_date || ""))
      || String(b.created_at || "").localeCompare(String(a.created_at || ""))),
    [rows]
  );

  const canSave = Number(totalTonnes) > 0
    && Number.isFinite(Number(trucksLoaded))
    && Number(trucksLoaded) >= 0
    && !!photoRef
    && !!site?.id
    && !busy;

  const attachPhoto = (fromGallery) => {
    const picker = fromGallery ? pickGalleryPhoto : takePhoto;
    picker(({ ref }) => {
      setPhotoRef(ref);
      setError("");
    });
  };

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      await wf.addShiftTonnage(user, site, {
        shiftDate,
        shiftBand,
        totalTonnes,
        trucksLoaded,
        photoRef,
      });
      setTotalTonnes("");
      setTrucksLoaded("");
      setPhotoRef(null);
      setPhotoPreview(null);
      await onDone?.();
    } catch (e) {
      setError(e?.message || "Could not save weighbridge entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <div>
            <p className="font-logo text-xl text-[#F2F0EA]">{title}</p>
            <p className="font-body text-sm text-[#F2F0EA]/60 mt-1">
              Photo of the weighbridge screen, total tonnes, and trucks loaded for this shift.
            </p>
          </div>

          <label className="block">
            <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">SHIFT DATE</span>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="ops-select mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
            />
          </label>

          <label className="block">
            <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">SHIFT</span>
            <div className="relative mt-1">
              <select
                value={shiftBand}
                onChange={(e) => setShiftBand(e.target.value)}
                className="ops-select w-full appearance-none bg-[#0A0A0A] border border-[#2A2A2A] p-3 pr-10 rounded-xl text-[#F2F0EA]"
              >
                {BAND_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F2F0EA]/50" aria-hidden>›</span>
            </div>
          </label>

          <label className="block">
            <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">TOTAL TONNES</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={totalTonnes}
              onChange={(e) => setTotalTonnes(e.target.value)}
              placeholder="e.g. 420"
              className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-xl"
            />
          </label>

          <label className="block">
            <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">TRUCKS LOADED</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={trucksLoaded}
              onChange={(e) => setTrucksLoaded(e.target.value)}
              placeholder="e.g. 18"
              className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-xl"
            />
          </label>

          <div>
            <span className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/50">WEIGHBRIDGE PHOTO</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => attachPhoto(false)}>
                Take photo
              </Button>
              <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => attachPhoto(true)}>
                From gallery
              </Button>
            </div>
            {photoPreview ? (
              <img src={photoPreview} alt="Weighbridge report" className="mt-2 w-full max-h-48 object-contain rounded-xl border border-[#2A2A2A] bg-black" />
            ) : (
              <p className="font-body text-xs text-[#F2F0EA]/40 mt-2">Required — photo of the weighbridge computer screen.</p>
            )}
          </div>

          {error && <p className="font-body text-sm text-[#EF4444]">{error}</p>}

          <Button type="button" variant="primary" size="lg" className="w-full font-logo" onClick={submit} disabled={!canSave}>
            {busy ? "Saving…" : "Save weighbridge entry"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="font-logo text-sm text-[#F2F0EA]/70">Recent entries</p>
        {sorted.length === 0 ? (
          <p className="font-body text-sm text-[#F2F0EA]/40 text-center py-6">{emptyLabel}</p>
        ) : (
          sorted.slice(0, 20).map((row) => (
            <TonnageRow key={row.id} row={row} onOpenPhoto={(r) => setPhotoView({ ...r, url: null })} />
          ))
        )}
      </div>

      {photoView && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setPhotoView(null)} role="presentation">
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Weighbridge photo">
            <div className="flex items-center justify-between gap-2">
              <p className="font-logo text-sm text-[#F2F0EA]">
                {fmtDateShort(photoView.shift_date)} · {photoView.shift_band === "night" ? "Night" : "Day"}
              </p>
              <button type="button" className="font-ui text-sm text-[#F5C518]" onClick={() => setPhotoView(null)}>Close</button>
            </div>
            <p className="font-body text-sm text-[#F2F0EA]/70">
              {formatTonnes(photoView.total_tonnes)} t · {Number(photoView.trucks_loaded) || 0} trucks
            </p>
            {photoView.url ? (
              <img src={photoView.url} alt="Weighbridge report" className="w-full max-h-[70vh] object-contain rounded-xl bg-black" />
            ) : (
              <p className="font-body text-sm text-[#F2F0EA]/40">Loading photo…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
