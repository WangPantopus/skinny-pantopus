'use client';

// Ask the map (Pulse, reinvented, phase 4; coord/CONTRACT.md §9b): type "cozy study cafe" and the matching pins in view
// light up while the rest dim. The words and the map's own box go in a POST body, never in an address, and are never
// kept. The server answers only what this reader's map already shows for the time in view; the map lights those.

import { useState } from 'react';
import { Search, UserRoundSearch, X } from 'lucide-react';
import type { Ring } from '@pantopus/api/endpoints/moments';
import { post } from '@pantopus/api/client';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import { searchError } from './AtlasSearch';
import type { Box, MapData, MapTime } from './listApi';
import './search.css';

interface Match {
  type: 'moment' | 'post';
  id: string;
  words: string[];
}

/** The lit pins, by the map's pin key, with the words each matched; null while nothing is asked. */
export interface Lit {
  q: string;
  pins: Map<string, string[]>;
  more: boolean;
}

/** A Moment lights its ring (or the reader's own kept pin); a post lights its mark. */
function pinKeys(matches: Match[], data: MapData | undefined): Map<string, string[]> {
  const ringOf = new Map<string, Ring>();
  for (const ring of data?.rings || []) for (const m of ring.moments || []) ringOf.set(m.id, ring);
  const out = new Map<string, string[]>();
  for (const m of matches) {
    const key = m.type === 'post' ? `mark:${m.id}` : ringOf.has(m.id) ? `ring:${ringOf.get(m.id)!.id}` : `kept:${m.id}`;
    out.set(key, [...new Set([...(out.get(key) || []), ...m.words])]);
  }
  return out;
}

export default function AskTheMap({
  box,
  time,
  data,
  lit,
  shown,
  onLit,
  onSearch,
  searchAlways = false,
}: {
  box: Box | null;
  time: MapTime;
  data: MapData | undefined;
  lit: Lit | null;
  /** How many lit pins the map draws now. */
  shown: number;
  onLit(lit: Lit | null): void;
  /**
   * The lens is one field for both jobs (PHASE-6 A1; LEAD-8, 11:09): under "Ask the map", the typed words can search people
   * and places in today's Discover instead.
   */
  onSearch?(words: string): void;
  /** Offer the search with no words typed too (at a phone's width, where the app's own search stepped aside). */
  searchAlways?: boolean;
}) {
  const reread = useRereadSwitch();
  const [text, setText] = useState(lit?.q ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function ask() {
    const q = text.trim().slice(0, 100);
    if (busy || !box || q.length < 2) return;
    setBusy(true);
    setError('');
    try {
      const answer = await post<{ matches: Match[]; more: boolean }>('/api/reinvented/map/ask', { q, ...box, time });
      onLit({ q, pins: pinKeys(answer.matches || [], data), more: !!answer.more });
    } catch (e) {
      if (isSwitchedOff(e)) void reread();
      else setError(searchError(e));
    } finally {
      setBusy(false);
    }
  }
  const count = shown;
  return (
    <div className="am-ask">
      <form
        className="am-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Search size={15} aria-hidden="true" />
        <input
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the map: cozy study cafe"
          aria-label="Ask the map"
          enterKeyHint="search"
          disabled={busy}
        />
        {lit && (
          <button
            type="button"
            className="am-clear"
            aria-label="Clear and show every pin"
            onClick={() => {
              setText('');
              setError('');
              onLit(null);
            }}
          >
            <X size={15} />
          </button>
        )}
      </form>
      {onSearch && (text.trim() || searchAlways) && (
        <button type="button" className="rp-lens-more" onClick={() => onSearch(text.trim().slice(0, 100))}>
          <UserRoundSearch size={16} aria-hidden />
          <span>{text.trim() ? `Search people and places for “${text.trim().slice(0, 100)}”` : 'Search people and places'}</span>
        </button>
      )}
      {(lit || error) && (
        <p className="am-said" role="status">
          {error || (count ? `${count} lit for “${lit!.q}”${lit!.more ? ', and more beyond these' : ''}` : `Nothing here for “${lit!.q}”. Move the map or try other words.`)}
        </p>
      )}
    </div>
  );
}
