// Loopback-only actual production relationship GET/POST + services + PostgreSQL.
// Identity and configuration are synthetic. Never use a hosted database.
module.exports = function(container) {
  const assert = require('node:assert/strict');
  const { execFileSync } = require('node:child_process');
  const Module = require('node:module');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
  const id = n => `ddc23400-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actor = id(1), other = id(2), home = id(100), claims = [id(201), id(202), id(203)];
  const q = value => `'${String(value).replaceAll("'", "''")}'`;
  function sql(query) {
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }
  let loseReply = false;
  function rpc(name, args) {
    assert(['get_home_claim_review','decide_home_claim_relationship'].includes(name));
    const params = Object.entries(args).map(([key, value]) => {
      assert.match(key, /^p_[a-z_]+$/); return `${key} => ${value == null ? 'NULL' : q(value)}`;
    });
    return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
  }
  const db = { rpc: async (name, args) => {
    const data = rpc(name, args);
    if (name === 'decide_home_claim_relationship' && data.ok && loseReply) { loseReply = false; throw new Error('Synthetic lost committed reply'); }
    return { data, error: null };
  } };
  const load = Module._load;
  const express = require(path.join(root, 'backend/node_modules/express'));
  const scope = require(path.join(root, 'backend/utils/requestSessionScope'));
  Module._load = function(request, parent, isMain) {
    if (parent?.filename.startsWith(path.join(root, 'backend/')) && request === '../config/supabaseAdmin') return db;
    if (parent?.filename.endsWith('/routes/homeOwnership.js')) {
      if (request === '../middleware/verifyToken') return (req, res, next) => {
        req.user = { id: req.headers['x-fixture-actor'] || actor };
        req.session = { id: req.headers['x-fixture-session'] || 'local-relationship-browser' }; next();
      };
      if (request === '../middleware/rateLimiter') return new Proxy({}, { get: () => (_req, _res, next) => next() });
      if (request === '../config/householdClaims') return { flags: { inviteMerge: true } };
      if (request === '../utils/logger') return { info() {}, warn() {}, error() {} };
      if (!['express', 'joi', '../middleware/validate', '../services/homeClaimReviewService', '../services/homeClaimRelationshipService', '../utils/requestSessionScope'].includes(request)) return {};
    }
    return load.call(this, request, parent, isMain);
  };
  let router;
  try {
    require(path.join(root, 'backend/services/homeClaimRelationshipService'));
    require(path.join(root, 'backend/services/homeClaimReviewService'));
    router = require(path.join(root, 'backend/routes/homeOwnership'));
  } finally { Module._load = load; }
  const app = express(); app.use(express.json()); app.use('/api/homes', router);
  function setup() {
    assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id IN(${q(actor)},${q(other)});`), '0');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES (${q(actor)},'relationship-browser-1@example.invalid',now()),(${q(other)},'relationship-browser-2@example.invalid',now());
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'relationship_browser_'||right(id::text,2),'Browser fixture','user' FROM auth.users WHERE id IN(${q(actor)},${q(other)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(home)},${q(actor)},${q(actor)},'Private relationship fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(actor)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES(${q(home)},${q(actor)},'owner','owner','adult','verified');
      INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,expires_at)
        SELECT c,${q(home)}::uuid,${q(other)}::uuid,'owner','submitted','doc_upload','under_review',now()+interval '1 day'
          FROM unnest(ARRAY[${claims.map(q).join(',')}]::uuid[]) c;
      INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status,storage_ref)
        VALUES(${q(claims[0])},'deed','manual','pending','legacy/private-deed.pdf'),(${q(claims[1])},'deed','manual','pending','legacy/another-private-deed.pdf');
      INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status,metadata)
        VALUES(${q(claims[2])},'title_match','attom','verified','{"matched":true,"confidence":90}'); COMMIT;`);
  }
  function cleanup() {
    sql(`BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
      DELETE FROM public."HomeVerificationEvidence" WHERE claim_id IN (${claims.map(q).join(',')});
      DELETE FROM public."HomeOwnershipClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(home)}; DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
      DELETE FROM public."Home" WHERE id=${q(home)}; DELETE FROM public."User" WHERE id IN (${q(actor)},${q(other)});
      DELETE FROM auth.users WHERE id IN (${q(actor)},${q(other)}); COMMIT;`);
    assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeClaimRelationshipReceipt" WHERE home_id=${q(home)})+(SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN(${q(actor)},${q(other)}));`), '0');
  }
  return { app, actor, other, home, claims, sql, rpc, q, setup, cleanup, scope, loseNextReply: () => { loseReply = true; } };
};
