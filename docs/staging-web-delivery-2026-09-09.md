# Staging web delivery — September 9, 2026

The standalone web image now accepts `NEXT_PUBLIC_APP_URL` at build time, so
staging links use `https://staging.pantopus.com`. The API and Socket.IO rewrites
both target `https://staging-api.pantopus.com`. The default application origin
for other builds remains unchanged.

## Built and served

- Source: `a9a27f8b1c07bc969e8d52174f60778ad70a3b19`, built from a Git archive.
- Next production compilation, lint/type checks and generation of 161 pages
  passed. The existing sandbox Stripe publishable key was used; no live key.
- Platform: `linux/amd64`. Local OCI index identity:
  `sha256:57f372ecbe411e591f76e97ebdc07a97b683492f6ef5a1d433b41bc47f95bb4a`.
- Host image/config identity:
  `sha256:74e300c76d13acd31c78889c4130b911d775134d3cc69d0197c284b310f42b15`.
  Docker Desktop reports the OCI index, while the host engine reports the
  image configuration. The exported archive's configuration hash matches the
  host identity; platform, all filesystem layers and runtime configuration match.
- Runs as UID 1001 in `pantopus-web-staging`, bound only to host loopback
  `127.0.0.1:18300`, with a 384 MiB limit, half a CPU, dropped capabilities and
  no privilege escalation. Uses the existing host; no new paid resource.
- `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` and
  `/verify-email` return HTTP 200 locally and on the host. Compiled origins and
  API/socket rewrites were inspected in the actual image.

## Next action and limits

`staging.pantopus.com` still has no DNS record. Cloudflare is at its sign-in
screen, and an operator sign-in request is pending. After access is available,
configure only this new staging hostname, install and verify its HTTPS virtual
host, then run the captured verification/recovery link journey through the
browser and same-origin cookies/CSRF. Page availability alone does not establish
those flows. Google and Apple OAuth remain disabled in the staging Auth project.

The public staging API and worker remain on `65d2cc2d9`; the fixed account API
candidate is separate. No production DNS, database or application was changed.
Rollback before public routing is simply stopping this new staging web
container; retain its exact image and the private build/transfer evidence.

Private evidence is indexed under `staging-web/` in the operator recovery root.
It includes the build plan, build log, image inspections and transfer log;
credentials and account links must not be committed.
