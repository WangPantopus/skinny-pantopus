// Address/provenance HTTP tests stop at the atomic SQL boundary. This helper
// records prepared input; it deliberately does not simulate setup/authority
// writes. Real rollback, grants and replay are covered by the SQL contract and
// the production HTTP/SDK acceptance fixture.
const { setRpcMock } = require('./supabaseAdmin');
let calls = [];
function install() {
  calls = [];
  setRpcMock(async (name, args) => {
    calls.push({ name, args });
    const command = { actor_id: args.p_actor_id, request_id: args.p_request_id,
      created_at: '2026-09-11T12:00:00Z', updated_at: '2026-09-11T12:00:00Z' };
    if (name === 'begin_home_create_command') return { data: { ok: true, state: 'pending', command,
      worker_lease_id: 'ddc24200-0000-4000-8000-000000000100' }, error: null };
    if (name === 'finish_home_create_attempt') return { data: { ok: true, command,
      state: args.p_code ? 'rejected' : 'pending', code: args.p_code, status: args.p_status }, error: null };
    if (name === 'commit_home_create_command') return { data: { ok: true, state: 'completed', command,
      committed_now: true, home_id: 'ddc24200-0000-4000-8000-000000000200',
      role: args.p_intent.role || (args.p_intent.is_owner ? 'owner' : 'household'),
      ownership_claim_id: args.p_intent.is_owner ? 'ddc24200-0000-4000-8000-000000000300' : null,
      access_secret_ids: [],
    }, error: null };
    return { data: null, error: { message: 'Outside Home creation boundary fixture' } };
  });
}
const commits = () => calls.filter(call => call.name === 'commit_home_create_command').map(call => call.args);
const preparedHome = () => commits().at(-1)?.p_home;
module.exports = { install, commits, preparedHome };
