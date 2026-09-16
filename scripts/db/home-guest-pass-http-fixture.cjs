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
    emergency: [{ id: id(301), type: 'shutoff', label: 'Water shutoff', location: 'Garage wall' }],
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

  const rpcCalls = [];
  const db = { rpc: async (name, args) => {
    assert(['mutate_home_external_share', 'read_home_external_share'].includes(name));
    rpcCalls.push(name);
    assert(container === null, 'Container-backed SQL execution is not wired in this fixture run');
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
  return { app, state, db, rpcCalls, actor, homeId, id, hash, clock,
    setNow(value) { state.now = value; },
    reset() { state.passes = []; state.views = []; state.audits = []; state.now = null; state.sequence = 400;
      state.permissions = ['home.view', 'home.edit', 'members.manage', 'access.view_wifi']; },
  };
};
