import React from "react";

/**
 * Shown when the Vite build has no usable Supabase env.
 * Avoids a blank black screen (module-load throw + dark body CSS).
 */
export function ConfigMissingScreen({ error }) {
  return (
    <div className="min-h-[100dvh] bg-ops-black text-ops-text flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <p className="font-logo ops-brand text-4xl text-ops-gold tracking-widest mb-4">OPS</p>
        <h1 className="font-logo text-xl text-ops-text mb-3 tracking-wide">Preview not configured</h1>
        <p className="font-body text-sm text-ops-muted mb-6 leading-relaxed">
          {error || "Supabase environment variables are missing from this deployment."}
        </p>
        <div className="text-left bg-ops-card border border-ops-border rounded-xl p-4 mb-6">
          <p className="font-body text-xs text-ops-muted mb-2 uppercase tracking-wider">Vercel → Project → Settings → Environment Variables</p>
          <ul className="font-body text-sm text-ops-text space-y-2 list-disc pl-5">
            <li>
              <code className="text-ops-gold">VITE_SUPABASE_URL</code> — https://…supabase.co
            </li>
            <li>
              <code className="text-ops-gold">VITE_SUPABASE_ANON_KEY</code> — anon/public key
            </li>
          </ul>
          <p className="font-body text-xs text-ops-muted mt-3 leading-relaxed">
            Enable for <strong className="text-ops-text">Production</strong> and{" "}
            <strong className="text-ops-text">Preview</strong>, then redeploy (or push a new commit).
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full bg-[#F5C518] text-black py-3 rounded font-logo font-bold tracking-wider"
        >
          RELOAD
        </button>
      </div>
    </div>
  );
}
