'use client';

// Atlas search (Pulse, reinvented, phase 4; coord/CONTRACT.md §9b; board B7): plain words across what the reader took,
// what the people they know captured, what is around their places, and what they learned and answered. Results are
// fresh, dated captures, newest first, each saying why it is there, opening as itself and jumping to its pin. The words
// go in a POST body, never in an address, and are never kept. Shown at the top of My Atlas while the switch is on.

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BookOpen, MapPin, Search, X } from 'lucide-react';
import type { Post } from '@pantopus/api';
import { post } from '@pantopus/api/client';
import { colors } from '@/components/moments/momentState';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import type { ListMoment, Point } from './listApi';
import './search.css';

interface FieldCard {
  post_id: string;
  dot_id: string;
  collected_at?: string;
  card: { name: string; scientific?: string | null };
  open: boolean;
}
type Result =
  | { type: 'moment'; id: string; at: string; why: string; moment: ListMoment }
  | { type: 'post'; id: string; at: string; why: string; post: Post }
  | { type: 'card'; id: string; at: string; why: string; card: FieldCard };
interface Page {
  results: Result[];
  next_cursor: string | null;
}

/** What a failed search says. */
export function searchError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'SEARCH_INVALID') return 'Try a word or two, like “mushroom” or “sunset”.';
  if (code === 'SEARCH_LIMIT') return 'That’s a lot of searching. Wait a minute, then try again.';
  return 'Search couldn’t finish. Try again.';
}

function when(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

function pointOf(r: Result): Point | null {
  if (r.type === 'moment') {
    const m = r.moment;
    return m.no_location || m.latitude == null || m.longitude == null ? null : { latitude: m.latitude, longitude: m.longitude };
  }
  if (r.type === 'post') {
    const p = r.post as unknown as Record<string, unknown>;
    const lat = num(p.effective_latitude) ?? num(p.latitude),
      lng = num(p.effective_longitude) ?? num(p.longitude);
    return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
  }
  return null;
}

function Thumb({ r }: { r: Result }) {
  if (r.type === 'card')
    return (
      <span className="as-thumb as-thumb-card" aria-hidden="true">
        <BookOpen size={18} />
      </span>
    );
  if (r.type === 'moment') {
    const m = r.moment;
    const src = m.kind === 'video' ? m.poster_url : m.kind === 'photo' ? m.media_url : null;
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element -- a signed picture of the Moment
      <img className="as-thumb" src={src} alt="" />
    ) : (
      <span className="as-thumb" style={{ background: colors[m.background || 'teal'] }} aria-hidden="true" />
    );
  }
  const src = r.post.media_urls?.[0];
  return src && !String(r.post.media_types?.[0] || 'image').startsWith('video') ? (
    // eslint-disable-next-line @next/next/no-img-element -- the post's own picture
    <img className="as-thumb" src={src} alt="" />
  ) : (
    <span className="as-thumb as-thumb-post" aria-hidden="true" />
  );
}

function wordsOf(r: Result): string {
  if (r.type === 'card') return [r.card.card.name, r.card.card.scientific].filter(Boolean).join(' · ');
  if (r.type === 'moment') return (r.moment.kind === 'text' ? r.moment.text : r.moment.caption) || r.moment.place_label || 'A Moment';
  return r.post.title || r.post.content || 'A post';
}

export default function AtlasSearch({
  account,
  onMoment,
  onPlace,
  onSearching,
}: {
  account: string;
  onMoment(m: ListMoment): void;
  onPlace(p: Point): void;
  /** Whether results are showing (My Atlas hides its own days meanwhile). */
  onSearching(on: boolean): void;
}) {
  const reread = useRereadSwitch();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const search = useInfiniteQuery({
    queryKey: ['reinvented', 'atlas-search', account, q],
    enabled: q.length >= 2,
    retry: false,
    staleTime: 60_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      try {
        return await post<Page>('/api/reinvented/atlas/search', { q, ...(pageParam ? { cursor: pageParam } : {}) }, { signal });
      } catch (e) {
        if (isSwitchedOff(e)) void reread();
        throw e;
      }
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const results = search.data?.pages.flatMap((p) => p.results) ?? [];
  const clear = () => {
    setText('');
    setQ('');
    onSearching(false);
  };
  return (
    <div className="as-search">
      <form
        className="as-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const next = text.trim().slice(0, 100);
          if (next.length < 2) return;
          setQ(next);
          onSearching(true);
        }}
      >
        <Search size={16} aria-hidden="true" />
        <input
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search your Atlas: mushroom, sunset, the bench…"
          aria-label="Search your Atlas"
          enterKeyHint="search"
          onKeyDown={(e) => {
            // Escape clears the search; on an empty field it leaves it (PHASE-6 G: Escape closes the topmost thing).
            if (e.key !== 'Escape') return;
            e.preventDefault();
            if (text || q) clear();
            else e.currentTarget.blur();
          }}
        />
        {q && (
          <button type="button" className="as-clear" onClick={clear} aria-label="Clear the search">
            <X size={16} />
          </button>
        )}
      </form>
      {q && (
        <div className="as-results" aria-live="polite">
          {search.isPending ? (
            <p className="rp-atlas-note">Searching…</p>
          ) : search.isError ? (
            <p className="rp-atlas-note" role="alert">
              {searchError(search.error)}
            </p>
          ) : results.length === 0 ? (
            <p className="rp-atlas-note">Nothing for “{q}” in what you took, the people you know, around your places, or what you learned.</p>
          ) : (
            <ol className="as-list">
              {results.map((r) => {
                const point = pointOf(r);
                const meta = [r.why, when(r.at)].filter(Boolean).join(' · ');
                const body = (
                  <>
                    <Thumb r={r} />
                    <span className="as-words">
                      <strong>{wordsOf(r)}</strong>
                      <small>{meta}</small>
                    </span>
                  </>
                );
                return (
                  <li key={`${r.type}:${r.id}`} className="as-item">
                    {r.type === 'moment' ? (
                      <button type="button" className="as-open" onClick={() => onMoment(r.moment)}>
                        {body}
                      </button>
                    ) : r.type === 'post' ? (
                      <Link className="as-open" href={`/app/feed/post/${encodeURIComponent(r.post.id)}`}>
                        {body}
                      </Link>
                    ) : r.card.open ? (
                      <Link className="as-open" href={`/app/feed/post/${encodeURIComponent(r.card.post_id)}`}>
                        {body}
                      </Link>
                    ) : (
                      <Link className="as-open" href="/app/field-guide">
                        {body}
                      </Link>
                    )}
                    {point && (
                      <button type="button" className="as-pin" onClick={() => onPlace(point)} aria-label="Show it on the map">
                        <MapPin size={16} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {search.hasNextPage && (
            <button type="button" className="rp-button rp-button-quiet" onClick={() => void search.fetchNextPage()} disabled={search.isFetchingNextPage}>
              {search.isFetchingNextPage ? 'Loading more…' : 'More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
