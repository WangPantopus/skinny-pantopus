#!/usr/bin/env node
// Installed app -> production relationship Express/Joi/read/write services -> local SQL.
// Normal sign-in, identity, list comparison shape and unrelated shell services are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const [container, output, portText = '18083'] = process.argv.slice(2), port = Number(portText);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
assert(port >= 18083 && port <= 18089);
const f = require('../db/home-claim-relationship-http-fixture.cjs')(container);
const { actor, home, claims, sql, rpc, q } = f;
const express = require(path.join(root, 'backend/node_modules/express'));
const app = express(); app.use(express.json());
const token = 'pantopus-synthetic-relationship-ui-loopback-only';
const email = 'relationship-ui@example.com', sessionId = 'local-relationship-browser';
const stamp = '2026-09-10T12:00:00Z';
const user = { id: actor, email, username: 'relationship_ui_fixture', name: 'Relationship UI Fixture', firstName: 'Relationship', lastName: 'Fixture',
  accountType: 'personal', account_type: 'personal', role: 'user', verified: true, createdAt: stamp, updatedAt: stamp };
const homeRow = { id: home, name: 'Relationship UI Fixture', address: '1 Synthetic Street', city: 'Test', state: 'WA', zipcode: '98607',
  home_type: 'house', isOwner: true, isOccupant: true, ownership_status: 'verified', is_primary_owner: true };
let initialized = false, server, commands = [], events = [], selected = 0, holdNext = false, held, release;
const event = (event, data = {}) => events.push({ event, ...data });
const read = claim => rpc('get_home_claim_review', { p_home_id: home, p_claim_id: claim, p_actor_id: actor, p_platform_admin: false });
const receipts = () => JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at),'[]'::jsonb)::text FROM public."HomeClaimRelationshipReceipt" r WHERE home_id=${q(home)};`));
const snapshot = () => ({ home_id: home, claim_ids: claims, commands, events, held: !!held, receipts: receipts(),
  claims: JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('id',id,'state',state,'claim_phase_v2',claim_phase_v2,'challenge_state',challenge_state,'terminal_reason',terminal_reason) ORDER BY id)::text FROM public."HomeOwnershipClaim" WHERE home_id=${q(home)};`)),
  security_state: sql(`SELECT security_state FROM public."Home" WHERE id=${q(home)};`) });
