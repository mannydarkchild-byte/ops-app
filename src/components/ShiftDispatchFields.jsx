import { pickGalleryPhoto, takePhoto } from "../lib/media.js";
import { Button } from "./ui/Button.jsx";

function CountField({ label, hint, value, onChange, step = "1", placeholder = "0" }) {
  return (
    <label className="block">
      <span className="ops-field-label">{label}</span>
      {hint && <span className="block font-body text-xs text-[#F2F0EA]/45 -mt-1 mb-1">{hint}</span>}
      <input
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
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
  const eachLabel = (n) => (Number(n) > 0 ? `${n} t each` : "");

  return (
    <div className="space-y-3">
      <CountField
        label="Excavator buckets"
        hint={eachLabel(excavatorEach) ? `Screened - ${eachLabel(excavatorEach)}` : "Screened"}
        value={excavatorBuckets}
        onChange={onExcavator}
      />
      <CountField
        label="FEL buckets"
        hint={eachLabel(felEach) ? `Onto the floor - ${eachLabel(felEach)}` : "Onto the floor"}
        value={felBuckets}
        onChange={onFel}
      />
      <div>
        <p className="ops-field-label">Weighbridge report</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mb-2">Photo of the weighbridge report, then the tonnes and trucks on it.</p>
        {photoPreview && (
          <img src={photoPreview} alt="Weighbridge report" className="w-full max-h-40 object-contain rounded-2xl bg-[#0A0A0A] mb-2" />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="w-full" onClick={() => take(false)}>
            {photoPreview ? "Retake photo" : "Take photo"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => take(true)}>
            Choose photo
          </Button>
        </div>
      </div>
      <CountField label="Tonnes dispatched" hint="Comes off the floor" value={tonnes} onChange={onTonnes} step="0.01" placeholder="0.00" />
      <CountField label="Trucks dispatched" value={trucks} onChange={onTrucks} />
    </div>
  );
}
