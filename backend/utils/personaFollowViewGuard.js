// Phase 0 / P0.1 startup guard.
//
// Migration 132 collapses the PersonaFollow table into PersonaMembership and
// re-creates PersonaFollow as a SQL view. Once that migration is in production
// the deployment pipeline is expected to set
//
//   PERSONA_FOLLOW_VIEW_ACTIVE=true
//
// to confirm the post-migration schema is live. If somebody rolls the SQL
// migration back without rolling the code back, the flag will be missing or
// explicitly false and the process refuses to start, surfacing the schema /
// code drift loudly instead of failing later at the first follow attempt.
//
// Default behaviour: if the variable is unset, treat it as active. This keeps
// local dev and CI from breaking before they have a chance to set the flag.
// Only an explicit "false / 0 / off / disabled" value blocks startup.

const FALSY_VALUES = new Set(['0', 'false', 'off', 'disabled', 'no']);

function isPersonaFollowViewActive(env = process.env) {
  const raw = env.PERSONA_FOLLOW_VIEW_ACTIVE;
  if (raw == null || raw === '') return true;
  return !FALSY_VALUES.has(String(raw).trim().toLowerCase());
}

function assertPersonaFollowViewActive(env = process.env) {
  if (!isPersonaFollowViewActive(env)) {
    throw new Error(
      'PersonaFollow view migration not complete; refusing to start. ' +
      'Apply migration 132_collapse_persona_follow_into_membership.sql, then ' +
      'set PERSONA_FOLLOW_VIEW_ACTIVE=true (or unset it) before starting the ' +
      'backend.'
    );
  }
}

module.exports = {
  isPersonaFollowViewActive,
  assertPersonaFollowViewActive,
};
