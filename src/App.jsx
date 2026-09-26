import React, { useState } from "react";
import { OpsProvider, useOps } from "./context/OpsContext.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { OperatorApp } from "./apps/OperatorApp.jsx";
import { MechanicApp } from "./apps/MechanicApp.jsx";
import { SupervisorApp } from "./apps/SupervisorApp.jsx";
import { ManagerApp } from "./apps/ManagerApp.jsx";
import { AdminApp } from "./apps/AdminApp.jsx";
import { ROLES } from "./lib/constants.js";

const VERIFY_ONCE_KEY = "ops_verify_once";

function stripVerifyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("verify") && !params.has("token")) return;
  params.delete("verify");
  params.delete("token");
  const qs = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
}

function consumeVerifyParams() {
  const params = new URLSearchParams(window.location.search);
  const verify = params.get("verify");
  const token = params.get("token");
  if (verify) {
    try {
      sessionStorage.setItem(VERIFY_ONCE_KEY, JSON.stringify({ verifyShiftId: verify, verifyToken: token }));
    } catch {}
    stripVerifyFromUrl();
  }
  try {
    const raw = sessionStorage.getItem(VERIFY_ONCE_KEY);
    if (!raw) return { verifyShiftId: null, verifyToken: null };
    const parsed = JSON.parse(raw);
    return { verifyShiftId: parsed.verifyShiftId || null, verifyToken: parsed.verifyToken || null };
  } catch {
    return { verifyShiftId: null, verifyToken: null };
  }
}

function forgetVerifyParams() {
  try { sessionStorage.removeItem(VERIFY_ONCE_KEY); } catch {}
  stripVerifyFromUrl();
}

function RoleRouter() {
  const { user, loading, authError, signIn, passwordRecovery, setPassword } = useOps();
  const [verifyParams, setVerifyParams] = useState(consumeVerifyParams);

  const clearVerifyLink = () => {
    forgetVerifyParams();
    setVerifyParams({ verifyShiftId: null, verifyToken: null });
  };

  if (loading) {
  return (
      <div className="min-h-[100dvh] bg-ops-black text-ops-text flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-logo text-4xl text-ops-gold tracking-widest mb-3">OPS</p>
          <p className="font-body text-lg text-ops-muted">Loading…</p>
      </div>
    </div>
  );
}

  if (passwordRecovery) {
    return <LoginScreen mode="newpass" onSetPassword={setPassword} loading={loading} />;
  }

  if (!user) {
    return <LoginScreen onLogin={signIn} error={authError} loading={loading} />;
  }

  const role = user.role || ROLES.OPERATOR;

  switch (role) {
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
      return <ManagerApp />;
    case ROLES.ADMIN:
      return <AdminApp />;
    case ROLES.OPERATOR:
    default:
      return <OperatorApp />;
  }
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
        <div className="ops-field min-h-screen">
          <RoleRouter />
        </div>
      </OpsProvider>
    </ErrorBoundary>
  );
}
