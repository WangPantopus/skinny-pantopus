# Current residency claims — frozen WIP, September 13

Branch codex/home-current-residency-claims now includes native-history head `8c3f7a6c6`, which incorporates verified primary `f14989637`; primary integration of native history still awaits exact-head CI. This is source preservation, not accepted or integrated behavior. History and current-claims router mounts/SDK exports coexist, and the private queue panel retains the accepted history link. Migration 20260913020000 is retained alongside the new additive migration; application and populated adoption remain unaccepted. The new candidate migration is 20260913030000_home_current_residency_claims.sql; it has not been applied or accepted.

Twelve backend/SQL/SDK files add a current-authority pending-only private projection, no-store/session binding and default SDK client import. Fifteen focused tests in two suites pass, six JavaScript syntax checks and 52 generated-wrapper consistency checks pass. SQL contracts, populated upgrade, actual HTTP/SDK/SQL and UI are unexecuted. Legacy NULL claim dates are preserved and sorted last; never fabricate dates or backfill stranded claims. Public claimant projection deliberately has name:null.

Four browser files prepare a strict queue model, transport/controller, lifecycle hook and Members panel. Type checking and focused ESLint pass after correcting a missing final brace; the failed initial checks are retained privately. Shared dependency symlinks point to primary packages, so this is not a fully isolated SDK integration gate. Browser tests and actual UI acceptance are unrun. The owners/review-claim page remains untouched and must be migrated; complete both consumers and assess render-time session retirement before claiming privacy repair complete. Native consumers also remain pending.

Next after native history acceptance: reconcile this branch with current primary, finish the second browser consumer and meaningful lifecycle/contract tests, run populated SQL and real HTTP/SDK acceptance, then browser/native UI and failure/recovery. Existing raw claims read remains a known observed privacy/reader defect on primary. Do not merge WIP merely because it is pushed.

Private source/check maps: /private/tmp/pantopus-home-residency-cycle-r1/current-claims-backend-source-r1; browser checks: /private/tmp/pantopus-home-current-residency-claims-web-r1. No fixture, database, API, device or provider action was performed for this candidate. Dependency symlinks are local-only and excluded from Git.


PR #36 now tracks this branch as an explicit unfinished draft. Its initial
safeguard job failed because the additive migration lacked the required
`Backwards compatible: yes` declaration. The header now states the concrete
compatibility basis: the migration adds a service-only function and changes no
existing table, row, permission or deployed RPC. Executable SQL is unchanged.
This documentation correction does not establish SQL/HTTP/UI acceptance or close
the unfinished consumers. Required gates remain intact; no database was changed.

CI 34769252288 passes the migration safeguard but fails the current-claims SQL
contract: its `x` array alias conflicts with the surrounding PL/pgSQL `x` variable.
Both exclusion assertions now use an explicit `claim_row(value)` alias and qualified
value. The generated wrapper is synchronized; all 52 wrapper consistency checks
pass. This changes only the contract's identifier resolution, not the migration or
application behavior. Fresh SQL CI remains required; the exclusively leased native
acceptance database was not used for this correction.

The reconciliation preserves both specific route mounts before dynamic Home routes, both SDK namespaces, and the queue panel’s safe projection plus history navigation. This is still a WIP combination; complete the second browser consumer, session/render retirement and native consumers before actual populated acceptance. Neither the native acceptance fixture nor its archived products were changed.