function reset() {
  if (initialized) f.cleanup();
  f.setup(); initialized = true; commands = []; events = []; selected = 0; holdNext = false;
  release?.(); held = undefined; release = undefined;
}
app.use(async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const p = req.path, m = req.method;
  try {
    if (p === '/fixture/reset' && m === 'POST') { reset(); return res.json(snapshot()); }
    if (p === '/fixture/state' && m === 'GET') return res.json(snapshot());
    if (p === '/fixture/lose-reply' && m === 'POST') { f.loseNextReply(); return res.json(snapshot()); }
    if (p === '/fixture/reject-elsewhere' && m === 'POST') {
      sql(`UPDATE public."HomeOwnershipClaim" SET state='rejected',claim_phase_v2='rejected',terminal_reason='rejected_review' WHERE id=${q(claims[0])};`);
      event('rejected_elsewhere'); return res.json(snapshot());
    }
    if (p === '/fixture/change-claim' && m === 'POST') {
      sql(`UPDATE public."HomeOwnershipClaim" SET updated_at=clock_timestamp() WHERE id=${q(claims[selected])};`);
      event('claim_changed'); return res.json(snapshot());
    }
    if (p === '/fixture/next-claim' && m === 'POST') { assert(selected < 2); selected += 1; return res.json(snapshot()); }
    if (['/fixture/revoke', '/fixture/restore'].includes(p) && m === 'POST') {
      sql(`UPDATE public."HomeOccupancy" SET is_active=${p.endsWith('/restore')} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
      event(p.endsWith('/restore') ? 'restored' : 'revoked'); return res.json(snapshot());
    }
    if (p === '/fixture/hold-read' && m === 'POST') { holdNext = true; return res.json(snapshot()); }
    if (p === '/fixture/release-read' && m === 'POST') { release?.(); held = undefined; release = undefined; return res.json(snapshot()); }
    if (p === '/api/users/login' && m === 'POST') {
      assert.equal(req.body.email, email); assert.equal(req.body.password, 'synthetic-loopback-only'); event('signed_in');
      return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400, sessionId, session: { id: sessionId, context: 'interactive' } });
    }
    if (p.startsWith('/api/') && req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
    if (p.endsWith('/relationship-decision') && m === 'GET') {
      if (holdNext) {
        holdNext = false; held = true; event('preflight_held');
        await new Promise(resolve => { const timer = setTimeout(resolve, 45000); release = () => { clearTimeout(timer); resolve(); }; });
      }
      event('relationship_read'); return next();
    }
    if (p.endsWith('/resolve-relationship') && m === 'POST') {
      commands.push(structuredClone(req.body));
      res.once('finish', () => event('decision_response', { status: res.statusCode, request_id: req.body.request_id }));
      return next();
    }
    if (m === 'GET') {
      if (p === '/api/hub') return res.json({ user, context: { activeHomeId: home, activePersona: { type: 'personal' } },
        availability: { hasHome: true, hasBusiness: false, hasPayoutMethod: false }, homes: [], businesses: [],
        setup: { steps: [], allDone: true, profileCompleteness: { score: 100, checks: { firstName: true, lastName: true, photo: false, bio: false, skills: false }, missingFields: [] } },
        statusItems: [], cards: { personal: { unreadChats: 0, earnings: 0, gigsNearby: 0, rating: 0, reviewCount: 0 } }, jumpBackIn: [], activity: [] });
      if (['/api/users/profile', '/api/users/me'].includes(p)) return res.json({ user, ...user });
      if (p === '/api/homes' || p.endsWith('/my-homes')) return res.json({ homes: [homeRow] });
      if (p === `/api/homes/${home}`) return res.json({ home: homeRow });
      if (p === `/api/homes/${home}/me`) return res.json({ hasAccess: true, is_owner: true, role_base: 'owner', permissions: ['home.view', 'ownership.manage', 'members.manage'] });
      if (p === `/api/homes/${home}/owners`) return res.json({ owners: [] });
      if (p === `/api/homes/${home}/ownership-claims` || p.endsWith('/ownership-claims/compare')) {
        const current = read(claims[selected]);
        if (!current.ok) return res.status(current.status).json({ error: current.error || current.code, code: current.code });
        const claimant = p.endsWith('/compare') ? { id: current.claim.claimant_user_id, name: 'Synthetic claimant' } : { masked: true };
        const projected = ['rejected', 'revoked', 'approved'].includes(current.claim.state) ? [] : [{ ...current.claim, claimant }];
        return res.json({ home_id: home, claims: projected, incumbent: { owners: [], has_verified_owner: true }, home: homeRow });
      }
      if (p.endsWith('/claims')) return res.json({ claims: [] });
      if (p.endsWith('/unread-count')) return res.json({ count: 0, unread_count: 0, unreadCount: 0 });
      if (p === '/api/notifications') return res.json({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 0, total: 0 } });
    }
    return res.status(404).json({ error: 'Not part of the synthetic native fixture' });
  } catch (error) {
    event('fixture_denied', { status: error.statusCode || 500, code: error.code || 'fixture_failure' });
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  }
});
app.use(f.app);
reset(); server = app.listen(port, '127.0.0.1', () => console.log('Owned native relationship fixture listening on loopback; production HTTP and SQL'));
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; release?.();
  fs.writeFileSync(output, JSON.stringify(snapshot(), null, 2), { mode: 0o600 });
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  f.cleanup(); console.log('PASS: exact native relationship fixture SQL cleanup');
}
process.on('SIGINT', () => stop().catch(() => { process.exitCode = 1; }));
process.on('SIGTERM', () => stop().catch(() => { process.exitCode = 1; }));
