# Deployment Checklist

## Email Confirmation (AUTH-3.4 / P1-6)

Supabase email confirmation is **disabled** in local development (`supabase/config.toml`).
Before deploying to production:

1. **Enable email confirmation** in the hosted Supabase dashboard:
   - Go to **Auth > Settings > Email Auth**
   - Toggle **"Confirm email"** to ON
2. **Configure email templates** in Supabase dashboard (Auth > Email Templates).
3. **Verify SMTP settings** are configured (Auth > SMTP Settings) so confirmation emails are delivered.
4. The backend already sets `emailConfirmed` on `req.user` (see `verifyToken.js`). Use this field in routes that require confirmed emails.

## Cookie Auth (AUTH-3.3)

1. Ensure `NODE_ENV=production` is set so cookies use `secure: true`.
2. Verify the frontend and backend share the same origin (or configure CORS + `sameSite` accordingly).
3. The CSRF double-submit cookie (`pantopus_csrf`) is non-httpOnly by design so the frontend JS can read it.

## Token Hashing (AUTH-3.1)

1. Run the backfill migration to hash existing plaintext tokens:
   ```sql
   -- See supabase/migrations/20260309000002_hash_home_invite_tokens.sql
   UPDATE "HomeInvite"
   SET token_hash = encode(sha256(token::bytea), 'hex')
   WHERE token_hash IS NULL AND token IS NOT NULL;
   ```
2. After backfill, optionally null out plaintext `token` column once all lookups use `token_hash`.
