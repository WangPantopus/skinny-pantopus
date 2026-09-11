#!/usr/bin/env node
// Installed native UI -> production dashboard/IAM/record/intelligence HTTP ->
// owned PostgreSQL. Identity, Home-list/detail shell and provider answers are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const [container, output, portText = '18083'] = process.argv.slice(2), port = Number(portText);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
assert(port >= 18083 && port <= 18089);
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true });
const { actor, home, sql, q, id } = f;
const express = require(path.join(root, 'backend/node_modules/express'));
const app = express(); app.use(express.json());
// Keep the existing owned-device synthetic login; no real credentials/tokens.
const token = 'pantopus-synthetic-bill-ui-loopback-only', email = 'bill-ui@example.com';
const stamp = '2026-09-11T12:00:00Z';
const user = { id: actor, email, username: 'dashboard_ui_fixture', name: 'Dashboard UI Fixture', firstName: 'Dashboard', lastName: 'Fixture',
  accountType: 'personal', account_type: 'personal', role: 'user', verified: true, createdAt: stamp, updatedAt: stamp };
const homeRow = { id: home, owner_id: actor, name: 'Dashboard UI Fixture', address: '1 Synthetic Street', city: 'Test', state: 'WA', zipcode: '98607',
  home_type: 'house', isOwner: true, isOccupant: true, ownership_status: 'verified', is_primary_owner: true };
