// Synthetic native sign-in/bootstrap around the production postal UI fixture.
// No authentication store injection and no hosted service or mail delivery.
module.exports = function nativeBoundary(f, actor, events) {
  const assert = require('node:assert/strict');
  const express = require('../../backend/node_modules/express');
  const app = express(); app.use(express.json());
  let holdSuffix = null, heldAdmission = null;
  app.locals.releaseAdmission = ({ discard = false } = {}) => {
    const release = heldAdmission; heldAdmission = null;
    if (!discard) release?.();
  };
  const token = 'pantopus-synthetic-postal-loopback-only';
  const stamp = '2026-09-12T12:00:00Z';
  const user = { id: actor, email: 'postal-ui@example.invalid', username: 'postal_ui_fixture', name: 'Postal Fixture',
    firstName: 'Postal', lastName: 'Fixture', accountType: 'personal', account_type: 'personal', role: 'user',
    verified: true, createdAt: stamp, updatedAt: stamp };
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (req.path === '/fixture/native-state') return res.json({ held_admission: !!heldAdmission });
    if (req.path === '/fixture/native-hold') {
      assert(['/postcard-requests', '/verifications'].includes(req.body.suffix));
      holdSuffix = req.body.suffix; return res.json({ ok: true });
    }
    if (req.path === '/fixture/native-release') { app.locals.releaseAdmission(); return res.json({ ok: true }); }
    if (req.path.startsWith('/fixture/')) return next();
    if (req.path === '/api/users/login') {
      assert.equal(req.body.email, user.email); assert.equal(req.body.password, 'synthetic-loopback-only');
      return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400,
        sessionId: 'local-postal-native', session: { id: 'local-postal-native', context: 'interactive' } });
    }
    if (req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
    req.headers['x-fixture-actor'] = actor;
    req.headers['x-fixture-session'] = 'local-postal-native';
    events.push({ event: 'native_request', method: req.method, path: req.path, request_id: req.body?.request_id });
    res.once('finish', () => events.push({ event: 'native_response', path: req.path, status: res.statusCode }));
    if (req.method === 'POST' && holdSuffix && req.path.endsWith(holdSuffix)) {
      holdSuffix = null;
      // Deliberately continue the original worker even if its client has
      // restarted: SQL cancellation, not socket closure, must fence admission.
      heldAdmission = () => next();
      return;
    }
    if (['/api/users/profile', '/api/users/me'].includes(req.path)) return res.json({ user, ...user });
    if (req.path === '/api/hub') return res.json({ user, context: { activeHomeId: null, activePersona: { type: 'personal' } },
      availability: { hasHome: false, hasBusiness: false, hasPayoutMethod: false }, homes: [], businesses: [],
      setup: { steps: [], allDone: true, profileCompleteness: { score: 100, checks: {}, missingFields: [] } }, statusItems: [],
      cards: { personal: { unreadChats: 0, earnings: 0, gigsNearby: 0, rating: 0, reviewCount: 0 } }, jumpBackIn: [], activity: [] });
    if (req.path.endsWith('/unread-count')) return res.json({ count: 0, unread_count: 0, unreadCount: 0 });
    if (req.path === '/api/notifications') return res.json({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 0, total: 0 } });
    if (req.path.includes('/logout')) return res.json({ success: true });
    return next();
  });
  app.use(f.app);
  return app;
};
