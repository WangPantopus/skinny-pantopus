import { activeMobileTab, MOBILE_TABS } from '@/components/MobileTabBar';

describe('MobileTabBar route mapping', () => {
  // Tests run with every launch feature on, so Mail is its own tab (Mail tab
  // build, 2026-10-27); the web has no Plans tab yet. Messages left the bar for
  // the top bar's chat button (founder decision 2026-11-08).
  it('exposes the tabs in order, without Messages', () => {
    expect(MOBILE_TABS.map((t) => t.key)).toEqual(['place', 'today', 'nearby', 'mail']);
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
    // Messages opens from the chat button: no tab is lit there.
    ['/app/chat', null],
    ['/app/chat/room-1', null],
    ['/app/profile/settings', null],
  ])('%s highlights %s', (path, key) => {
    expect(activeMobileTab(path)).toBe(key);
  });
});
