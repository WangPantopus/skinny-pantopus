'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MarketingReveal — Adds `.in` class to all `.mh-reveal` elements as they
// scroll into view. Mounted once near the root of the homepage; cheap to use.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';

export default function MarketingReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const els = document.querySelectorAll<HTMLElement>('.mh-reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
