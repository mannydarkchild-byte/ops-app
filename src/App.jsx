import React, { useEffect, useState } from "react";
import { OpsProvider, useOps } from "./context/OpsContext.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { OperatorApp } from "./apps/OperatorApp.jsx";
import { MechanicApp } from "./apps/MechanicApp.jsx";
import { SupervisorApp } from "./apps/SupervisorApp.jsx";
import { ManagerApp } from "./apps/ManagerApp.jsx";
import { AdminApp } from "./apps/AdminApp.jsx";
import { ROLES } from "./lib/constants.js";

function readVerifyParams() {
  const params = new URLSearchParams(window.location.search);
  const verify = params.get("verify");
  const token = params.get("token");
  if (verify) return { verifyShiftId: verify, verifyToken: token };
  return { verifyShiftId: null, verifyToken: null };
}

function RoleRouter() {
  const { user, loading, authError, signIn } = useOps();
  const [verifyParams, setVerifyParams] = useState(readVerifyParams);

  useEffect(() => {
    const p = readVerifyParams();
    if (p.verifyShiftId) setVerifyParams(p);
  }, []);

  if (loading) {
  return (
      <div className="min-h-screen bg-ops-black text-ops-text flex items-center justify-center">
        <div className="text-center">
          <p className="font-logo text-ops-gold tracking-widest mb-2">OPS</p>
          <p className="font-body text-sm text-ops-muted">Loading…</p>
      </div>
    </div>
  );
}

  if (!user) {
    return <LoginScreen onLogin={signIn} error={authError} loading={loading} />;
  }

  const role = user.role || ROLES.OPERATOR;

  switch (role) {
    case ROLES.MECHANIC:
      return <MechanicApp />;
    case ROLES.SUPERVISOR:
      return <SupervisorApp verifyShiftId={verifyParams.verifyShiftId} verifyToken={verifyParams.verifyToken} />;
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
