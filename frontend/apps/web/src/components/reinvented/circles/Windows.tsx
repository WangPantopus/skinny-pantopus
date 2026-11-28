'use client';

// Homes talk to homes (Pulse, reinvented, phase 4; coord/CONTRACT.md §9f): the windows the people in the reader's
// circles show for their homes, lit when someone there shared something today (a Moment or a Pulse post, Pacific day).
// A window never has a place: it says only its name and "shared today", never what, where, how many or when. Each one is
// its member's own choice, per circle, off by default.

import { useQuery } from '@tanstack/react-query';
import { get } from '@pantopus/api/client';
import { useMouseDragScroll } from '../pulse/mouseDragScroll';
import './windows.css';

export interface HomeWindow {
  circle_id: string;
  circle: string;
  label: string;
  lit: boolean;
}

export function useWindows(account: string | null, enabled = true) {
  return useQuery({
    queryKey: ['reinvented', 'windows', account],
    enabled: enabled && !!account,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => get<{ windows: HomeWindow[] }>('/api/reinvented/windows', {}, { signal }),
  });
}

/** A row of windows: lit ones glow. `circle` limits it to one circle's. Nothing at all when there are none. */
export default function Windows({ account, circle = null, title = 'Homes' }: { account: string | null; circle?: string | null; title?: string }) {
  const windows = useWindows(account);
  // The row scrolls sideways by a mouse drag too (PHASE-6 G), as the alive strip does.
  const { ref: rowRef, onPointerDown, onClickCapture } = useMouseDragScroll<HTMLUListElement>();
  const list = (windows.data?.windows || []).filter((w) => !circle || w.circle_id === circle);
  if (!list.length) return null;
  return (
    <section className="hw-windows" aria-label={title}>
      <h3>{title}</h3>
      <ul ref={rowRef} onPointerDown={onPointerDown} onClickCapture={onClickCapture}>
        {list.map((w) => (
          <li key={`${w.circle_id}:${w.label}`} data-lit={w.lit || undefined}>
            <span className="hw-pane" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="hw-words">
              <strong>{w.label}</strong>
              <small>{w.lit ? 'Shared today' : 'Quiet today'}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
