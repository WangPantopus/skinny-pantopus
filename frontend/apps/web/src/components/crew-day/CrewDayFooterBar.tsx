'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A booking step's bottom bar (boards `Price`, `Review`, `Booked`): the total and the step's button stay in reach.
 * With large text the bar would cover most of the screen, so past a third of the window it sits at the end of the
 * page instead of staying pinned.
 */
export default function CrewDayFooterBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const measure = () => setPinned(bar.offsetHeight <= window.innerHeight * 0.34);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`${pinned ? 'sticky bottom-0' : ''} z-10 flex flex-col gap-2.5 border-t border-app-border bg-app-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3`}
    >
      {children}
    </div>
  );
}
