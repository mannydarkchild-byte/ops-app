import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { LogoMark } from "./AppShell.jsx";

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
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
      <LogoMark size="lg" />
      <h1 className="font-logo text-3xl text-[#F5C518] tracking-widest mt-5 mb-8">OPS</h1>

      <div className="w-full max-w-sm bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        {mode === "login" ? (
          <>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl mb-3 text-[#F2F0EA] outline-none focus:border-[#F5C518]" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              onKeyDown={(e) => e.key === "Enter" && submitLogin()}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl mb-4 text-[#F2F0EA] outline-none focus:border-[#F5C518]" />
            {error && <p className="text-[#EF4444] text-sm mb-3">{error}</p>}
            <button onClick={submitLogin} disabled={busy || loading}
              className="w-full bg-[#F5C518] text-black py-3.5 px-4 rounded-xl font-logo text-sm tracking-wider disabled:opacity-50">
              {busy ? "SIGNING IN…" : "SIGN IN"}
            </button>
            <button type="button" onClick={() => setMode("reset")} className="btn-link w-full mt-3 text-[#F2F0EA]/50 text-sm">Forgot password?</button>
          </>
        ) : (
          <>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl mb-4 text-[#F2F0EA] outline-none focus:border-[#F5C518]" />
            {resetErr && <p className="text-[#EF4444] text-sm mb-3">{resetErr}</p>}
            {resetMsg && <p className="text-[#22C55E] text-sm mb-3">{resetMsg}</p>}
            <button onClick={submitReset} disabled={busy} className="w-full bg-[#00A4A6] text-white py-3.5 px-4 rounded-xl font-logo text-sm tracking-wider">SEND RESET</button>
            <button type="button" onClick={() => setMode("login")} className="btn-link w-full mt-3 text-[#F2F0EA]/50 text-sm">Back to sign in</button>
          </>
        )}
      </div>
      <p className="text-[#F2F0EA]/50 text-sm mt-6 text-center">Works offline after first sign-in</p>
    </div>
  );
}
