import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { LogoMark, ThemeToggle } from "./AppShell.jsx";
import { Button } from "./ui/Button.jsx";

export function LoginScreen({ onLogin, error, loading, mode: forcedMode, onSetPassword }) {
  const [mode, setMode] = useState(forcedMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
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
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (e) setResetErr(e.message);
    else setResetMsg("Check your email for reset link.");
  };

  const submitNewPassword = async () => {
    if (!password || password.length < 6) { setResetErr("Use at least 6 characters"); return; }
    if (password !== password2) { setResetErr("Those passwords do not match"); return; }
    setBusy(true);
    setResetErr("");
    try {
      await onSetPassword(password);
    } catch (e) {
      setResetErr(e.message || "Could not set a new password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen min-h-[100dvh] bg-ops-black">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <p className="font-logo text-2xl text-ops-gold">OPS</p>
        <ThemeToggle />
      </header>

      <div className="login-wrap px-5 pb-[max(2rem,env(safe-area-inset-bottom))] w-full mx-auto">
        <div className="login-brand">
          <LogoMark size="lg" />
          <h1 className="font-logo text-ops-gold login-title">OPS</h1>
          <p className="font-body text-ops-text login-copy">
            {mode === "newpass"
              ? "Choose a new password for this phone."
              : mode === "login"
                ? "Open the app on this phone. Clock-in comes after that."
                : "We will email you a reset link."}
          </p>
        </div>

        {mode === "login" ? (
          <form
            className="login-form"
            onSubmit={(e) => { e.preventDefault(); submitLogin(); }}
          >
            <label className="login-label">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@site.com"
                className="login-field"
              />
            </label>
            <label className="login-label">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="login-field"
              />
            </label>
            {error && <p className="login-error">{error}</p>}

            <Button
              variant="primary"
              size="md"
              className="login-go font-logo"
              onClick={submitLogin}
              disabled={busy || loading || !email || !password}
            >
              {busy ? "Opening…" : "Open the app"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="btn-link login-link"
            >
              Forgot password?
            </button>
            <p className="login-note">Works offline after the first time you open it.</p>
          </form>
        ) : mode === "newpass" ? (
          <form
            className="login-form"
            onSubmit={(e) => { e.preventDefault(); submitNewPassword(); }}
          >
            <label className="login-label">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="login-field"
              />
            </label>
            <label className="login-label">
              <span>Type it again</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repeat password"
                className="login-field"
              />
            </label>
            {resetErr && <p className="login-error">{resetErr}</p>}
            <Button
              variant="primary"
              size="md"
              className="login-go font-logo"
              onClick={submitNewPassword}
              disabled={busy || !password || !password2}
            >
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        ) : (
          <form
            className="login-form"
            onSubmit={(e) => { e.preventDefault(); submitReset(); }}
          >
            <label className="login-label">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@site.com"
                className="login-field"
              />
            </label>
            {resetErr && <p className="login-error">{resetErr}</p>}
            {resetMsg && <p className="login-ok">{resetMsg}</p>}
            <Button
              variant="teal"
              size="md"
              className="login-go"
              onClick={submitReset}
              disabled={busy || !email}
            >
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="btn-link login-link"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
