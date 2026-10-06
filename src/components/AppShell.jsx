import { useEffect, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { SYNC_LABELS, syncControlLabel, parseSyncError } from "../lib/labels.js";
import { Button } from "./ui/Button.jsx";
import { IconMoon, IconOut, IconSun } from "./FieldIcons.jsx";

const ROLE_COLORS = {
  operator: { dot: "bg-ops-green", text: "text-ops-green" },
  mechanic: { dot: "bg-ops-teal", text: "text-ops-teal" },
  supervisor: { dot: "bg-ops-gold", text: "text-ops-gold" },
  manager: { dot: "bg-ops-orange", text: "text-ops-orange" },
  admin: { dot: "bg-ops-red", text: "text-ops-red" },
};

const SYNC_META = {
  synced: { label: SYNC_LABELS.synced, color: "text-ops-green", dot: "bg-ops-green" },
  syncing: { label: SYNC_LABELS.syncing, color: "text-ops-teal", dot: "bg-ops-teal animate-pulse" },
  offline: { label: SYNC_LABELS.offline, color: "text-ops-gold", dot: "bg-ops-gold" },
  error: { label: SYNC_LABELS.error, color: "text-ops-red", dot: "bg-ops-red" },
  idle: { label: SYNC_LABELS.idle, color: "text-ops-muted", dot: "bg-ops-border" },
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

export function LogoMark({ size = "bar" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = {
    sm: "w-16 h-16",
    bar: "w-24 h-24",
    md: "w-24 h-24",
    lg: "w-36 h-36",
    xl: "w-[min(16rem,72vw)] h-[min(16rem,72vw)]",
    xxl: "w-52 h-52",
  }[size] || "w-24 h-24";

  return (
    <div className={`${dim} shrink-0`} aria-hidden>
      {!imgFailed ? (
        <img
          src="/logo.png"
          alt=""
          className="block w-full h-full object-contain"
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
    <div className="bg-ops-gold/10 border-b border-ops-gold/40 px-4 py-2.5 text-center">
      <p className="font-ui text-sm font-semibold text-ops-gold">Offline — working from this phone</p>
    </div>
  );
}

function SyncButton({ roomy = false }) {
  const { syncState, syncNow } = useOps();
  const meta = SYNC_META[syncState.status] || SYNC_META.idle;
  const caption = syncControlLabel(syncState);
  const err = syncState.errors?.[0];
  return (
    <Button
      variant="sync"
      size={roomy ? "md" : "sm"}
      onClick={() => syncNow()}
      className={roomy ? "flex-1 min-h-12 text-base" : "max-w-[46vw] sm:max-w-none shrink-0"}
      title={err ? parseSyncError(err).body : (syncState.pending > 0 ? `${syncState.pending} not uploaded yet` : "Send and refresh from server")}
      aria-label={err ? "Sync failed. Tap to retry." : `${caption}. Tap to update.`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      <span className={`truncate ${meta.color}`}>{caption}</span>
      {(syncState.pending || 0) > 0 && (
        <span className="font-ui text-xs bg-ops-gold text-ops-ink rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 font-bold">
          {syncState.pending > 99 ? "99+" : syncState.pending}
        </span>
      )}
    </Button>
  );
}

/** Operator-only hint — no extra button (avoids overlapping tab bars) */
function SyncQueueHint({ hasTabBar }) {
  const { syncState } = useOps();
  if (hasTabBar) return null;
  const pending = syncState.pending || 0;
  const err = syncState.errors?.length;
  if (pending <= 0 || err || syncState.status === "syncing") return null;

  return (
    <div className="sm:hidden border-b border-ops-border bg-ops-elevated px-4 py-3">
      <p className="font-body text-sm text-ops-text leading-snug">
        <span className="font-semibold text-ops-gold">{pending}</span>
        {pending === 1 ? " item " : " items "}
        waiting — tap <span className="font-semibold text-ops-gold">Update</span> above.
      </p>
    </div>
  );
}

/** Full error text — readable on phone, sits below tabs (not on top of them) */
function SyncErrorItem({ raw }) {
  const [showTech, setShowTech] = useState(false);
  const { title, body, technical } = parseSyncError(raw);

  return (
    <li className="rounded-xl border border-ops-red/25 bg-ops-card px-4 py-3 shadow-ops-sm">
      <p className="font-ui text-sm font-semibold text-ops-red">{title}</p>
      <p className="font-body text-sm text-ops-text/90 mt-1.5 leading-relaxed">{body}</p>
      {technical && (
        <>
          <button
            type="button"
            onClick={() => setShowTech((v) => !v)}
            className="btn-link mt-2 font-ui text-xs text-ops-muted underline underline-offset-2 hover:text-ops-text"
          >
            {showTech ? "Hide details" : "Show details"}
          </button>
          {showTech && (
            <p className="font-body text-xs text-ops-muted mt-2 break-words leading-relaxed">{technical}</p>
          )}
        </>
      )}
    </li>
  );
}

export function SyncErrorPanel() {
  const { syncState, syncNow } = useOps();
  const errors = (syncState.errors || []).filter(Boolean);
  if (!errors.length) return null;

  return (
    <div id="sync-error-panel" className="px-3 sm:px-4 py-3 border-b border-ops-border max-w-5xl mx-auto w-full">
      <p className="font-ui text-xs font-semibold text-ops-red mb-2">Needs attention</p>
      <ul className="space-y-2 mb-3">
        {errors.map((e, i) => (
          <SyncErrorItem key={i} raw={e} />
        ))}
      </ul>
      <Button variant="teal" size="md" className="w-full" onClick={() => syncNow()}>
        {SYNC_LABELS.actionRetry}
      </Button>
    </div>
  );
}

function UserChip() {
  const { user } = useOps();
  const role = (user?.role || "operator").toLowerCase();
  const colors = ROLE_COLORS[role] || ROLE_COLORS.operator;
  const firstName = (user?.name || user?.email || "User").split(/\s+/)[0];

  return (
    <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-ops-border bg-ops-card max-w-[160px]">
      <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden />
      <div className="min-w-0 text-right">
        <p className="font-ui text-xs font-semibold text-ops-text truncate">{firstName}</p>
        <p className={`font-ui text-[11px] capitalize truncate ${colors.text}`}>{role}</p>
      </div>
    </div>
  );
}

/** @deprecated Use AppHeader without right prop — user chip is built in */
export function RoleBadge() {
  return <UserChip />;
}

export function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useOps();
  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={light ? "Switch to dark" : "Switch to day / white"}
      aria-label={light ? "Switch to dark mode" : "Switch to white mode"}
      className={`w-12 h-12 rounded-xl border border-ops-border bg-ops-card text-ops-text flex items-center justify-center ${className}`}
    >
      {light ? <IconMoon /> : <IconSun />}
    </button>
  );
}

export function AppHeader({ right, subtitle, menuItems = [] }) {
  const { user, signOut } = useOps();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const role = (user?.role || "operator").toLowerCase();
  const roleLabel = subtitle || role.charAt(0).toUpperCase() + role.slice(1);
  const colors = ROLE_COLORS[role] || ROLE_COLORS.operator;
  const displayName = (user?.name || user?.email?.split("@")[0] || "User").split(/\s+/)[0];

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeIfOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-ops-black border-b border-ops-border mobile-safe-top shadow-ops-sm">
      <div className="px-3 sm:px-4 py-2 min-h-[7.25rem] flex items-center gap-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <LogoMark size="bar" />
          <div className="min-w-0">
            <span className="font-logo ops-brand text-base leading-none text-ops-gold">OPS</span>
            <p className="font-body text-sm text-ops-text truncate leading-tight">
              {displayName}
              <span className={`ml-1.5 font-ui text-xs capitalize ${colors.text}`}>{roleLabel}</span>
            </p>
          </div>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Account menu"
          className="w-10 h-10 rounded-xl border border-ops-border bg-ops-card text-ops-text flex items-center justify-center shrink-0"
        >
          <span className="flex flex-col gap-1" aria-hidden>
            <span className="block w-4 h-0.5 bg-current" />
            <span className="block w-4 h-0.5 bg-current" />
            <span className="block w-4 h-0.5 bg-current" />
          </span>
        </button>
      </div>
      {menuOpen && (
        <div ref={menuRef} className="absolute right-3 top-full z-40 w-64 rounded-xl border border-ops-border bg-ops-card shadow-ops-sm p-2 space-y-1">
          {menuItems.length > 0 && (
            <div className="pb-1 mb-1 border-b border-ops-border">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setMenuOpen(false); item.onClick(); }}
                  className="w-full min-h-11 px-3 rounded-lg text-left font-ui text-sm text-ops-text hover:bg-ops-elevated flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ops-red text-white text-[10px] font-semibold flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {right}
          <div className="px-1">
            <SyncButton />
          </div>
          <ThemeToggle className="!w-full !h-11 !justify-start px-3 gap-2" />
          <button
            type="button"
            onClick={signOut}
            title="Leave the app — this is not clock out"
            className="w-full h-11 px-3 rounded-xl border border-ops-border text-ops-muted hover:text-ops-red flex items-center gap-2 font-ui text-sm"
          >
            <IconOut />
            Leave app
          </button>
        </div>
      )}
    </header>
  );
}

function TabGlyph({ id }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "pulse") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>;
  }
  if (id === "reports" || id === "inspections") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></svg>;
  }
  if (id === "inbox" || id === "issues" || id === "messages") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M4 6h16v12H4z" /><path d="m4 8 8 6 8-6" /></svg>;
  }
  if (id === "today") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M4 11.5 12 4l8 7.5V20H4z" /></svg>;
  }
  if (id === "more") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></svg>;
  }
  if (id === "verify") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M5 12.5 9.5 17 19 7" /></svg>;
  }
  if (id === "users") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="9" cy="8" r="3" /><path d="M3 19c1-3 3.2-4.5 6-4.5S14 16 15 19" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14.6c2.2.3 3.8 1.6 4.5 4.4" /></svg>;
  }
  if (id === "sites") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (id === "repairs") {
    return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M14 7a4 4 0 0 0-5.7 5.5L4 17l3 3 4.5-4.3A4 4 0 0 0 17 10l-3 3-2-2 2-4z" /></svg>;
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}><path d="M4 11.5 12 4l8 7.5V20H4z" /></svg>;
}

