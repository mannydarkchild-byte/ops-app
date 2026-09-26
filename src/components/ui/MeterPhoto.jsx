import { pickGalleryPhoto, takePhoto } from "../../lib/media.js";

/**
 * Hour meter capture — photo is required; operator reads value from photo manually.
 */
export function MeterPhoto({
  label = "Hour meter reading (hours)",
  hint = "Take a clear photo of the hour meter display, then type the reading you see.",
  value,
  onValue,
  photo,
  onPhoto,
  required = true,
  allowBackdate = false,
  readingAt,
  onReadingAt,
  showPhotoError = false,
}) {
  const hasPhoto = !!photo;

  const handleCamera = () => {
    takePhoto(({ ref, data }) => onPhoto(ref, data));
  };

  const handleGallery = () => {
    pickGalleryPhoto(({ ref, data }) => onPhoto(ref, data));
  };

  return (
    <div className="space-y-3">
      {/* Photo first — compulsory for hour readings */}
      <div>
        <p className="font-logo text-xs text-[#F2F0EA]/70 tracking-wider mb-2">
          {required ? "① PHOTO (REQUIRED)" : "① PHOTO"}
        </p>
        <button
          type="button"
          onClick={handleCamera}
          className={`w-full min-h-[64px] py-5 rounded-xl font-logo font-bold text-lg tracking-wider border-2 active:scale-[0.99] ${
            hasPhoto
              ? "bg-[#22C55E] text-black border-[#22C55E]"
              : showPhotoError
                ? "bg-[#0A0A0A] text-[#EF4444] border-[#EF4444]"
                : "bg-[#F5C518] text-black border-[#F5C518]"
          }`}
        >
          {hasPhoto ? "Retake with camera" : "Take photo with camera"}
        </button>
        <button
          type="button"
          onClick={handleGallery}
          className="w-full mt-2 min-h-[56px] py-4 rounded-xl font-logo border-2 border-[#2A2A2A] text-[#F2F0EA]"
        >
          Use a photo already on this phone
        </button>
        {showPhotoError && !hasPhoto && (
          <p className="font-body text-xs text-[#EF4444] mt-2">Photo is required before you can continue.</p>
        )}
        {photo && (photo.startsWith("blob:") || photo.startsWith("data:")) && (
          <img src={photo} alt="Hour meter" className="w-full max-h-48 object-contain rounded-xl mt-2 border border-[#2A2A2A]" />
        )}
      </div>

      {/* Reading from photo */}
      <div>
        <p className="font-logo text-xs text-[#F2F0EA]/70 tracking-wider mb-2">{required ? "② READING FROM PHOTO" : "② READING"}</p>
        {hint && <p className="font-body text-sm text-[#F2F0EA]/70 mb-2">{hint}</p>}
        <label className="font-body text-sm text-[#F2F0EA]/70 block mb-1">{label}</label>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="e.g. 5032.5"
          className="w-full bg-[#090909] border border-[#333] rounded-xl p-4 text-2xl text-[#F2F0EA] outline-none focus:border-[#F5C518] min-h-[60px]"
        />
      </div>

      {allowBackdate && (
        <div>
          <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider mb-2">③ DATE & TIME OF READING</p>
          <input
            type="datetime-local"
            value={readingAt || ""}
            onChange={(e) => onReadingAt?.(e.target.value)}
            className="w-full bg-[#090909] border border-[#333] rounded-xl p-3 text-sm text-[#F2F0EA]"
          />
        </div>
      )}
    </div>
  );
}
