/**
 * P0.6 — Notification firewall: template registry + harness + grouping.
 *
 * Audience Profile design v2 §6.2 + §13.7, unified-IA §6.
 *
 * Coverage:
 *   1. Template registry validates field allowlists at registration time
 *      and re-validates at render time. Cross-context placeholders throw
 *      a clear "cross-context interpolation" error.
 *   2. Every template registered by notificationService.js (the real
 *      module under jest.requireActual) passes validation — i.e. no
 *      personal-context template references {persona.handle} or
 *      {fan.handle}, and no audience-context template references
 *      {actor.localProfile.*} or {home.name}.
 *   3. createNotification persists the new `context` field; existing
 *      callsites default to 'personal'.
 *   4. groupNotifications groups two personal-context notifications
 *      about the same entity, but NEVER groups a personal-context and
 *      an audience-context notification — even when their user_id and
 *      related_entity_id match.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, getTable, seedTable } = supabaseAdmin;

const {
  registerTemplate,
  validateTemplate,
  renderTemplate,
  clearRegistry,
  listTemplates,
  CONTEXTS,
  CONTEXT_ALLOWED_FIELDS,
  extractPlaceholders,
} = require('../../services/notificationTemplateRegistry');

const { groupNotifications } = require('../../services/notificationGrouping');

afterEach(() => {
  resetTables();
});

describe('P0.6 — template registry: registration-time validation', () => {
  // The real notificationService registers ~39 personal-context templates
  // at module load. We need a clean slate for the registry tests so we
  // make a separate isolated copy and exercise it.
  let local;
  beforeEach(() => {
    jest.resetModules();
    local = require('../../services/notificationTemplateRegistry');
    local.clearRegistry();
  });

  test('rejects a personal-context template referencing personaHandle', () => {
    expect(() => local.registerTemplate({
      name: 'test_bad_personal',
      context: 'personal',
      pushBody: 'Your fan {persona.handle} did something',
    })).toThrow(/cross-context interpolation/i);
  });

  test('rejects an audience-context template referencing actor.localProfile', () => {
    expect(() => local.registerTemplate({
      name: 'test_bad_audience',
      context: 'audience',
      pushBody: 'Your neighbor {actor.localProfile.displayName} subscribed',
    })).toThrow(/cross-context interpolation/i);
  });

  test('rejects a platform-context template referencing actor identity', () => {
    expect(() => local.registerTemplate({
      name: 'test_bad_platform',
      context: 'platform',
      pushBody: 'Hi {actor.displayName}, your subscription renewed.',
    })).toThrow(/cross-context interpolation/i);
  });

  test('accepts a personal-context template referencing actor.localProfile', () => {
    expect(() => local.registerTemplate({
      name: 'test_good_personal',
      context: 'personal',
      pushBody: 'Your neighbor {actor.localProfile.displayName} replied',
    })).not.toThrow();
  });

  test('accepts an audience-context template referencing fan.handle', () => {
    expect(() => local.registerTemplate({
      name: 'test_good_audience',
      context: 'audience',
      pushTitle: 'New follower',
      pushBody: '{fan.handle} joined your Beacon.',
    })).not.toThrow();
  });

  test('accepts a platform-context template referencing only generic fields', () => {
    expect(() => local.registerTemplate({
      name: 'test_good_platform',
      context: 'platform',
      pushTitle: 'Subscription renewed',
      pushBody: 'Your {amount} payment cleared on {billingDate}.',
    })).not.toThrow();
  });

  test('rejects a template with an unknown context', () => {
    expect(() => local.registerTemplate({
      name: 'test_bad_ctx',
      context: 'unknown',
      pushBody: 'whatever',
    })).toThrow(/invalid context/i);
  });

  test('rejects re-registering a template with a duplicate name', () => {
    local.registerTemplate({ name: 'dup', context: 'personal', pushBody: 'hi' });
    expect(() => local.registerTemplate({ name: 'dup', context: 'personal', pushBody: 'hi' }))
      .toThrow(/already registered/i);
  });

  test('extractPlaceholders pulls every {placeholder} from a string', () => {
    expect(extractPlaceholders('hi {actor.displayName}, your {gig.title} is ready'))
      .toEqual(expect.arrayContaining(['actor.displayName', 'gig.title']));
    expect(extractPlaceholders('no placeholders here')).toEqual([]);
  });

  test('the allowed-fields map covers all three contexts', () => {
    expect(Object.keys(CONTEXT_ALLOWED_FIELDS).sort()).toEqual([...CONTEXTS].sort());
    for (const ctx of CONTEXTS) {
      expect(CONTEXT_ALLOWED_FIELDS[ctx].size).toBeGreaterThan(0);
    }
  });
});

describe('P0.6 — template registry: render-time validation', () => {
  let local;
  beforeEach(() => {
    jest.resetModules();
    local = require('../../services/notificationTemplateRegistry');
    local.clearRegistry();
  });

  test('renderTemplate fills placeholders with the provided vars', () => {
    local.registerTemplate({
      name: 'gig_accepted_test',
      context: 'personal',
      pushTitle: 'Gig accepted',
      pushBody: '{actor.displayName} accepted your gig request',
    });
    const out = local.renderTemplate('gig_accepted_test', {
      actor: { displayName: 'mayabuilds' },
    });
    expect(out.pushTitle).toBe('Gig accepted');
    expect(out.pushBody).toBe('mayabuilds accepted your gig request');
    expect(out.context).toBe('personal');
  });

  test('renderTemplate throws when the template is not registered', () => {
    expect(() => local.renderTemplate('never_registered', {}))
      .toThrow(/not registered/i);
  });

  test('renderTemplate substitutes empty string for missing vars', () => {
    local.registerTemplate({
      name: 'missing_var',
      context: 'personal',
      pushBody: 'Hello {actor.displayName}',
    });
    const out = local.renderTemplate('missing_var', {});
    expect(out.pushBody).toBe('Hello ');
  });
});

describe('P0.6 — every notificationService template validates clean', () => {
  // Same dance as the createNotification block: bypass the
  // moduleNameMapper-injected stub so the real service's top-level
  // registerTemplate calls actually run.
  const path = require('path');
  const realServicePath = path.resolve(__dirname, '..', '..', 'services', 'notificationService.js');
  const realRegistryPath = path.resolve(__dirname, '..', '..', 'services', 'notificationTemplateRegistry.js');

  // Force a clean load: drop the cached registry + service so this block
  // registers the templates on a fresh registry instance regardless of
  // what earlier describes did with clearRegistry().
  delete require.cache[realRegistryPath];
  delete require.cache[realServicePath];
  require(realServicePath);
  const registry = require(realRegistryPath);

  test('all registered templates pass cross-context validation', () => {
    const templates = registry.listTemplates();
    expect(templates.length).toBeGreaterThan(20); // spot-check we registered many
    for (const tpl of templates) {
      expect(() => registry.validateTemplate(tpl)).not.toThrow();
      expect(['personal', 'audience', 'platform']).toContain(tpl.context);
    }
  });

  test('persona templates land in audience / platform context; legacy stays personal', () => {
    // P1.12 expanded the audience-context set with DM lifecycle
    // templates and added platform-context templates for billing
    // events that carry no identity (subscription canceled / payment
    // failed). The personal-context set is everything else.
    const AUDIENCE_NAMES = new Set([
      'persona_follow',
      'persona_follow_request',
      'persona_follow_approved',
      'persona_broadcast',
      'persona_dm_received_creator',
      'persona_dm_reply_fan',
      'persona_member_joined',
    ]);
    const PLATFORM_NAMES = new Set([
      'persona_subscription_canceled',
      'persona_payment_failed',
    ]);
    for (const tpl of registry.listTemplates()) {
      if (AUDIENCE_NAMES.has(tpl.name)) {
        expect(tpl.context).toBe('audience');
      } else if (PLATFORM_NAMES.has(tpl.name)) {
        expect(tpl.context).toBe('platform');
      } else {
        expect(tpl.context).toBe('personal');
      }
    }
  });
});

describe('P0.6 — createNotification persists the context field', () => {
  // The repo's jest config moduleNameMapper rewrites
  // `../../services/notificationService` to a stub for every other test.
  // Use a path the mapper does NOT match (an absolute path through the
  // file system) so we get the real implementation here.
  const realNotificationService = require(
    require('path').resolve(__dirname, '..', '..', 'services', 'notificationService.js')
  );

  beforeEach(() => {
    resetTables();
    seedTable('Notification', []);
  });

  test('defaults to context=personal when no context is supplied', async () => {
    await realNotificationService.createNotification({
      userId: 'u-1',
      type: 'gig_accepted',
      title: 'Gig accepted',
      body: 'mayabuilds accepted your gig request',
    });
    const rows = getTable('Notification');
    expect(rows).toHaveLength(1);
    expect(rows[0].context).toBe('personal');
  });

  test('persists explicit context=audience when the caller passes it', async () => {
    await realNotificationService.createNotification({
      userId: 'u-1',
      type: 'persona_broadcast',
      title: 'New update',
      context: 'audience',
    });
    expect(getTable('Notification')[0].context).toBe('audience');
  });

  test('approval helper creates an audience-context fan notification', async () => {
    await realNotificationService.notifyPersonaFollowApproved({
      fanUserId: 'fan-1',
      personaId: 'persona-1',
      personaHandle: '@mayabuilds',
      personaDisplayName: 'Maya Builds',
      membershipId: 'membership-1',
    });
    expect(getTable('Notification')[0]).toMatchObject({
      user_id: 'fan-1',
      type: 'persona_follow_approved',
      title: 'Beacon request approved',
      context: 'audience',
      link: '/@mayabuilds',
      metadata: {
        persona_id: 'persona-1',
        persona_handle: 'mayabuilds',
        membership_id: 'membership-1',
        follow_status: 'active',
      },
    });
  });

  test('coerces an invalid context value to personal', async () => {
    await realNotificationService.createNotification({
      userId: 'u-1',
      type: 'gig_accepted',
      title: 'Gig accepted',
      context: 'bogus',
    });
    expect(getTable('Notification')[0].context).toBe('personal');
  });
});

describe('P0.6 — groupNotifications respects context', () => {
  test('groups two personal-context notifications about the same gig', () => {
    const groups = groupNotifications([
      {
        id: 'n-1', user_id: 'u-1', type: 'bid_received', context: 'personal',
        metadata: { gig_id: 'gig-abc' }, created_at: '2026-05-08T10:00:00Z',
      },
      {
        id: 'n-2', user_id: 'u-1', type: 'bid_received', context: 'personal',
        metadata: { gig_id: 'gig-abc' }, created_at: '2026-05-08T11:00:00Z',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].entityType).toBe('gig');
    expect(groups[0].entityId).toBe('gig-abc');
    expect(groups[0].context).toBe('personal');
  });

  test('does NOT group a personal- and an audience-context notification with the same user_id', () => {
    const groups = groupNotifications([
      {
        id: 'n-1', user_id: 'u-1', type: 'bid_received', context: 'personal',
        metadata: { gig_id: 'shared-id' }, created_at: '2026-05-08T10:00:00Z',
      },
      {
        id: 'n-2', user_id: 'u-1', type: 'persona_broadcast', context: 'audience',
        metadata: { broadcast_id: 'shared-id' }, created_at: '2026-05-08T11:00:00Z',
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.context))).toEqual(new Set(['personal', 'audience']));
  });

  test('does NOT group two notifications from different users even when context + entity match', () => {
    const groups = groupNotifications([
      {
        id: 'n-1', user_id: 'u-1', type: 'bid_received', context: 'personal',
        metadata: { gig_id: 'gig-abc' }, created_at: '2026-05-08T10:00:00Z',
      },
      {
        id: 'n-2', user_id: 'u-2', type: 'bid_received', context: 'personal',
        metadata: { gig_id: 'gig-abc' }, created_at: '2026-05-08T11:00:00Z',
      },
    ]);
    expect(groups).toHaveLength(2);
  });

  test('treats notifications without a related entity as their own groups (no false collapsing)', () => {
    const groups = groupNotifications([
      { id: 'n-1', user_id: 'u-1', type: 'connection_request', context: 'personal', metadata: {}, created_at: '2026-05-08T10:00:00Z' },
      { id: 'n-2', user_id: 'u-1', type: 'connection_request', context: 'personal', metadata: {}, created_at: '2026-05-08T11:00:00Z' },
    ]);
    expect(groups).toHaveLength(2);
  });

  test('returns an empty array when given no notifications', () => {
    expect(groupNotifications([])).toEqual([]);
    expect(groupNotifications(null)).toEqual([]);
  });
});
