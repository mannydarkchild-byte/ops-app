export function Modal({ title, color = "yellow", onClose, children }) {
  const borderColor = { yellow: "#F5C518", green: "#22C55E", red: "#EF4444", blue: "#00A4A6" }[color] || "#F5C518";
  return (
    <div className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ borderTopColor: borderColor, borderTopWidth: 3 }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-logo text-lg tracking-wider" style={{ color: borderColor }}>{title}</h3>
          <button onClick={onClose} className="text-[#F2F0EA]/50 text-xl w-10 h-10">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AlertModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "OK", cancelText = "Cancel", type = "info" }) {
  if (!isOpen) return null;
  const colors = { info: "#00A4A6", success: "#22C55E", warning: "#F5C518", error: "#EF4444" };
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-logo text-lg tracking-wider mb-2" style={{ color: colors[type] || colors.info }}>{title}</h3>
        <p className="font-body text-sm text-[#F2F0EA]/80 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          {onCancel && <button onClick={onCancel} className="flex-1 border border-[#2A2A2A] py-3 rounded-xl font-logo text-sm">{cancelText}</button>}
          <button onClick={onConfirm} className="flex-1 bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-sm">{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
