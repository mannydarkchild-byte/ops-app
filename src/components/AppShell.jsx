import { useState } from "react";
import { useOps } from "../context/OpsContext.jsx";

const ROLE_COLORS = {
  operator: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", border: "border-[#22C55E]/40" },
  mechanic: { bg: "bg-[#00A4A6]/15", text: "text-[#00A4A6]", border: "border-[#00A4A6]/40" },
  supervisor: { bg: "bg-[#F5C518]/15", text: "text-[#F5C518]", border: "border-[#F5C518]/40" },
  manager: { bg: "bg-[#F97316]/15", text: "text-[#F97316]", border: "border-[#F97316]/40" },
  admin: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", border: "border-[#EF4444]/40" },
};

const SYNC_META = {
  synced: { label: "Synced", color: "text-[#22C55E]", dot: "bg-[#22C55E]" },
  syncing: { label: "Syncing", color: "text-[#00A4A6]", dot: "bg-[#00A4A6] animate-pulse" },
  offline: { label: "Offline", color: "text-[#F5C518]", dot: "bg-[#F5C518]" },
  error: { label: "Sync error", color: "text-[#EF4444]", dot: "bg-[#EF4444]" },
  idle: { label: "Ready", color: "text-[#F2F0EA]/40", dot: "bg-[#2A2A2A]" },
};

function LogoFallback() {
  return (
    <svg viewBox="0 0 32 32" className="w-[55%] h-[55%]" aria-hidden>
      <rect x="4" y="4" width="24" height="24" rx="6" fill="#F5C518" />
      <path d="M10 22 L16 10 L22 22 Z" fill="#0A0A0A" />
      <rect x="14" y="20" width="4" height="4" rx="1" fill="#0A0A0A" />
    </svg>
  );
}

export function LogoMark({ size = "md" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === "sm" ? "w-9 h-9" : size === "lg" ? "w-16 h-16" : "w-10 h-10";

  return (
    <div
      className={`${dim} rounded-xl border border-[#F5C518]/80 bg-[#141414] flex items-center justify-center shrink-0 overflow-hidden p-1.5`}
      aria-hidden
    >
      {!imgFailed ? (
        <img
          src="/logo.png"
          alt=""
          className="max-w-full max-h-full w-auto h-auto object-contain"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <LogoFallback />
      )}
    </div>
  );
}

export function OfflineBanner() {
  const { syncState } = useOps();
  if (syncState.status !== "offline") return null;
  return (
    <div className="bg-[#F5C518]/20 border-b-2 border-[#F5C518] px-4 py-2.5 text-center">
      <p className="font-logo text-xs text-[#F5C518] tracking-wider font-bold">OFFLINE — WORKING FROM LOCAL DATA</p>
    </div>
  );
}

export function SyncDot() {
  const { syncState, syncNow } = useOps();
  const meta = SYNC_META[syncState.status] || SYNC_META.idle;
  return (
    <button
      type="button"
      onClick={() => syncNow()}
      title={syncState.pending ? `${syncState.pending} pending — tap to sync` : `${meta.label} — tap to sync`}
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`}
      aria-label="Sync status"
    />
  );
}

function SyncButton() {
  const { syncState, syncNow } = useOps();
  const meta = SYNC_META[syncState.status] || SYNC_META.idle;
  return (
    <button
      type="button"
      onClick={() => syncNow()}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] active:scale-95 min-h-[36px]"
      title="Sync now"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      <span className={`font-logo text-[9px] tracking-wider hidden sm:inline ${meta.color}`}>
        {syncState.pending > 0 ? `${syncState.pending} pending` : meta.label}
      </span>
    </button>
  );
}

function UserChip() {
  const { user } = useOps();
  const role = (user?.role || "operator").toLowerCase();
  const colors = ROLE_COLORS[role] || ROLE_COLORS.operator;
  const firstName = (user?.name || user?.email || "User").split(/\s+/)[0];

  return (
    <div className={`hidden sm:flex flex-col items-end px-2.5 py-1 rounded-lg border ${colors.bg} ${colors.border} max-w-[120px] md:max-w-[160px]`}>
      <p className={`font-logo text-[10px] tracking-wider truncate w-full text-right ${colors.text}`}>
        {firstName}
      </p>
      <p className="font-logo text-[8px] tracking-wider text-[#F2F0EA]/45 truncate w-full text-right">
        {role}
      </p>
    </div>
  );
}

/** @deprecated Use AppHeader without right prop — user chip is built in */
export function RoleBadge() {
  return <UserChip />;
}

export function AppHeader({ right, subtitle, context, showSite = true }) {
  const { user, signOut, activeSite } = useOps();
  const role = (user?.role || "operator").toLowerCase();
  const roleLabel = subtitle || role.charAt(0).toUpperCase() + role.slice(1);
  const colors = ROLE_COLORS[role] || ROLE_COLORS.operator;

  const contextLine = context ?? (showSite && activeSite ? activeSite.name : null);
  const userName = user?.name || user?.email?.split("@")[0] || "User";
  const mobileContext = `${userName} · ${roleLabel}`;

  return (
    <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2A2A2A] mobile-safe-top">
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <LogoMark />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-logo text-sm sm:text-base text-[#F5C518] tracking-widest shrink-0">OPS</span>
              <span className={`hidden sm:inline font-logo text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}>
                {roleLabel}
              </span>
            </div>
            <p className="font-body text-xs sm:text-[11px] text-[#F2F0EA]/90 sm:text-[#F2F0EA]/50 truncate mt-0.5 leading-snug">
              <span className="sm:hidden">{mobileContext}</span>
              {contextLine && <span className="hidden sm:inline">{contextLine}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {right ?? <UserChip />}
          <SyncButton />
          <button
            type="button"
            onClick={signOut}
            className="px-3 py-2 rounded-lg bg-[#141414] border border-[#2A2A2A] font-logo text-[10px] text-[#F2F0EA]/60 hover:text-[#EF4444] hover:border-[#EF4444]/40 active:scale-95 min-h-[36px] tracking-wider"
            title="Sign out"
          >
            OUT
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Scrollable tab bar — use below AppHeader in tabbed apps.
 * tabs: { id, label, icon?, badge? }
 */
export function AppTabBar({ tabs, activeTab, onTabChange, onSync, footer }) {
  return (
    <div className="bg-[#0A0A0A] border-b border-[#2A2A2A]/80">
      <div className="px-3 sm:px-4 py-2 flex items-center gap-2 max-w-5xl mx-auto">
        <div className="flex gap-1 overflow-x-auto smooth-scroll flex-1 pb-0.5 -mb-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`shrink-0 px-3 py-2.5 rounded-lg font-logo text-[11px] leading-tight tracking-wide whitespace-nowrap transition-colors min-h-[40px] ${
                activeTab === t.id
                  ? "bg-[#F5C518] text-black"
                  : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70 hover:border-[#3A3A3A]"
              }`}
            >
              {t.icon ? `${t.icon} ` : ""}{t.label}
              {t.badge > 0 && (
                <span className="ml-1.5 bg-[#EF4444] text-white text-[9px] rounded-full px-1.5 py-px inline-block min-w-[16px] text-center">
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            className="shrink-0 px-3 py-2.5 rounded-lg font-logo text-sm bg-[#00A4A6] text-white hover:bg-[#00A4A6]/90 active:scale-95 min-h-[40px] min-w-[40px]"
          >
            ↻
          </button>
        )}
      </div>
      {footer && (
        <div className="px-3 sm:px-4 pb-2 max-w-5xl mx-auto">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Standard page wrapper for role apps */
export function AppPage({
  subtitle,
  context,
  showSite = false,
  tabs,
  activeTab,
  onTabChange,
  onSync,
  tabFooter,
  maxWidth = "max-w-5xl",
  children,
  alert,
  banner,
  outdoor = false,
}) {
  return (
    <div className={`min-h-screen bg-[#0A0A0A] text-[#F2F0EA] pb-8 mobile-safe-bottom ${outdoor ? "operator-outdoor" : ""}`}>
      {alert}
      <AppHeader subtitle={subtitle} context={context} showSite={showSite} />
      <OfflineBanner />
      {banner}
      {tabs?.length > 0 && (
        <AppTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSync={onSync}
          footer={tabFooter}
        />
      )}
      <main className={`p-3 sm:p-4 ${maxWidth} mx-auto`}>{children}</main>
    </div>
  );
}
