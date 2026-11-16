import React, { Suspense, lazy, useEffect, useState } from "react";
import { OpsProvider, useOps } from "./context/OpsContext.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { OperatorApp } from "./apps/OperatorApp.jsx";
import { MechanicApp } from "./apps/MechanicApp.jsx";
import { SupervisorApp } from "./apps/SupervisorApp.jsx";
import { ManagerApp } from "./apps/ManagerApp.jsx";
import { AdminApp } from "./apps/AdminApp.jsx";
import { DispatchApp } from "./apps/DispatchApp.jsx";
import { StoreroomApp } from "./apps/StoreroomApp.jsx";
import { SiteSignPage } from "./components/SiteSignPage.jsx";
import { DispatchPreviewPage } from "./components/DispatchPreviewPage.jsx";
import { ROLES } from "./lib/constants.js";
import { readCachedAuthUser } from "./lib/auth.js";
import { VERIFY_ONCE_KEY, parseVerifyLink } from "./lib/machineStatus.js";
import { SiteHoursGuard } from "./components/SiteHoursGuard.jsx";
import { DeviceSessionGuard } from "./components/DeviceSessionGuard.jsx";
import { VerifyLinkBridge } from "./components/VerifyLinkBridge.jsx";
import { LogoMark } from "./components/AppShell.jsx";

const LandingPage = lazy(() =>
  import("./components/LandingPageV2.jsx").then((mod) => ({ default: mod.LandingPage }))
);

function stripVerifyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete("verify");
  params.delete("token");
  params.delete("v");
  params.delete("t");
  const qs = params.toString();
  const path = /^\/r\//.test(window.location.pathname) ? "/" : window.location.pathname;
  window.history.replaceState({}, "", `${path}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
}

function readPathVerify() {
  const path = window.location.pathname || "";
  const match = path.match(/^\/r\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return null;
  const parsed = parseVerifyLink(match[1], match[2] || "");
  if (!parsed.id && !parsed.tok) return null;
  return { verifyShiftId: parsed.id, verifyToken: parsed.tok };
}

function readVerifyParams() {
  try {
    const fromPath = readPathVerify();
    const params = new URLSearchParams(window.location.search);
    const rawVerify = params.get("verify") || params.get("v") || fromPath?.verifyShiftId || "";
    const rawToken = params.get("token") || params.get("t") || fromPath?.verifyToken || "";
    const parsed = parseVerifyLink(rawVerify, rawToken);
    if (parsed.id || parsed.tok) {
      try {
        sessionStorage.setItem(VERIFY_ONCE_KEY, JSON.stringify({ verifyShiftId: parsed.id, verifyToken: parsed.tok }));
      } catch {}
      return { verifyShiftId: parsed.id || null, verifyToken: parsed.tok || null };
    }
    const raw = sessionStorage.getItem(VERIFY_ONCE_KEY);
    if (!raw) return { verifyShiftId: null, verifyToken: null };
    const stored = JSON.parse(raw);
    const again = parseVerifyLink(stored.verifyShiftId, stored.verifyToken);
    return { verifyShiftId: again.id || null, verifyToken: again.tok || null };
  } catch {
    return { verifyShiftId: null, verifyToken: null };
  }
}

function forgetVerifyParams() {
  try { sessionStorage.removeItem(VERIFY_ONCE_KEY); } catch {}
  stripVerifyFromUrl();
}

function shouldOpenLoginFirst() {
  const params = new URLSearchParams(window.location.search);
  // Site sign-off links (?sign=&token=) are public — never force login for them.
  if (params.has("sign") || params.get("dispatch") === "preview") return false;
  const hash = window.location.hash || "";
  if (params.has("verify") || params.has("token") || params.has("v") || /^\/r\//.test(window.location.pathname || "")) return true;
  if (/type=recovery|access_token|error_description/i.test(hash)) return true;
  if (hash === "#login") return true;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator.standalone) return true;
    if (localStorage.getItem("ops-pwa-installed")) return true;
    if (readCachedAuthUser()) return true;
  } catch {}
  return false;
}

function RoleRouter() {
  const [signParams] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sign = params.get("sign");
      const token = params.get("token");
      // ?verify= belongs to the logged-in supervisor flow; ?sign= is the public site link.
      // ?sign=preview shows the design with sample data (no live shift needed).
      if (sign && !params.has("verify") && (token || sign === "preview")) {
        return { shiftId: sign, token: token || "preview" };
      }
    } catch {}
    return null;
  });
  const [dispatchPreview] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("dispatch") === "preview";
    } catch {
      return false;
    }
  });
  const { user, loading, authError, signIn, passwordRecovery, setPassword } = useOps();
  const [verifyParams, setVerifyParams] = useState(readVerifyParams);
  useEffect(() => {
    const sync = () => setVerifyParams(readVerifyParams());
    window.addEventListener("pageshow", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const [gate, setGate] = useState(() => (shouldOpenLoginFirst() ? "login" : "site"));
  if (dispatchPreview) {
    return (
      <div className="ops-field min-h-screen">
        <DispatchPreviewPage />
      </div>
    );
  }
  if (signParams) {
    return (
      <div className="ops-field min-h-screen">
        <SiteSignPage shiftId={signParams.shiftId} token={signParams.token} />
      </div>
    );
  }

  const clearVerifyLink = () => {
    forgetVerifyParams();
    setVerifyParams({ verifyShiftId: null, verifyToken: null });
  };

  if (loading && gate !== "site") {
    return (
      <div className="min-h-[100dvh] bg-ops-black text-ops-text flex items-center justify-center px-6">
        <div className="text-center flex flex-col items-center">
          <LogoMark size="lg" />
          <p className="font-body text-lg text-ops-muted mt-4">Loading…</p>
        </div>
      </div>
    );
  }

  if (passwordRecovery) {
    return (
      <div className="ops-field min-h-screen">
        <LoginScreen mode="newpass" onSetPassword={setPassword} loading={loading} />
      </div>
    );
  }

  if (!user) {
    if (!passwordRecovery && gate === "site") {
      return (
        <Suspense fallback={<div className="min-h-[100dvh] bg-ops-black" />}>
          <LandingPage onLogin={() => setGate("login")} />
        </Suspense>
      );
    }
    return (
      <div className="ops-field min-h-screen">
        <LoginScreen
          onLogin={signIn}
          error={authError}
          loading={loading}
          onBack={passwordRecovery ? undefined : () => setGate("site")}
        />
      </div>
    );
  }

  const role = user.role || ROLES.OPERATOR;

  const app = (() => { switch (role) {
    case ROLES.MECHANIC:
      return <MechanicApp />;
    case ROLES.SUPERVISOR:
      return (
        <SupervisorApp
          verifyShiftId={verifyParams.verifyShiftId}
          verifyToken={verifyParams.verifyToken}
          onVerifyConsumed={clearVerifyLink}
        />
      );
    case ROLES.MANAGER:
      return (
        <>
          <ManagerApp />
          <VerifyLinkBridge
            verifyShiftId={verifyParams.verifyShiftId}
            verifyToken={verifyParams.verifyToken}
            onConsumed={clearVerifyLink}
          />
        </>
      );
    case ROLES.ADMIN:
      return (
        <>
          <AdminApp />
          <VerifyLinkBridge
            verifyShiftId={verifyParams.verifyShiftId}
            verifyToken={verifyParams.verifyToken}
            onConsumed={clearVerifyLink}
          />
        </>
      );
    case ROLES.DISPATCH:
      return <DispatchApp />;
    case ROLES.STOREROOM:
      return <StoreroomApp />;
    case ROLES.OPERATOR:
    default:
      return <OperatorApp />;
  } })();

  return (
    <div className="ops-field min-h-screen">
      {app}
      <SiteHoursGuard />
      <DeviceSessionGuard />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-ops-black text-ops-text flex items-center justify-center p-6">
          <div className="max-w-sm bg-ops-card border border-[#EF4444] rounded-2xl p-6 text-center">
            <h1 className="font-logo text-[#EF4444] text-xl mb-3 tracking-wider">APP ERROR</h1>
            <p className="font-body text-xs text-ops-muted mb-4 break-words">{String(this.state.error?.message || this.state.error)}</p>
            <button onClick={() => window.location.reload()} className="w-full bg-[#F5C518] text-black py-3 rounded font-logo font-bold tracking-wider">RELOAD</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <OpsProvider>
        <RoleRouter />
      </OpsProvider>
    </ErrorBoundary>
  );
}
