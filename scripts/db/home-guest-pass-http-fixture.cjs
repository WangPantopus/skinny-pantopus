// Real homeIam/homeGuest routers, real homeExternalShareService and the real
// web client over actual HTTP. Authentication and notification transport are
// synthetic. The share RPC boundary runs either the actual SQL functions in a
// disposable container (`container` option, same contract as the other
// scripts/db HTTP fixtures) or, when no container is supplied, a transcription
// of the frozen 20260910040000 migration's documented decision contract.
// A transcribed run is NOT SQL evidence; it exercises route/service/UI only.
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const id = n => `f0e51100-0000-4000-8000-${String(n).padStart(12, '0')}`;

module.exports = function ({ container = null } = {}) {
  // Only this stream's own disposable replay container may be written to.
  if (container !== null) assert.match(container, /^supabase_db_pantopus-stream2-guest-[a-z0-9-]+$/);
  const express = require(path.join(root, 'backend/node_modules/express'));
  const actor = id(1);
  const homeId = id(100);
  const state = {
    now: null,
    permissions: ['home.view', 'home.edit', 'members.manage', 'access.view_wifi'],
    home: {
      id: homeId,
      name: 'My Place',
      guest_welcome_message: 'Welcome to My Place!',
      parking_instructions: 'Park in driveway',
      house_rules: 'No smoking indoors',
      entry_instructions: 'Code is 1234',
      trash_day: 'tuesday',
      local_tips: null,
      default_guest_pass_hours: 24,
    },
    wifi: [{ id: id(201), label: 'Home WiFi', value: 'MyWifiPassword123', visibility: 'members' }],
    // HomeEmergency_type_chk allows only shutoff_water/shutoff_gas/shutoff_electric/
    // breaker_map/extinguisher/first_aid/evac_plan/emergency_contacts/other.
    emergency: [
      { id: id(301), type: 'shutoff_water', label: 'Water shutoff', location: 'Garage wall' },
      { id: id(302), type: 'emergency_contacts', label: 'Emergency contacts', location: 'Kitchen binder' },
    ],
    passes: [],
    views: [],
    audits: [],
    sequence: 400,
  };
  const clock = () => (state.now ? new Date(state.now) : new Date());
  const fail = (code, status) => ({ ok: false, code, status });

  // --- Transcribed contract of the frozen sharing migration -----------------
  const SECTION_DEFAULTS = {
    wifi_only: ['wifi', 'parking'],
    vendor: ['entry_instructions', 'parking'],
    airbnb: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'trash_day', 'local_tips', 'emergency'],
    guest: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'emergency'],
  };
  const KIND_HOURS = { wifi_only: 2, vendor: 8, guest: 48, airbnb: null };
  const PLAIN_SECTIONS = ['parking', 'house_rules', 'entry_instructions', 'trash_day', 'local_tips'];
  const PAYLOAD_KEYS = ['label', 'kind', 'included_sections', 'custom_title', 'duration_hours', 'start_at',
    'end_at', 'max_views', 'token_hash', 'passcode_hash', 'permissions', 'resource_type', 'resource_id',
    'can_edit', 'can_upload', 'permission_scope', 'grantee_user_id'];
  const safeRecord = record => {
    const { token_hash, passcode_hash, resource_bindings, ...safe } = record;
    return safe;
  };
  const passStatus = (pass, now) => pass.revoked_at ? 'revoked'
    : pass.sharing_version !== 1 ? 'reissue_required'
    : new Date(pass.end_at) <= now || (pass.max_views !== null && pass.view_count >= pass.max_views) ? 'expired'
    : new Date(pass.start_at) > now ? 'scheduled' : 'active';

  function mutate(args) {
    const { p_actor_id: actorId, p_kind: kind, p_action: action, p_share_id: shareId, p_payload: payload } = args;
    if (!actorId || !['guest', 'scoped'].includes(kind) || !['create', 'revoke', 'list'].includes(action)
      || !payload || typeof payload !== 'object' || Array.isArray(payload)
      || (action === 'create' && shareId) || (action === 'revoke' && !shareId)) return fail('SHARE_INVALID', 400);
    if (args.p_home_id !== homeId) return fail('HOME_NOT_FOUND', 404);
    const need = kind === 'guest' ? 'members.manage' : 'home.edit';
    const permissions = state.permissions;
    const now = clock();
    if (action === 'revoke') {
      const pass = state.passes.find(row => row.id === shareId);
      if (!pass) return fail('SHARE_NOT_FOUND', 404);
      if (pass.created_by !== actorId && !permissions.includes(need)) return fail('SHARE_DENIED', 403);
      const replayed = pass.revoked_at !== null;
      if (!replayed) {
        pass.revoked_at = now.toISOString();
        pass.updated_at = now.toISOString();
        state.audits.push({ action: 'guest_pass_revoked', target_id: pass.id });
      }
      let record = { id: pass.id, home_id: homeId, revoked_at: pass.revoked_at, label: '', kind: 'guest' };
      if (permissions.includes(need)) record = safeRecord(pass);
      return { ok: true, record, replayed };
    }
    if (!permissions.includes(need) || (kind === 'guest' && !permissions.includes('home.view'))) return fail('SHARE_DENIED', 403);
    if (action === 'list') {
      if (kind !== 'guest') return fail('SHARE_INVALID', 400);
      const records = state.passes
        .filter(pass => String(payload.include_revoked) === 'true' || !pass.revoked_at)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map(pass => ({
          ...safeRecord(pass),
          status: passStatus(pass, now),
          last_viewed_at: state.views.filter(view => view.guest_pass_id === pass.id)
            .map(view => view.viewed_at).sort().at(-1) || null,
        }));
      return { ok: true, records };
    }
    if (Object.keys(payload).some(key => !PAYLOAD_KEYS.includes(key))
      || !/^[a-f0-9]{64}$/.test(payload.token_hash || '')
      || (payload.passcode_hash != null && !/^[a-f0-9]{64}$/.test(payload.passcode_hash))
      || ('can_edit' in payload && payload.can_edit !== false)
      || ('can_upload' in payload && payload.can_upload !== false)
      || ('permissions' in payload && Object.keys(payload.permissions || {}).length > 0)
      || ('permission_scope' in payload && payload.permission_scope !== 'view')) return fail('SHARE_INVALID', 400);
    const passKind = payload.kind || 'guest';
    const start = payload.start_at ? new Date(payload.start_at) : now;
    const hours = payload.duration_hours != null ? Number(payload.duration_hours)
      : (KIND_HOURS[passKind] ?? state.home.default_guest_pass_hours ?? 48);
    const end = payload.end_at ? new Date(payload.end_at) : new Date(start.getTime() + hours * 3600_000);
    const maxViews = payload.max_views == null ? null : Number(payload.max_views);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= now
      || end - start > 365 * 86400_000 || start - now > 365 * 86400_000
      || !(hours > 0) || hours > 8760
      || (maxViews !== null && !(Number.isInteger(maxViews) && maxViews >= 1 && maxViews <= 100000))
      || payload.grantee_user_id) return fail('SHARE_INVALID', 400);
    if (!['wifi_only', 'guest', 'airbnb', 'vendor'].includes(passKind)
      || !String(payload.label || '').trim() || String(payload.label).length > 200
      || (payload.custom_title != null && String(payload.custom_title).length > 200)) return fail('SHARE_INVALID', 400);
    const sections = payload.included_sections || SECTION_DEFAULTS[passKind];
    if (!Array.isArray(sections) || sections.length === 0 || sections.length > 40
      || sections.some(value => typeof value !== 'string')) return fail('SHARE_INVALID', 400);
    const bindings = {};
    for (const section of [...new Set(sections)].sort()) {
      if (section === 'wifi') {
        if (!permissions.includes('access.view_wifi')) return fail('SHARE_RESOURCE_DENIED', 403);
        bindings.wifi = state.wifi.filter(row => ['public', 'members'].includes(row.visibility)).map(row => row.id);
      } else if (section === 'emergency') {
        if (!permissions.includes('home.view')) return fail('SHARE_RESOURCE_DENIED', 403);
        bindings.emergency = state.emergency.map(row => row.id);
      } else if (/^doc:[a-fA-F0-9-]{36}$/.test(section)) {
        return fail('SHARE_RESOURCE_DENIED', 403); // no shared documents in this fixture
      } else if (!PLAIN_SECTIONS.includes(section)) {
        return fail('SHARE_INVALID', 400);
      } else if (!permissions.includes('home.view')) {
        return fail('SHARE_RESOURCE_DENIED', 403);
      }
    }
    const record = {
      id: id(++state.sequence), home_id: homeId, label: payload.label, kind: passKind,
      token_hash: payload.token_hash, permissions: {}, start_at: start.toISOString(), end_at: end.toISOString(),
      created_by: actorId, included_sections: sections, custom_title: payload.custom_title ?? null,
      passcode_hash: payload.passcode_hash ?? null, max_views: maxViews, view_count: 0,
      sharing_version: 1, resource_bindings: bindings, revoked_at: null,
      created_at: now.toISOString(), updated_at: now.toISOString(),
    };
    state.passes.push(record);
    state.audits.push({ action: 'guest_pass_created', target_id: record.id });
    return { ok: true, record: safeRecord(record) };
  }

  function read(args) {
    const { p_kind: kind, p_token_hash: tokenHash, p_passcode_hash: passcodeHash } = args;
    if (!/^[a-f0-9]{64}$/.test(tokenHash || '') || !/^[a-f0-9]{64}$/.test(args.p_receipt_hash || '')) return fail('SHARE_INVALID', 400);
    if (kind !== 'guest') return fail('SHARE_NOT_FOUND', 404);
    const matches = state.passes.filter(pass => pass.token_hash === tokenHash);
    if (matches.length !== 1) return fail('SHARE_NOT_FOUND', 404);
    const pass = matches[0];
    const now = clock();
    if (pass.revoked_at) return fail('SHARE_REVOKED', 410);
    if (pass.sharing_version !== 1) return fail('SHARE_REISSUE_REQUIRED', 410);
    if (new Date(pass.end_at) <= now) return fail('SHARE_EXPIRED', 410);
    if (new Date(pass.start_at) > now) return fail('SHARE_NOT_STARTED', 403);
    if (pass.max_views !== null && pass.view_count >= pass.max_views) return fail('SHARE_VIEW_LIMIT', 410);
    if (pass.passcode_hash && pass.passcode_hash !== passcodeHash) return fail('SHARE_PASSCODE_REQUIRED', 403);
    if (!state.permissions.includes('members.manage') || !state.permissions.includes('home.view')) return fail('SHARE_DENIED', 403);
    const sections = {};
    for (const section of pass.included_sections) {
      // inspect_home_external_share rechecks the issuer's CURRENT permission for
      // each bound section, so a withdrawn grant retires links it already backed.
      const need = section === 'wifi' ? 'access.view_wifi' : 'home.view';
      if (!state.permissions.includes(need)) return fail('SHARE_RESOURCE_DENIED', 403);
      if (section === 'wifi') {
        const networks = (pass.resource_bindings.wifi || [])
          .map(wifiId => state.wifi.find(row => row.id === wifiId))
          .map(row => ({ network_name: row.label, password: row.value }));
        sections.wifi = networks.length === 1 ? networks[0] : networks;
      } else if (section === 'emergency') {
        sections.emergency = (pass.resource_bindings.emergency || [])
          .map(emergencyId => state.emergency.find(row => row.id === emergencyId))
          .map(row => ({ type: row.type, info_type: row.type, label: row.label, location: row.location, location_in_home: row.location }));
      } else if (section === 'parking') sections.parking = state.home.parking_instructions;
      else if (section === 'house_rules') sections.house_rules = state.home.house_rules;
      else if (section === 'entry_instructions') sections.entry_instructions = state.home.entry_instructions;
      else if (section === 'trash_day') sections.trash_day = state.home.trash_day;
      else if (section === 'local_tips') sections.local_tips = state.home.local_tips;
    }
    pass.view_count += 1;
    pass.updated_at = now.toISOString();
    state.views.push({ guest_pass_id: pass.id, viewed_at: now.toISOString() });
    return { ok: true, view: { pass: { label: pass.label, kind: pass.kind, custom_title: pass.custom_title,
      expires_at: pass.end_at, home_name: state.home.name, welcome_message: state.home.guest_welcome_message }, sections } };
  }

  // --- Actual SQL execution in a disposable container ---------------------
  // Same shape as the accepted scripts/db HTTP fixtures: service_role RPCs run
  // through `docker exec psql` against an owned, disposable project.
  const { execFileSync } = require('node:child_process');
  const q = value => `'${String(value).replaceAll("'", "''")}'`;
  function sql(query) {
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres',
      '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      { input: query, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }
  function callSql(name, args) {
    const params = Object.entries(args).map(([key, value]) => {
      assert.match(key, /^p_[a-z_]+$/);
      return `${key} => ${value == null ? 'NULL' : q(typeof value === 'object' ? JSON.stringify(value) : value)}`;
    });
    return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
  }

  // Seed exactly this fixture's own rows, refusing a database that is not empty
  // of them first — the accepted scripts/db pattern (parents before children,
  // one transaction, relative timestamps, explicit enum casts, no role-default
  // writes: the canonical HomeRolePermission rows arrive with the migrations).
  // home_effective_access grants a verified owner every permission that is not
  // explicitly denied for role_base 'owner', which is what members.manage,
  // home.view and access.view_wifi depend on here.
  function seed() {
    assert(container, 'seed() requires a container-backed run');
    assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id=${q(actor)})
      +(SELECT count(*) FROM public."Home" WHERE id=${q(homeId)});`), '0');
    const home = state.home;
    sql(`BEGIN;
      INSERT INTO auth.users(id,email,email_confirmed_at)
        VALUES(${q(actor)},'guest-pass-http-1@example.invalid',now());
      INSERT INTO public."User"(id,email,username,name,role)
        SELECT id,email,'guest_pass_http_'||right(id::text,2),'Guest pass fixture','user'
        FROM auth.users WHERE id=${q(actor)};
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,name,
        trash_day,house_rules,local_tips,entry_instructions,parking_instructions,
        guest_welcome_message,default_guest_pass_hours)
        VALUES(${q(homeId)},${q(actor)},${q(actor)},'Private guest pass fixture','Test','WA','98607',
          ${q(home.name)},${q(home.trash_day)},${q(home.house_rules)},
          ${home.local_tips === null ? 'NULL' : q(home.local_tips)},
          ${q(home.entry_instructions)},${q(home.parking_instructions)},
          ${q(home.guest_welcome_message)},${home.default_guest_pass_hours});
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
        VALUES(${q(homeId)},${q(actor)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,
        is_active,start_at,access_end_at)
        VALUES(${q(homeId)},${q(actor)},'owner','owner'::public.home_role_base,'adult','verified',
          true,now()-interval '1 day',now()+interval '30 days');
      -- trg_sync_homeaccesssecret_value refuses an INSERT carrying a secret and
      -- only moves the value into HomeAccessSecretValue on UPDATE. Seed through
      -- that same contract instead of writing the value table directly.
      INSERT INTO public."HomeAccessSecret"(id,home_id,access_type,label,secret_value,visibility,created_by)
        VALUES ${state.wifi.map(row => `(${q(row.id)},${q(homeId)},'wifi',${q(row.label)},'',
          ${q(row.visibility)}::public.home_record_visibility,${q(actor)})`).join(',')};
      ${state.wifi.map(row => `UPDATE public."HomeAccessSecret" SET secret_value=${q(row.value)} WHERE id=${q(row.id)};`).join('\n      ')}
      INSERT INTO public."HomeEmergency"(id,home_id,type,label,location,created_by,created_at,updated_at)
        VALUES ${state.emergency.map(row => `(${q(row.id)},${q(homeId)},${q(row.type)},${q(row.label)},
          ${q(row.location)},${q(actor)},now(),now())`).join(',')};
      COMMIT;`);
  }

  // Remove only this fixture's own rows and report the counts back, so a run can
  // assert its owned database returns to zero.
  function cleanup() {
    assert(container, 'cleanup() requires a container-backed run');
    sql(`BEGIN;
      DELETE FROM public."HomeShareReadReceipt" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeGuestPassView" WHERE guest_pass_id IN
        (SELECT id FROM public."HomeGuestPass" WHERE home_id=${q(homeId)});
      DELETE FROM public."HomeGuestPass" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeScopedGrant" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeAuditLog" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeEmergency" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeAccessSecretValue" WHERE access_secret_id IN
        (SELECT id FROM public."HomeAccessSecret" WHERE home_id=${q(homeId)});
      DELETE FROM public."HomeAccessSecret" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(homeId)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(homeId)};
      DELETE FROM public."Home" WHERE id=${q(homeId)};
      DELETE FROM public."User" WHERE id=${q(actor)};
      DELETE FROM auth.users WHERE id=${q(actor)};
      COMMIT;`);
    return JSON.parse(sql(`SELECT jsonb_build_object(
      'passes',(SELECT count(*) FROM public."HomeGuestPass" WHERE home_id=${q(homeId)}),
      'views',(SELECT count(*) FROM public."HomeGuestPassView" v JOIN public."HomeGuestPass" g
        ON g.id=v.guest_pass_id WHERE g.home_id=${q(homeId)}),
      'audits',(SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(homeId)}),
      'homes',(SELECT count(*) FROM public."Home" WHERE id=${q(homeId)}),
      'users',(SELECT count(*) FROM auth.users WHERE id=${q(actor)}))::text;`));
  }

  // Retire a pass to the pre-validation sharing contract, the way a link issued
  // before migration 20260910040000 exists today. Works in both modes so one
  // journey script covers the transcribed and the SQL-backed run.
  function demoteToLegacy(passId) {
    if (container) { sql(`UPDATE public."HomeGuestPass" SET sharing_version=NULL WHERE id=${q(passId)};`); return; }
    const pass = state.passes.find(row => row.id === passId);
    assert(pass, 'Unknown guest pass');
    pass.sharing_version = null;
  }

  // Withdraw the actor's authority the way the product does — an explicit
  // HomePermissionOverride deny, which home_effective_access subtracts from
  // every source. Mode-aware so one journey script covers both runs.
  function denyPermissions(permissions) {
    if (!container) {
      state.permissions = state.permissions.filter(value => !permissions.includes(value));
      return;
    }
    sql(`INSERT INTO public."HomePermissionOverride"(id,home_id,user_id,permission,allowed,created_by,created_at,updated_at)
      VALUES ${permissions.map((permission, index) => `(${q(id(700 + index))},${q(homeId)},${q(actor)},
        ${q(permission)}::public.home_permission,false,${q(actor)},now(),now())`).join(',')}
      ON CONFLICT (home_id,user_id,permission) DO UPDATE SET allowed=false,updated_at=now();`);
  }
  function restorePermissions() {
    if (!container) {
      state.permissions = ['home.view', 'home.edit', 'members.manage', 'access.view_wifi'];
      return;
    }
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(homeId)} AND user_id=${q(actor)};`);
  }

  const rpcCalls = [];
  const db = { rpc: async (name, args) => {
    assert(['mutate_home_external_share', 'read_home_external_share'].includes(name));
    rpcCalls.push(name);
    if (container) return { data: callSql(name, args), error: null };
    return { data: name === 'mutate_home_external_share' ? mutate(args) : read(args), error: null };
  } };

  const passthrough = (_req, _res, next) => next();
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename?.startsWith(path.join(root, 'backend/'))) {
      if (request.endsWith('/config/supabaseAdmin')) return db;
      if (request.endsWith('/utils/logger')) return { info() {}, warn() {}, error() {} };
    }
    if (parent?.filename?.endsWith('/routes/homeIam.js')) {
      if (['./homeMemberRemovals', './homeResidencyReviewHistory', './homeResidencyClaims'].includes(request)) return passthrough;
      if (request === '../middleware/verifyToken') {
        const verify = (req, _res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; next(); };
        verify.invalidateRoleCache = () => {};
        return verify;
      }
      if (request === '../utils/homeAccessPolicy') return { OLD_TO_NEW_PERM: {} };
      if (request === '../utils/homePermissions') return { checkHomePermission: async () => ({ hasAccess: false }) };
      if (request === '../services/homeAuthorityService') return {};
    }
    if (parent?.filename?.endsWith('/routes/homeGuest.js') && request === '../middleware/verifyToken') {
      return (_req, res) => res.status(401).json({ error: 'Invalid credentials' });
    }
    if (parent?.filename?.endsWith('/services/homeExternalShareService.js') && request === './homeDocumentStorage') return {};
    return load.call(this, request, parent, isMain);
  };
  const iam = require(path.join(root, 'backend/routes/homeIam'));
  const guest = require(path.join(root, 'backend/routes/homeGuest'));
  Module._load = load;

  const app = express();
  app.use(express.json());
  app.use('/api/homes', guest);
  app.use('/api/homes', iam);
  return { app, state, db, rpcCalls, actor, homeId, id, hash, clock, sql, seed, cleanup, demoteToLegacy, denyPermissions, restorePermissions,
    setNow(value) { state.now = value; },
    reset() { state.passes = []; state.views = []; state.audits = []; state.now = null; state.sequence = 400;
      state.permissions = ['home.view', 'home.edit', 'members.manage', 'access.view_wifi']; },
  };
};
