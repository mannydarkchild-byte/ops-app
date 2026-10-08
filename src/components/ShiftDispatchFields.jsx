import { pickGalleryPhoto, takePhoto } from "../lib/media.js";

function CountField({ label, hint, value, onChange, step = "1", placeholder = "0" }) {
  return (
    <label className="block">
      <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">{label}</span>
      {hint && <span className="block font-body text-xs text-[#F2F0EA]/45 mt-0.5">{hint}</span>}
      <input
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
      />
    </label>
  );
}

export function ShiftDispatchFields({
  excavatorBuckets,
  felBuckets,
  tonnes,
  trucks,
  photoPreview,
  excavatorEach,
  felEach,
  onExcavator,
  onFel,
  onTonnes,
  onTrucks,
  onPhoto,
}) {
  const take = (fromGallery) => {
    const pick = fromGallery ? pickGalleryPhoto : takePhoto;
    pick(({ ref, data }) => onPhoto(ref, data));
  };
  const eachLabel = (n) => (Number(n) > 0 ? `${n} t each` : "Bucket size not set");

  return (
    <div className="space-y-3">
      <CountField
        label="EXCAVATOR BUCKETS"
        hint={`Estimates tonnes screened. ${eachLabel(excavatorEach)}`}
        value={excavatorBuckets}
        onChange={onExcavator}
      />
      <CountField
        label="FEL BUCKETS"
        hint={`Estimates tonnes on the floor. ${eachLabel(felEach)}`}
        value={felBuckets}
        onChange={onFel}
      />
      <div>
        <p className="font-logo text-[10px] text-[#F5C518] tracking-wider mb-1">WEIGHBRIDGE REPORT</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mb-2">
          Photograph the weighbridge report, then enter the tonnes and trucks it shows.
        </p>
        {photoPreview && (
          <img src={photoPreview} alt="Weighbridge report" className="w-full max-h-40 object-contain rounded-2xl bg-[#0A0A0A] mb-2" />
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => take(false)} className="py-3 rounded-full border border-[#F5C518]/50 text-[#F5C518] font-logo text-xs">
            {photoPreview ? "Retake photo" : "Take photo"}
          </button>
          <button type="button" onClick={() => take(true)} className="py-3 rounded-full border border-[#2A2A2A] text-[#F2F0EA]/80 font-logo text-xs">
            Choose photo
          </button>
        </div>
      </div>
      <CountField label="TONNES DISPATCHED" hint="From the weighbridge" value={tonnes} onChange={onTonnes} step="0.01" placeholder="0.00" />
      <CountField label="TRUCKS DISPATCHED" value={trucks} onChange={onTrucks} />
    </div>
  );
}
