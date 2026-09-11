// Production residency router/Joi/service + actual isolated SQL. Synthetic auth
// and notification transport only; never accepts a hosted database or provider.
module.exports = function(container) {
  const assert = require('node:assert/strict');
  const { execFileSync } = require('node:child_process');
  const Module = require('node:module');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
  const id = n => `ddc23600-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actor = id(1), home = id(100), claims = [id(202), id(203), id(204), id(205)];
  const users = Array.from({ length: 6 }, (_, i) => id(i + 1));
  const q = v => `'${String(v).replaceAll("'", "''")}'`;
  function sql(query) {
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      { input: query, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }
  let loseReply = false, notificationFailure = false, calls = 0;
  const notifications = [];
  const db = { rpc: async (name, args) => {
    assert(['get_home_residency_review', 'decide_home_residency_review'].includes(name));
    const params = Object.entries(args).map(([key, value]) => {
      assert.match(key, /^p_[a-z_]+$/); return `${key} => ${value == null ? 'NULL' : q(value)}`;
    });
    if (name === 'decide_home_residency_review') calls++;
    const data = JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
    if (name === 'decide_home_residency_review' && data.ok && loseReply) {
      loseReply = false; throw new Error('Synthetic lost committed reply');
    }
    return { data, error: null };
  } };
  // Read-only Supabase query adapter for the production IAM router/helper.
  db.from = table => {
    assert(['Home', 'HomeOccupancy', 'HomeOwner', 'HomeRolePermission', 'HomePermissionOverride',
      'HomePostcardCode', 'HomeOwnershipClaim'].includes(table));
    const filters = []; let columns = '*', order = '', limit = '', single = false;
    const column = name => { assert.match(name, /^[a-z_]+$/); return `"${name}"`; };
    const query = {
      select(value) { columns = value === '*' ? '*' : value.split(',').map(v => column(v.trim())).join(','); return query; },
      eq(key, value) { filters.push(`${column(key)}=${q(value)}`); return query; },
      order(key, options) { order = ` ORDER BY ${column(key)} ${options?.ascending === false ? 'DESC' : 'ASC'}`; return query; },
      limit(value) { assert(Number.isInteger(value) && value > 0); limit = ` LIMIT ${value}`; return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        const rows = JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM (SELECT ${columns} FROM public."${table}"${filters.length ? ' WHERE ' + filters.join(' AND ') : ''}${order}${limit}) r;`));
        if (single && rows.length > 1) throw new Error('Fixture expected a single IAM record');
        return { data: single ? rows[0] || null : rows, error: null };
      }).then(resolve, reject); },
    };
    return query;
  };
  const transport = { createNotification: async value => {
    notifications.push(value);
    if (notificationFailure) { notificationFailure = false; throw new Error('Synthetic unavailable notification transport'); }
  } };
  const load = Module._load;
  const express = require(path.join(root, 'backend/node_modules/express'));
  const scope = require(path.join(root, 'backend/utils/requestSessionScope'));
  Module._load = function(request, parent, isMain) {
    if (parent?.filename.startsWith(path.join(root, 'backend/'))) {
      if (request === '../config/supabaseAdmin') return db;
      if (request === '../services/notificationService') return transport;
      if (request === '../utils/logger') return { info() {}, warn() {}, error() {} };
    }
    if (parent?.filename.endsWith('/routes/homeIam.js') && ['../services/homeAuthorityService', '../services/homeExternalShareService'].includes(request)) return {};
    if (parent?.filename.endsWith('/routes/homeIam.js') && request === '../middleware/verifyToken') return (req, _res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; next(); };
    if (parent?.filename.endsWith('/routes/home.js')) {
      if (request === '../middleware/verifyToken') return (req, _res, next) => {
        req.user = { id: req.headers['x-fixture-actor'] || actor };
        req.session = { id: req.headers['x-fixture-session'] || 'local-residency-review' }; next();
      };
      if (request === '../middleware/rateLimiter') return new Proxy({}, { get: () => (_req, _res, next) => next() });
      if (request === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (request === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../middleware/validate', '../services/homeResidencyReviewService', '../utils/requestSessionScope'].includes(request)) return {};
    }
    return load.call(this, request, parent, isMain);
  };
  const router = require(path.join(root, 'backend/routes/home'));
  const app = express(); app.use(express.json()); app.use('/api/homes', router); app.use('/api/homes', require(path.join(root, 'backend/routes/homeIam')));
  function setup() {
    assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}))+(SELECT count(*) FROM public."Home" WHERE id=${q(home)});`), '0');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${users.map((u, i) => `(${q(u)},'residency-http-${i + 1}@example.invalid',now())`).join(',')};
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'residency_http_'||right(id::text,2),'Residency fixture','user'
        FROM auth.users WHERE id IN (${users.map(q)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(home)},${q(actor)},${q(actor)},'Private residency fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
        VALUES(${q(home)},${q(actor)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,access_end_at)
        SELECT ${q(home)}::uuid,u,CASE WHEN u=${q(actor)}::uuid THEN 'owner' ELSE 'member' END,
        (CASE WHEN u=${q(actor)}::uuid THEN 'owner' ELSE 'member' END)::public.home_role_base,
        'adult',CASE WHEN u=${q(actor)}::uuid THEN 'verified' ELSE 'pending_doc' END,now()-interval '1 day',now()+interval '2 days'
        FROM unnest(ARRAY[${users.slice(0, 5).map(q)}]::uuid[]) u;
      INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role)
        VALUES ${claims.map((c, i) => `(${q(c)},${q(home)},${q(users[i + 1])},'Private residency fixture','member')`).join(',')};
      COMMIT;`);
  }
  function cleanup() {
    sql(`BEGIN; DROP TRIGGER IF EXISTS residency_http_receipt_failure ON public."HomeResidencyReviewReceipt";
      DROP FUNCTION IF EXISTS public.residency_http_receipt_failure();
      DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
      DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
      DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(home)}; DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
      DELETE FROM public."Home" WHERE id=${q(home)};
      DELETE FROM public."User" WHERE id IN (${users.map(q)}); DELETE FROM auth.users WHERE id IN (${users.map(q)}); COMMIT;`);
    assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=${q(home)})+
      (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}));`), '0');
  }
  return { app, actor, home, claims, users, id, q, sql, scope, setup, cleanup, notifications,
    get calls() { return calls; }, loseNextReply: () => { loseReply = true; },
    failNextNotification: () => { notificationFailure = true; }, restoreModules: () => { Module._load = load; } };
};
