# OPS (ops-app)

Field ops PWA — React + Vite + Supabase.

## Local setup

```bash
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase → Project Settings → API
npm install
npm run dev
```

## Vercel environment variables (required)

Vite bakes `VITE_*` into the client **at build time**. If these are missing on a Preview or Production deploy, the app used to boot into a blank black screen; it now shows a setup screen instead. Login still will not work until the vars are set and the deployment is rebuilt.

In **Vercel → Project → Settings → Environment Variables**, set for **Production** and **Preview** (and Development if you use `vercel dev`):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** key (never the service role) |

Then **Redeploy** the affected deployment (or push a new commit). Changing env alone does not update an already-built Preview.

## Scripts

- `npm run dev` — local Vite
- `npm run build` — production build
- `npm run lint` — Oxlint
- `npm run preview` — serve `dist/`
