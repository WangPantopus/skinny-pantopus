import { resolveWebNotificationPath } from '../src/lib/notificationRoutes';

describe('resolveWebNotificationPath', () => {
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
