import { pickGalleryPhoto, takePhoto } from "../lib/media.js";

export function ShiftDispatchFields({ tonnes, trucks, floorTonnes, photoPreview, onTonnes, onTrucks, onFloor, onPhoto }) {
  const take = (fromGallery) => {
    const pick = fromGallery ? pickGalleryPhoto : takePhoto;
    pick(({ ref, data }) => onPhoto(ref, data));
  };

  return (
    <div className="space-y-3 mb-4">
      <div>
        <p className="font-logo text-[10px] text-[#F5C518] tracking-wider mb-1">WEIGHBRIDGE REPORT</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mb-2">
          One entry for the site on this day. Photograph the weighbridge report, then enter the total tonnes and trucks.
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
      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">TONNES DISPATCHED</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={tonnes}
          onChange={(e) => onTonnes(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-full text-[#F2F0EA]"
        />
      </label>
      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">TRUCKS</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={trucks}
          onChange={(e) => onTrucks(e.target.value)}
          placeholder="0"
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-full text-[#F2F0EA]"
        />
      </label>
      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">TONNES ON THE FLOOR (ESTIMATE)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={floorTonnes}
          onChange={(e) => onFloor(e.target.value)}
          placeholder="Optional"
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-full text-[#F2F0EA]"
        />
      </label>
    </div>
  );
}
