import { pickGalleryPhoto, takePhoto } from "../lib/media.js";
import { WEIGHBRIDGE_PHOTO_MAX, WEIGHBRIDGE_PHOTO_MIN } from "../lib/dispatchPhotos.js";
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
  photos = [],
  excavatorEach,
  felEach,
  onExcavator,
  onFel,
  onTonnes,
  onTrucks,
  onPhotos,
}) {
  const take = (fromGallery) => {
    if (photos.length >= WEIGHBRIDGE_PHOTO_MAX) return;
    const pick = fromGallery ? pickGalleryPhoto : takePhoto;
    pick(({ ref, data }) => {
      onPhotos([...photos, { ref, preview: data || null }].slice(0, WEIGHBRIDGE_PHOTO_MAX));
    });
  };
  const remove = (index) => onPhotos(photos.filter((_, i) => i !== index));
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
        <p className="ops-field-label">Weighbridge tickets</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mb-2">
          {WEIGHBRIDGE_PHOTO_MIN} or {WEIGHBRIDGE_PHOTO_MAX} photos of the weighbridge report, then the tonnes and trucks on them.
        </p>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {photos.map((photo, index) => (
              <div key={`${photo.ref || "p"}-${index}`}>
                {photo.preview ? (
                  <img
                    src={photo.preview}
                    alt={`Weighbridge ticket ${index + 1}`}
                    className="w-full h-24 object-contain rounded-xl bg-[#0A0A0A]"
                  />
                ) : (
                  <div className="w-full h-24 rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center font-body text-xs text-[#F2F0EA]/45">
                    Photo {index + 1}
                  </div>
                )}
                <button
                  type="button"
                  className="mt-1 w-full font-body text-xs text-[#F2F0EA]/60"
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < WEIGHBRIDGE_PHOTO_MAX && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="w-full" onClick={() => take(false)}>
              {photos.length ? "Add photo" : "Take photo"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => take(true)}>
              Choose photo
            </Button>
          </div>
        )}
        <p className="font-body text-xs text-[#F2F0EA]/45 mt-1">
          {photos.length}/{WEIGHBRIDGE_PHOTO_MAX} photos
        </p>
      </div>
      <CountField label="Tonnes dispatched" hint="Comes off the floor" value={tonnes} onChange={onTonnes} step="0.01" placeholder="0.00" />
      <CountField label="Trucks dispatched" value={trucks} onChange={onTrucks} />
    </div>
  );
}
