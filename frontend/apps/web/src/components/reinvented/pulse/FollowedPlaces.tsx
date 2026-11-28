'use client';

// Places you follow (Pulse, reinvented, phase 4; coord/CONTRACT.md §9c): up to five far places, a hometown or Kyoto,
// whose Explore items come into Explore. They are the reader's own choice, private: nobody is ever told or shown what
// someone follows. A place is picked with today's address search, or followed straight from an Explore item's place.

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, X } from 'lucide-react';
import { del, get, post } from '@pantopus/api/client';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import './places.css';

export interface FollowedPlace {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

const MAX = 5;

export function usePlaces(account: string) {
  return useQuery({
    queryKey: ['reinvented', 'places', account],
    queryFn: ({ signal }) => get<{ places: FollowedPlace[] }>('/api/reinvented/places', {}, { signal }),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

function messageOf(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'PLACES_FULL') return 'You follow five places. Stop following one to add another.';
  if (code === 'PLACE_INVALID') return 'That place couldn’t be followed. Pick it from the list.';
  return 'That didn’t save. Try again.';
}

/** Follow a place, then read Explore again so its items come in. Answers the error words, or ''. */
export function useFollow(account: string) {
  const client = useQueryClient();
  const reread = useRereadSwitch();
  return async (place: { label: string; latitude: number; longitude: number }): Promise<string> => {
    try {
      await post('/api/reinvented/places', { label: place.label.trim().slice(0, 60), latitude: place.latitude, longitude: place.longitude });
      await client.invalidateQueries({ queryKey: ['reinvented', 'places', account] });
      void client.invalidateQueries({ queryKey: ['reinvented', 'explore'] });
      return '';
    } catch (e) {
      if (isSwitchedOff(e)) void reread();
      return messageOf(e);
    }
  };
}

export default function FollowedPlaces({ account, near }: { account: string; near: { lat: number; lng: number } | null }) {
  const client = useQueryClient();
  const reread = useRereadSwitch();
  const places = usePlaces(account);
  const follow = useFollow(account);
  const [adding, setAdding] = useState(false);
  // The picker takes the focus as it opens (PHASE-6 G).
  const pick = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (adding) pick.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [adding]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = places.data?.places ?? [];
  if (places.isError) return null;

  async function unfollow(id: string) {
    setError('');
    try {
      await del(`/api/reinvented/places/${encodeURIComponent(id)}`);
      await client.invalidateQueries({ queryKey: ['reinvented', 'places', account] });
      void client.invalidateQueries({ queryKey: ['reinvented', 'explore'] });
    } catch (e) {
      if (isSwitchedOff(e)) void reread();
      else setError(messageOf(e));
    }
  }

  return (
    <section className="fp-places" aria-labelledby="fp-places-title">
      <h2 id="fp-places-title">Places you follow</h2>
      <div className="fp-row">
        {list.map((p) => (
          <span key={p.id} className="fp-chip">
            <MapPin size={13} aria-hidden="true" />
            {p.label}
            <button type="button" aria-label={`Stop following ${p.label}`} onClick={() => void unfollow(p.id)}>
              <X size={13} />
            </button>
          </span>
        ))}
        {!adding && list.length < MAX && (
          <button type="button" className="fp-add" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" />
            Follow a place
          </button>
        )}
      </div>
      {adding && (
        <div
          className="fp-pick"
          ref={pick}
          onKeyDown={(e) => {
            // Escape closes the picker, as Cancel does (PHASE-6 G, e2).
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            setText('');
            setAdding(false);
          }}
        >
          <AddressAutocomplete
            value={text}
            onChange={setText}
            near={near}
            placeholder="A town or a place, like Kyoto or your hometown"
            ariaLabel="A place to follow"
            hintText={null}
            onSelectNormalized={(n) => {
              if (busy || n.latitude == null || n.longitude == null) return;
              const label = (n.city || n.address.split(',')[0] || '').trim();
              if (!label) return;
              setBusy(true);
              setError('');
              void follow({ label, latitude: n.latitude, longitude: n.longitude }).then((err) => {
                setBusy(false);
                if (err) setError(err);
                else {
                  setText('');
                  setAdding(false);
                }
              });
            }}
          />
          <button type="button" className="fp-cancel" onClick={() => setAdding(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p className="fp-error" role="alert">
          {error}
        </p>
      )}
      <p className="fp-note">{list.length ? 'What people there share with Explore comes in here.' : 'A hometown, or somewhere far: what people there share with Explore comes in here.'} Only you see which places you follow.</p>
    </section>
  );
}