/**
 * Fixed bottom navigation. tabs: { id, label, badge? } — keep to five.
 */
export function AppTabBar({ tabs, activeTab, onTabChange }) {
  if (!tabs?.length) return null;
  return (
    <nav className="ops-tabbar fixed bottom-0 inset-x-0 z-40 mobile-safe-bottom" aria-label="Main menu">
      <div
        className="max-w-5xl mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(tabs.length, 5)}, minmax(0, 1fr))` }}
      >
        {tabs.slice(0, 5).map((t) => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`ops-tab ${on ? "ops-tab-on" : ""}`}
              aria-current={on ? "page" : undefined}
            >
              <span className="ops-tab-icon">
                <TabGlyph id={t.id} />
                {t.badge > 0 && (
                  <span className="ops-tab-badge">{t.badge > 99 ? "99+" : t.badge}</span>
                )}
              </span>
              <span className="ops-tab-label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
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
  menuItems = [],
}) {
  const hasTabs = Boolean(tabs?.length);
  return (
    <div className={`min-h-screen bg-ops-black text-ops-text ${outdoor ? "operator-outdoor" : ""} ${hasTabs ? "pb-24" : "pb-8 mobile-safe-bottom"}`}>
      {alert}
      <AppHeader subtitle={subtitle} context={context} showSite={showSite} menuItems={menuItems} />
      <OfflineBanner />
      <SyncQueueHint hasTabBar={hasTabs} />
      {banner}
      {tabFooter}
      <SyncErrorPanel />
      <main className={`p-3 sm:p-4 ${maxWidth} mx-auto`}>{children}</main>
      {hasTabs && (
        <AppTabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </div>
  );
}
