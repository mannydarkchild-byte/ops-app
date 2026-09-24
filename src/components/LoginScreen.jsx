import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { LogoMark, ThemeToggle } from "./AppShell.jsx";
import { Button } from "./ui/Button.jsx";

const fieldClass =
  "w-full min-h-[60px] bg-ops-elevated border-2 border-ops-border px-4 py-4 rounded-2xl text-ops-text font-body text-lg outline-none focus:border-ops-gold";

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
    <div className="login-screen min-h-[100dvh] bg-ops-black">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
        <p className="font-logo text-lg text-ops-gold">OPS</p>
        <ThemeToggle />
      </header>

      <div className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))] max-w-lg w-full mx-auto">
        <div className="pt-2 pb-6">
          <LogoMark size="lg" />
          <h1 className="font-logo text-4xl text-ops-gold mt-4">OPS</h1>
          <p className="font-body text-xl text-ops-text mt-2 leading-snug">
            {mode === "login" ? "Open the app on this phone. Clock-in comes after that." : "We will email you a reset link."}
          </p>
        </div>

        {mode === "login" ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); submitLogin(); }}
          >
            <label className="block">
              <span className="font-ui text-lg font-semibold text-ops-text block mb-2">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@site.com"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="font-ui text-lg font-semibold text-ops-text block mb-2">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className={fieldClass}
              />
            </label>
            {error && <p className="text-ops-red text-lg font-body leading-snug">{error}</p>}

            <Button
              variant="primary"
              size="lg"
              className="w-full min-h-[64px] text-xl font-logo"
              onClick={submitLogin}
              disabled={busy || loading || !email || !password}
            >
              {busy ? "Opening…" : "Open the app"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="btn-link w-full min-h-[48px] text-ops-text text-lg font-ui"
            >
              Forgot password?
            </button>
            <p className="text-ops-muted text-base text-center font-body">
              Works offline after the first time you open it.
            </p>
          </form>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); submitReset(); }}
          >
            <label className="block">
              <span className="font-ui text-lg font-semibold text-ops-text block mb-2">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@site.com"
                className={fieldClass}
              />
            </label>
            {resetErr && <p className="text-ops-red text-lg font-body">{resetErr}</p>}
            {resetMsg && <p className="text-ops-green text-lg font-body">{resetMsg}</p>}
            <Button
              variant="teal"
              size="lg"
              className="w-full min-h-[64px] text-xl"
              onClick={submitReset}
              disabled={busy || !email}
            >
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="btn-link w-full min-h-[48px] text-ops-text text-lg font-ui"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
