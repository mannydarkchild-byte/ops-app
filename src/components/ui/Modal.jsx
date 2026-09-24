export function Modal({ title, color = "yellow", onClose, children }) {
  const borderColor = { yellow: "#F5C518", green: "#22C55E", red: "#EF4444", blue: "#00A4A6" }[color] || "#F5C518";
  return (
    <div className="ops-sheet fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div
        className="flex flex-col flex-1 w-full bg-[#141414] overflow-hidden sm:max-w-2xl sm:mx-auto sm:my-4 sm:flex-none sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-[#2A2A2A]"
        style={{ borderTopColor: borderColor, borderTopWidth: 3 }}
      >
        <div className="flex justify-between items-center gap-3 px-5 py-5 border-b border-[#2A2A2A] shrink-0">
          <h3 className="font-logo text-xl sm:text-2xl tracking-wide min-w-0" style={{ color: borderColor }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-5 py-4 bg-[#2A2A2A] text-[#F2F0EA] rounded-xl font-logo text-base"
          >
            CLOSE
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AlertModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "OK", cancelText = "Cancel", type = "info" }) {
  if (!isOpen) return null;
  const colors = { info: "#00A4A6", success: "#22C55E", warning: "#F5C518", error: "#EF4444" };
  return (
    <div className="ops-sheet fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full">
        <h3 className="font-logo text-2xl mb-4" style={{ color: colors[type] || colors.info }}>{title}</h3>
        <p className="font-body text-xl text-[#F2F0EA]/85 mb-6 leading-relaxed whitespace-pre-line">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {onCancel && (
            <button type="button" onClick={onCancel} className="flex-1 border border-[#2A2A2A] py-5 rounded-xl font-logo text-lg">
              {cancelText}
            </button>
          )}
          <button type="button" onClick={onConfirm} className="flex-1 bg-[#F5C518] text-black py-5 rounded-xl font-logo font-bold text-lg">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
