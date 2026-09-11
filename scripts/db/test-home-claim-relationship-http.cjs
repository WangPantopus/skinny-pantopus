// Production router/Joi/service with synthetic identity and actual isolated SQL.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const container = process.argv[2];
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
const id = n => `ddc23100-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), home = id(100), claim = id(201);
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function cleanup() {
  sql(`BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
    DELETE FROM public."HomeVerificationEvidence" WHERE claim_id IN (${q(claim)},${q(id(202))});
    DELETE FROM public."HomeOwnershipClaim" WHERE home_id=${q(home)};
    DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};
    DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
    DELETE FROM public."Home" WHERE id=${q(home)};
    DELETE FROM public."User" WHERE id IN (${q(actor)},${q(id(2))},${q(id(3))});
    DELETE FROM auth.users WHERE id IN (${q(actor)},${q(id(2))},${q(id(3))}); COMMIT;`);
  assert.equal(sql(`SELECT count(*) FROM public."HomeClaimRelationshipReceipt" WHERE home_id=${q(home)};`), '0');
}
const count = () => Number(sql(`SELECT count(*) FROM public."HomeClaimRelationshipReceipt" WHERE home_id=${q(home)};`));
const token = c => sql(`SELECT public.home_claim_review_snapshot(c) FROM public."HomeOwnershipClaim" c WHERE id=${q(c)};`);
let loseReply = false, calls = 0;
const db = { rpc: async (name, args) => {
  assert.equal(name, 'decide_home_claim_relationship'); calls++;
  const params = Object.entries(args).map(([key, value]) => {
    assert.match(key, /^p_[a-z_]+$/); return `${key} => ${value === null ? 'NULL' : q(value)}`;
  });
  const data = JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
  if (data.ok && loseReply) { loseReply = false; throw new Error('Synthetic lost committed reply'); }
  return { data, error: null };
} };
const load = Module._load;
const express = require(path.join(root, 'backend/node_modules/express'));
const flags = { inviteMerge: true };
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('/services/homeClaimRelationshipService.js') && request === '../config/supabaseAdmin') return db;
  if (parent?.filename.endsWith('/routes/homeOwnership.js')) {
    if (request === '../middleware/verifyToken') return (req, res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; req.session = { id: 'relationship-http' }; next(); };
    if (request === '../middleware/rateLimiter') return new Proxy({}, { get: () => (_req, _res, next) => next() });
    if (request === '../config/householdClaims') return { flags };
    if (request === '../utils/logger') return { info() {}, warn() {}, error() {} };
    if (!['express', 'joi', '../middleware/validate', '../services/homeClaimRelationshipService', '../utils/requestSessionScope'].includes(request)) return {};
  }
  return load.call(this, request, parent, isMain);
};
let router;
try {
  require(path.join(root, 'backend/services/homeClaimRelationshipService'));
  router = require(path.join(root, 'backend/routes/homeOwnership'));
} finally { Module._load = load; }

async function main() {
  cleanup();
  let server;
  try {
    sql(`BEGIN;
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
        (${q(actor)},'relationship-http-1@example.invalid',now()),
        (${q(id(2))},'relationship-http-2@example.invalid',now()),(${q(id(3))},'relationship-http-3@example.invalid',now());
      INSERT INTO public."User"(id,email,username,role)
        SELECT id,email,'relationship_http_'||right(id::text,2),'user' FROM auth.users WHERE id::text LIKE 'ddc23100-%';
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(home)},${q(actor)},${q(actor)},'231 Relationship Street','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
        VALUES(${q(home)},${q(actor)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
        VALUES(${q(home)},${q(actor)},'owner','owner','adult','verified');
      INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,expires_at) VALUES
        (${q(claim)},${q(home)},${q(id(2))},'owner','submitted','doc_upload','under_review',now()+interval '1 day'),
        (${q(id(202))},${q(home)},${q(id(3))},'owner','submitted','property_data_match','under_review',now()+interval '1 day');
      INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status,metadata)
        VALUES(${q(id(202))},'title_match','attom','verified','{"matched":true,"confidence":90}'); COMMIT;`);
    const app = express(); app.use(express.json()); app.use('/api/homes', router);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const post = async (body, target = claim, identity = actor) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/ownership-claims/${target}/resolve-relationship`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-actor': identity },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      return { status: response.status, body: await response.json() };
    };
    flags.inviteMerge = false;
    assert.equal((await post({ action: 'decline_relationship' })).status, 404); assert.equal(calls, 0);
    flags.inviteMerge = true;
    assert.equal((await post({ action: 'decline_relationship', request_id: id(500) })).status, 400); assert.equal(calls, 0);
    const original = { action: 'decline_relationship', note: 'Continue independent review' };
    loseReply = true;
    assert.equal((await post(original)).status, 503); assert.equal(count(), 1);
    const recovered = await post(original); assert.equal(recovered.status, 200); assert.equal(recovered.body.replayed, true);
    sql(`UPDATE public."HomeOwnershipClaim" SET state='rejected',claim_phase_v2='rejected',terminal_reason='rejected_review' WHERE id=${q(claim)};`);
    const later = await post(original);
    assert.equal(later.status, 200); assert.deepEqual(later.body.receipt, recovered.body.receipt);
    assert.equal(later.body.claim.state, 'rejected'); assert.equal(count(), 1);
    const reviewed = token(id(202));
    const explicit = { action: 'flag_unknown_person', request_id: id(502).toUpperCase(), review_token: reviewed };
    const flagged = await post(explicit, id(202)); assert.equal(flagged.status, 200);
    assert.equal(flagged.body.receipt.result.qualifies_for_dispute, true);
    assert.equal(flagged.body.claim.challenge_state, 'challenged'); assert.equal(count(), 2);
    assert.equal((await post({ ...explicit, note: 'Different intent' }, id(202))).status, 409);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    assert.equal((await post(explicit, id(202))).status, 403);
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    const again = await post(explicit, id(202)); assert.equal(again.status, 200);
    assert.deepEqual(again.body.receipt, flagged.body.receipt); assert.equal(count(), 2);
    assert.equal(Number(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND action LIKE 'OWNERSHIP_CLAIM_RELATIONSHIP_%';`)), 2);
    console.log('PASS: actual relationship HTTP/Joi/service/SQL, legacy lost-reply/current-state recovery, explicit receipt, changed intent and current denial');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    cleanup();
    console.log('PASS: exact relationship HTTP fixture cleanup');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
