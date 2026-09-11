# Backend rollback host binding — September 9, 2026

The GitHub rollback workflow now supplies the same environment-specific
`BACKEND_API_BIND` setting as normal deployment. Previously it omitted the value,
so the shared remote script selected its default port `8000`. For the existing
staging route at `127.0.0.1:18001`, rollback could therefore move the API to the
wrong port or collide with another service on the shared host.

The change adds only the missing workflow environment mapping. Both workflows
continue through the same remote binding validation and API/worker deployment
transaction. An unset setting still uses the existing default. No database,
container, DNS, environment setting, deployment switch, or provider was changed.

The regression reads the actual remote-script step from each workflow, resolves
its binding setting with synthetic environment values, and executes `remote.sh`
against a fake SSH command. Before the repair, the rollback cases reproduced
the wrong port and the failure to reject an invalid configured value. After the
repair, both deployment and rollback preserve the staging binding, preserve the
unset default, and reject invalid values before SSH.

Verification: `node --test scripts/deploy/*.test.cjs` passes all **47 tests**,
including existing simulated failure recovery, separate staging/production
containers, immutable-image checks, exact-commit CI gating, and worker startup.
`git diff --check` also passes. All SSH and Docker operations in these tests are
simulated; this is source/test evidence, not a hosted rollback rehearsal. A real
staging deploy/rollback remains part of the reviewed release preparation.
