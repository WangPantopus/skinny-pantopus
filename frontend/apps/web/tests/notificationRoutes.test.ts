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
});
