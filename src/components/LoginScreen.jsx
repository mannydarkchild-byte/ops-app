import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { LogoMark } from "./AppShell.jsx";
import { Button } from "./ui/Button.jsx";
import { Card, CardBody } from "./ui/Card.jsx";

const inputClass =
  "w-full bg-ops-black border border-ops-border px-3 py-3 rounded-xl text-ops-text font-body outline-none focus:border-ops-gold/60 focus:ring-1 focus:ring-ops-gold/25";

export function LoginScreen({ onLogin, error, loading }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetErr, setResetErr] = useState("");

  const submitLogin = async () => {
    if (!email || !password) return;
    setBusy(true);
    await onLogin(email, password);
    setBusy(false);
  };

  const submitReset = async () => {
    if (!email) { setResetErr("Enter your email"); return; }
    setBusy(true);
    setResetErr("");
    const { error: e } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (e) setResetErr(e.message);
    else setResetMsg("Check your email for reset link.");
  };

  return (
    <div className="min-h-screen bg-ops-black flex flex-col items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
      <LogoMark size="lg" />
      <h1 className="font-logo text-3xl text-ops-gold mt-5 mb-2">OPS</h1>
      <p className="font-body text-sm text-ops-muted mb-8 text-center max-w-xs">Mine operations — sign in once, work offline on site.</p>

      <Card className="w-full max-w-sm">
        <CardBody>
        {mode === "login" ? (
          <>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={`${inputClass} mb-3`} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              onKeyDown={(e) => e.key === "Enter" && submitLogin()}
              className={`${inputClass} mb-4`} />
            {error && <p className="text-ops-red text-sm mb-3 font-body">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" onClick={submitLogin} disabled={busy || loading}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <button type="button" onClick={() => setMode("reset")} className="btn-link w-full mt-4 text-ops-muted text-sm font-ui hover:text-ops-text">Forgot password?</button>
          </>
        ) : (
          <>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={`${inputClass} mb-4`} />
            {resetErr && <p className="text-ops-red text-sm mb-3">{resetErr}</p>}
            {resetMsg && <p className="text-ops-green text-sm mb-3">{resetMsg}</p>}
            <Button variant="teal" size="lg" className="w-full" onClick={submitReset} disabled={busy}>Send reset link</Button>
            <button type="button" onClick={() => setMode("login")} className="btn-link w-full mt-4 text-ops-muted text-sm font-ui hover:text-ops-text">Back to sign in</button>
          </>
        )}
        </CardBody>
      </Card>
      <p className="text-ops-muted text-xs mt-6 text-center font-body">Works offline after first sign-in</p>
    </div>
  );
}
