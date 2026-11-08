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
    ['/app/homes/abc/privacy', 'place'],
    ['/app/today', 'today'],
    ['/app/hub/today', 'today'],
    // "Verified homes nearby" opens from Place (founder decision 2026-11-07).
    ['/app/nearby', 'place'],
    ['/app/feed', 'nearby'],
    ['/app/mailbox', 'mail'],
    ['/app/mailbox/personal/123', 'mail'],
    ['/app/chat/room-1', 'messages'],
    ['/app/profile/settings', null],
  ])('%s highlights %s', (path, key) => {
    expect(activeMobileTab(path)).toBe(key);
  });
});
