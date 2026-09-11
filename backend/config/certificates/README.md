# Supabase database CA

`supabase-prod-ca-2021.crt` is Supabase's **public** CA certificate, not an
application credential. It is included so the worker can verify Supabase pooler
TLS without disabling certificate checks or depending on an untracked host file.

Source: [Supabase's official download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt),
as configured in the [official dashboard source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
See [Supabase's SSL connection guidance](https://supabase.com/docs/guides/database/psql).

For the standard backend image, append these parameters to the private worker
`DATABASE_URL`: `sslmode=verify-full&sslrootcert=/app/config/certificates/supabase-prod-ca-2021.crt`.
Use the correct session-pooler host, project username and password for that
environment. Never commit the connection URL or disable verification to bypass
a certificate failure. This file does not change global system trust.
