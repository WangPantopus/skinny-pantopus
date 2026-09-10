import { resolveWebNotificationPath } from '../src/lib/notificationRoutes';

describe('resolveWebNotificationPath', () => {
  const home = 'ddf18400-0000-4000-8000-000000000100';
  const task = 'ddf18400-0000-4000-8000-000000000200';
  it.each(['task_assigned', 'task_completed'])('opens exact Home task metadata for %s even with an older dashboard link', type => {
    const notification = { type, metadata: { home_id: home, task_id: task } };
    expect(resolveWebNotificationPath(`/app/homes/${home}/dashboard?tab=tasks`, notification)).toBe(`/app/homes/${home}/tasks/${task}`);
    expect(resolveWebNotificationPath(null, notification)).toBe(`/app/homes/${home}/tasks/${task}`);
  });
  it.each([{ task_id: '../other' }, { task_id: task }, { home_id: home }, { home_id: home, task_id: [] }])(
    'malformed task metadata %j preserves only the existing route', metadata => {
      expect(resolveWebNotificationPath('/app/notifications', { type: 'task_assigned', metadata })).toBe('/app/notifications');
    },
  );
  it('unrelated notification types cannot turn arbitrary task metadata into task navigation', () => {
    expect(resolveWebNotificationPath('/app/feed', { type: 'post_created', metadata: { home_id: home, task_id: task } })).toBe('/app/feed');
  });
  it('routes post notification links to the authenticated app detail page', () => {
    expect(resolveWebNotificationPath('/post/11111111-1111-4111-8111-111111111111'))
      .toBe('/app/feed/post/11111111-1111-4111-8111-111111111111');

    expect(resolveWebNotificationPath('/posts/11111111-1111-4111-8111-111111111111?from=notification'))
      .toBe('/app/feed/post/11111111-1111-4111-8111-111111111111?from=notification');
  });

  it('keeps already-authenticated app routes intact', () => {
    expect(resolveWebNotificationPath('/app/feed/post/11111111-1111-4111-8111-111111111111'))
      .toBe('/app/feed/post/11111111-1111-4111-8111-111111111111');
  });

  it('preserves the existing home route normalization', () => {
    expect(resolveWebNotificationPath('/homes/11111111-1111-4111-8111-111111111111/dashboard'))
      .toBe('/app/homes/11111111-1111-4111-8111-111111111111/dashboard');
  });

  // Job pushes use the mobile deep-link vocabulary (no /app prefix) —
  // the web resolver owns the translation.
  it('routes the Mail Day push link to the web mailbox', () => {
    expect(resolveWebNotificationPath('/mailbox')).toBe('/app/mailbox');
    expect(resolveWebNotificationPath('/mailbox/mailday')).toBe('/app/mailbox/mailday');
  });

  it('routes place section links to the group-detail page', () => {
    expect(resolveWebNotificationPath('/place?section=money')).toBe('/app/place/money');
    expect(resolveWebNotificationPath('/place?section=your-home')).toBe('/app/place/your-home');
    expect(resolveWebNotificationPath('/place')).toBe('/app/place');
  });
});

it.each(['javascript:alert(1)', 'data:text/html,unsafe', '//external.invalid/path', '/\\external.invalid',
  '/%2fexternal.invalid', '/%5cexternal.invalid', '/app/%00bad', '/app/%ZZbad'])('rejects unsafe notification navigation %s', path => {
  expect(resolveWebNotificationPath(path)).toBeNull();
});
it('normalizes an absolute HTTPS notification link into a local app route', () => {
  expect(resolveWebNotificationPath('https://pantopus.test/post/exact')).toBe('/app/feed/post/exact');
});