let initialized = false, server, mode = 'current', events = [], holdSuffix = null, pendingReply = null;
const state = () => ({ home_id: home, mode, events, held: !!pendingReply });
function reset(clearEvents = true) {
  pendingReply?.cancel(); pendingReply = null; holdSuffix = null;
  if (initialized) f.cleanup();
  f.setup(); initialized = true; mode = 'current'; if (clearEvents) events = [];
  sql(`UPDATE public."Home" SET name='Dashboard UI Fixture',address='1 Synthetic Street' WHERE id=${q(home)};
    UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=${q(home)} AND user_id=${q(f.users[4])};
    UPDATE public."User" SET username='current_household_member',name='Private legal fixture name' WHERE id=${q(f.users[4])};
    INSERT INTO public."HomeTask"(id,home_id,created_by,task_type,title,due_at) VALUES(${q(id(901))},${q(home)},${q(actor)},'chore','Smoke alarm check',now()-interval '1 hour');
    INSERT INTO public."HomeCalendarEvent"(id,home_id,created_by,event_type,title,start_at) VALUES(${q(id(902))},${q(home)},${q(actor)},'other','Quarterly Home check',now()+interval '5 minutes');
    INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,provider_name,amount,currency,status,due_date) VALUES(${q(id(903))},${q(home)},${q(actor)},'electric','Home electricity',142.50,'USD','overdue',CURRENT_DATE-1);
    INSERT INTO public."HomeIssue"(home_id,reported_by,title,status) VALUES(${q(home)},${q(actor)},'Kitchen handle','scheduled');
    INSERT INTO public."HomePackage"(home_id,created_by,status,expected_at) VALUES(${q(home)},${q(actor)},'expected',now()+interval '2 days');
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action) VALUES(${q(home)},${q(f.users[4])},'fixture_dashboard_review');`);
}
function setMode(next) {
  assert(['current', 'denied', 'revoked', 'frozen', 'pending_residency', 'pending_ownership', 'private_creator', 'member', 'finance_denied',
    'summary_error', 'malformed_summary', 'wrong_home', 'health_error', 'checklist_error', 'property_error'].includes(next));
  if (mode === 'private_creator') reset(false);
  sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
    UPDATE public."Home" SET security_state='normal',owner_id=${q(actor)} WHERE id=${q(home)};
    UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=${q(home)} AND subject_id=${q(actor)};
    UPDATE public."HomeOccupancy" SET is_active=true,verification_status='verified',verified_at=coalesce(verified_at,now()),role='owner',role_base='owner',access_start_at=NULL,access_end_at=NULL WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  if (next === 'denied' || next === 'finance_denied') sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},${q(next === 'denied' ? 'home.view' : 'finance.view')},false);`);
  if (next === 'revoked') sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  if (next === 'frozen') sql(`UPDATE public."Home" SET security_state='frozen' WHERE id=${q(home)};`);
  if (next.startsWith('pending_')) sql(`UPDATE public."HomeOccupancy" SET verification_status='pending_doc',role=${q(next === 'pending_residency' ? 'member' : 'owner')},role_base=${q(next === 'pending_residency' ? 'member' : 'owner')},verified_at=NULL WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  if (next === 'private_creator') sql(`
    ${['HomeResidencyClaim', 'HomeAuditLog', 'HomeTask', 'HomeCalendarEvent', 'HomeBill', 'HomeIssue', 'HomePackage', 'HomeSeasonalChecklistItem', 'PropertyIntelligenceCache'].map(table => `DELETE FROM public."${table}" WHERE home_id=${q(home)};`).join('\n')}
    DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id<>${q(actor)};
    UPDATE public."HomeOwner" SET owner_status='pending' WHERE home_id=${q(home)} AND subject_id=${q(actor)};
    UPDATE public."HomeOccupancy" SET verification_status='pending_doc',verified_at=NULL WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  if (next === 'member') sql(`UPDATE public."Home" SET owner_id=NULL WHERE id=${q(home)};
    UPDATE public."HomeOwner" SET owner_status='revoked' WHERE home_id=${q(home)} AND subject_id=${q(actor)};
    UPDATE public."HomeOccupancy" SET role='member',role_base='member' WHERE home_id=${q(home)} AND user_id=${q(actor)};
    INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',true);`);
  mode = next; events.push({ event: 'mode', mode });
}
app.use(async (req, res, next) => {
  const p = req.path, method = req.method; res.set('Cache-Control', 'private, no-store');
  try {
    if (p === '/fixture/state' && method === 'GET') return res.json(state());
    if (p === '/fixture/reset' && method === 'POST') { reset(); return res.json(state()); }
    if (p === '/fixture/mode' && method === 'POST') { setMode(req.body.mode); return res.json(state()); }
    if (p === '/fixture/hold' && method === 'POST') {
      assert(['/dashboard', '/dashboard-access', '/me', '/health-score', '/seasonal-checklist', '/property-value'].includes(req.body.suffix));
      holdSuffix = req.body.suffix; return res.json(state());
    }
    if (p === '/fixture/release' && method === 'POST') { const pending = pendingReply; pendingReply = null; pending?.send(); return res.json(state()); }
    if (p === '/api/users/login' && method === 'POST') {
      assert.equal(req.body.email, email); assert.equal(req.body.password, 'synthetic-loopback-only');
      events.push({ event: 'signed_in' }); return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400,
        sessionId: 'local-bill-native', session: { id: 'local-bill-native', context: 'interactive' } });
    }
    if (p.startsWith('/api/') && req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
    if (p.startsWith(`/api/homes/${home}/`)) {
      const requestMode = mode;
      events.push({ event: 'home_read', path: p, mode, method });
      res.once('finish', () => events.push({ event: 'home_response', path: p, mode: requestMode, status: res.statusCode }));
      if (method === 'GET') {
        const fault = { summary_error: '/dashboard', health_error: '/health-score', checklist_error: '/seasonal-checklist', property_error: '/property-value' }[mode];
        if (fault && p.endsWith(fault)) return res.status(503).json({ error: 'Current fixture resource unavailable' });
        const json = res.json.bind(res);
        res.json = body => {
          if (p.endsWith('/dashboard') && res.statusCode === 200) {
            if (requestMode === 'malformed_summary') body = { ...body, counts: undefined };
            if (requestMode === 'wrong_home') body = { ...body, home: { ...body.home, id: id(999) } };
          }
          if (holdSuffix && p.endsWith(holdSuffix)) {
            holdSuffix = null; const pending = { send: () => json(body), cancel: () => res.destroy() }; pendingReply = pending;
            events.push({ event: 'held', path: p }); res.once('close', () => { if (pendingReply === pending) pendingReply = null; }); return res;
          }
          return json(body);
        };
      }
      req.headers['x-fixture-actor'] = actor; return next();
    }
    if (method === 'GET') {
      if (['/api/users/profile', '/api/users/me'].includes(p)) return res.json({ user, ...user });
      if (p === '/api/hub') return res.json({ user, context: { activeHomeId: home, activePersona: { type: 'personal' } },
        availability: { hasHome: true, hasBusiness: false, hasPayoutMethod: false }, homes: [], businesses: [],
        setup: { steps: [], allDone: true, profileCompleteness: { score: 100, checks: { firstName: true, lastName: true, photo: false, bio: false, skills: false }, missingFields: [] } },
        statusItems: [], cards: { personal: { unreadChats: 0, earnings: 0, gigsNearby: 0, rating: 0, reviewCount: 0 } }, jumpBackIn: [], activity: [] });
      if (p === '/api/homes' || p.endsWith('/my-homes')) return res.json({ homes: [homeRow] });
      if (p === '/api/homes/primary') return res.json({ home: homeRow });
      if (p === `/api/homes/${home}`) return res.json({ home: homeRow });
      if (p.endsWith('/unread-count')) return res.json({ count: 0, unread_count: 0, unreadCount: 0 });
      if (p === '/api/notifications') return res.json({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 0, total: 0 } });
    }
    return res.status(404).json({ error: 'Not part of the synthetic native dashboard fixture' });
  } catch (error) { events.push({ event: 'fixture_error', message: error.message }); return res.status(500).json({ error: 'Native fixture unavailable' }); }
});
app.use(f.app);
reset(); server = app.listen(port, '127.0.0.1', () => console.log('Owned native dashboard fixture listening on loopback; production HTTP and SQL'));
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; pendingReply?.cancel(); pendingReply = null;
  fs.writeFileSync(output, JSON.stringify(state(), null, 2), { mode: 0o600 });
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  f.cleanup(); f.restoreModules(); console.log('PASS: exact native dashboard fixture SQL cleanup');
}
process.on('SIGINT', () => stop().catch(() => { process.exitCode = 1; }));
process.on('SIGTERM', () => stop().catch(() => { process.exitCode = 1; }));
