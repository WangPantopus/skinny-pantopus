'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { MOBILE_TABS } from '@/components/MobileTabBar';

// Coming back to a tab shows it where you left it (Instant Screens contract §3).
// The window scroll position of each tab's page (Place, Today, Nearby,
// Messages) is kept in memory for this browser tab only, updated as you
// scroll, and put back when that page opens again. It runs after the router's
// own scroll to the top in the same commit, so nothing jumps on screen.

const TAB_PAGES = new Set(MOBILE_TABS.map((tab) => tab.href.split('?')[0]));
// A page still filling in after the navigation (sections rendering) gets a few
// more frames to grow tall enough for the kept position.
const RESTORE_FRAMES = 12;

export function useTabScroll(pathname: string | null): void {
  const positions = useRef(new Map<string, number>());
  const shown = useRef(pathname);

  useLayoutEffect(() => {
    shown.current = pathname;
    if (!pathname || !TAB_PAGES.has(pathname)) return;
    const target = positions.current.get(pathname) ?? 0;
    window.scrollTo(0, target);
    if (target === 0 || window.scrollY >= target - 1) return;
    let frames = 0;
    let frame = requestAnimationFrame(function again() {
      if (shown.current !== pathname) return;
      window.scrollTo(0, target);
      if (window.scrollY < target - 1 && ++frames < RESTORE_FRAMES) frame = requestAnimationFrame(again);
    });
    // Scrolling or tapping during those frames wins over the kept position.
    const stop = () => cancelAnimationFrame(frame);
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); };
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    const record = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (shown.current && TAB_PAGES.has(shown.current)) positions.current.set(shown.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', record, { passive: true });
    return () => { window.removeEventListener('scroll', record); cancelAnimationFrame(frame); };
  }, []);
}
