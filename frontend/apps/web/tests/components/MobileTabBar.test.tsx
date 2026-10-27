import { activeMobileTab, MOBILE_TABS } from '@/components/MobileTabBar';

describe('MobileTabBar route mapping', () => {
  // Tests run with every launch feature on, so Mail is its own tab beside
  // Messages (Mail tab build, 2026-10-27); the web has no Plans tab yet.
  it('exposes the tabs in order, Mail before Messages', () => {
    expect(MOBILE_TABS.map((t) => t.key)).toEqual(['place', 'today', 'nearby', 'mail', 'messages']);
  });

  it.each([
    ['/app/place', 'place'],
    ['/app/place/risk', 'place'],
    ['/app/hub', 'place'],
    ['/app/homes/abc/privacy', 'place'],
    ['/app/today', 'today'],
    ['/app/hub/today', 'today'],
    ['/app/nearby', 'nearby'],
    ['/app/feed', 'nearby'],
    ['/app/mailbox', 'mail'],
    ['/app/mailbox/personal/123', 'mail'],
    ['/app/chat/room-1', 'messages'],
    ['/app/profile/settings', null],
  ])('%s highlights %s', (path, key) => {
    expect(activeMobileTab(path)).toBe(key);
  });
});
