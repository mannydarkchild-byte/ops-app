import { useState } from "react";
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

export function LogoMark({ size = "md" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === "sm" ? "w-9 h-9" : size === "xl" ? "w-24 h-24" : size === "lg" ? "w-20 h-20" : "w-10 h-10";

  return (
    <div
      className={`${dim} rounded-xl border border-ops-gold/70 bg-ops-card flex items-center justify-center shrink-0 overflow-hidden p-1.5 shadow-ops-sm`}
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
    <div className="bg-ops-gold/10 border-b border-ops-gold/40 px-4 py-2.5 text-center">
      <p className="font-ui text-sm font-semibold text-ops-gold">Offline — working from this phone</p>
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
      title={
        syncState.errors?.length
          ? `${syncState.errors[0]} — tap to retry`
          : syncState.pending
            ? `${syncState.pending} not uploaded — tap to update`
            : `${meta.label} — tap to update`
      }
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`}
      aria-label="Sync status"
    />
  );
}

function SyncButton() {
  const { syncState, syncNow } = useOps();
  const meta = SYNC_META[syncState.status] || SYNC_META.idle;
  const caption = syncControlLabel(syncState);
  const err = syncState.errors?.[0];
  return (
    <Button
      variant="sync"
      size="sm"
      onClick={() => syncNow()}
      className="max-w-[46vw] sm:max-w-none shrink-0"
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
      className={`w-11 h-11 rounded-xl border border-ops-border bg-ops-card text-ops-text flex items-center justify-center ${className}`}
    >
      {light ? <IconMoon /> : <IconSun />}
    </button>
  );
}

export function AppHeader({ right, subtitle }) {
  const { user, signOut } = useOps();
  const role = (user?.role || "operator").toLowerCase();
  const roleLabel = subtitle || role.charAt(0).toUpperCase() + role.slice(1);
  const colors = ROLE_COLORS[role] || ROLE_COLORS.operator;

  const displayName = (user?.name || user?.email?.split("@")[0] || "User").split(/\s+/)[0];

  return (
    <header className="sticky top-0 z-30 bg-ops-black border-b border-ops-border mobile-safe-top shadow-ops-sm">
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <LogoMark size="sm" />
          <div className="min-w-0">
            <span className="font-logo text-lg text-ops-gold">OPS</span>
            <p className="font-body text-base text-ops-text truncate leading-tight">
              {displayName}
              <span className={`ml-2 font-ui text-sm capitalize ${colors.text}`}>{roleLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {right}
          <ThemeToggle />
          <SyncButton />
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="w-11 h-11 rounded-xl border border-ops-border bg-ops-card text-ops-muted hover:text-ops-red flex items-center justify-center"
          >
            <IconOut />
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Scrollable tab bar — use below AppHeader in tabbed apps.
 * tabs: { id, label, icon?, badge? }
 * Sync lives in the header only (avoids crowding tabs on mobile).
 */
export function AppTabBar({ tabs, activeTab, onTabChange, footer }) {
  return (
    <div className="relative z-20 bg-ops-black border-b border-ops-border">
      <div className="px-3 sm:px-4 py-2 max-w-5xl mx-auto">
        <div className="flex gap-1 p-1 rounded-xl bg-ops-card border border-ops-border overflow-x-auto smooth-scroll">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`shrink-0 px-3 py-2.5 rounded-lg font-ui text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
                activeTab === t.id
                  ? "bg-ops-black text-ops-text shadow-ops-sm ring-1 ring-ops-gold/35"
                  : "text-ops-muted hover:text-ops-text hover:bg-ops-elevated/80"
              }`}
            >
              {t.icon ? `${t.icon} ` : ""}{t.label}
              {t.badge > 0 && (
                <span className="ml-1.5 bg-ops-red text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 inline-block min-w-[18px] text-center">
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
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
    <div className={`min-h-screen bg-ops-black text-ops-text pb-8 mobile-safe-bottom ${outdoor ? "operator-outdoor" : ""}`}>
      {alert}
      <AppHeader subtitle={subtitle} context={context} showSite={showSite} />
      <OfflineBanner />
      <SyncQueueHint hasTabBar={Boolean(tabs?.length)} />
      {banner}
      {tabs?.length > 0 && (
        <AppTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          footer={tabFooter}
        />
      )}
      <SyncErrorPanel />
      <main className={`${outdoor ? "p-4 sm:p-5" : "p-3 sm:p-4"} ${maxWidth} mx-auto`}>{children}</main>
    </div>
  );
}
