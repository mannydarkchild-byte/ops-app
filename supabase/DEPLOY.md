# Supabase production deploy notes

## Migrations

Apply in order on the project (SQL editor or `supabase db push`):

1. `020_production_security_hardening.sql` — profile privilege lock + site_settings write
2. `021_site_isolation_rls.sql` — real site isolation (admin cross-site only)
3. `022_private_ops_media.sql` — private `ops-media` bucket

## Auth

Dashboard → **Authentication → Providers → Email** → disable **Enable sign ups**.

User creation goes through the `admin-create-user` Edge Function only.

## Edge Function

```bash
supabase functions deploy admin-create-user
```

`SUPABASE_SERVICE_ROLE_KEY` is injected by Supabase into the function runtime. Do not add it to Vercel or any `VITE_` env var.

## Verify quickly

1. Non-admin cannot `update profiles set role = 'admin' where id = auth.uid()`.
2. Operator on site A cannot `select` shifts for site B.
3. Anonymous `GET` of an old public media URL returns denied; signed URL from the app works.
4. Admin → Add user succeeds via the function; anonymous sign-up is rejected.
