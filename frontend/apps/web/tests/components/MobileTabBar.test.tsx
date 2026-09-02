import { activeMobileTab, MOBILE_TABS } from '@/components/MobileTabBar';

describe('MobileTabBar route mapping', () => {
  it('exposes exactly the four wedge tabs in order', () => {
    expect(MOBILE_TABS.map((t) => t.key)).toEqual(['place', 'today', 'nearby', 'mail']);
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
    ['/app/chat/room-1', 'mail'],
    ['/app/profile/settings', null],
  ])('%s highlights %s', (path, key) => {
    expect(activeMobileTab(path)).toBe(key);
  });
});
