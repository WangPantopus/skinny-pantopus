// ============================================================
// Neighbor message · Choose a home — the web mirror of the iOS
// ChooseNeighborCard. Address suggestions while you type; picking one
// (or Search homes) looks the address up among discoverable homes.
//
// The privacy contract is discovery's: only homes whose household turned
// discovery on can appear, never a redacted or ambiguous address, never
// your own household, never a resident's name. Sending still needs a
// verified household on your block; the server checks both.
// ============================================================

'use client';

import { useRef, useState } from 'react';
import { Home as HomeIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export interface ChosenHome {
  homeId: string;
  address: string;
  relativeLabel: string;
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; homes: api.homes.HomeDiscoverItem[] }
  | { kind: 'error' };

function searchable(text: string): boolean {
  const q = text.trim();
  return q.length >= 4 && /\d/.test(q) && /[a-z]/i.test(q);
}

export default function ChooseHomeCard({
  senderHomeId,
  near,
  onChoose,
}: {
  senderHomeId: string;
  near: { lat: number; lng: number } | null;
  onChoose: (home: ChosenHome) => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const generation = useRef(0);

  const search = async (text: string) => {
    if (!searchable(text)) return;
    const mine = ++generation.current;
    setState({ kind: 'loading' });
    try {
      const res = await api.homes.discoverHomes({ q: text.trim(), limit: 50 });
      if (mine !== generation.current) return;
      const homes = (res.homes ?? []).filter(
        (h) => h.id !== senderHomeId && !h.is_member && h.address_redacted === false
          && h.visibility === 'public_preview' && !!h.address,
      );
      setState({ kind: 'loaded', homes });
    } catch {
      if (mine === generation.current) setState({ kind: 'error' });
    }
  };

  const loading = state.kind === 'loading';

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="text-[15px] font-semibold text-app-text">Choose a home</div>
      <p className="text-[13px] text-app-text-muted mt-1 leading-[18px]">
        Enter the house number and street. Only homes with discovery enabled appear; sending requires a verified
        household on your block.
      </p>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <AddressAutocomplete
          value={query}
          onChange={(text) => {
            generation.current++;
            setQuery(text);
            setState({ kind: 'idle' });
          }}
          // A picked suggestion is the exact address: look it up at once.
          onSelectNormalized={(n) => void search(n.address)}
          ariaLabel="House number and street"
          placeholder="House number and street"
          hintText={null}
          inputClassName="w-full h-11 px-3 text-[14px] text-app-text bg-app-surface-sunken border border-app-border rounded-[10px] outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10"
          near={near}
          streetOnly
        />
        <button
          type="submit"
          disabled={!searchable(query) || loading}
          className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:text-app-text-muted"
        >
          {loading ? 'Searching…' : 'Search homes'}
        </button>
      </form>
      {state.kind === 'error' && (
        <p role="alert" className="mt-2 text-[13px] text-app-error">
          Couldn&apos;t search homes. Check your connection and try again.
        </p>
      )}
      {state.kind === 'loaded' && state.homes.length === 0 && (
        <p className="mt-2 text-[13px] text-app-text-muted leading-[18px]">
          No selectable homes found. Check the number and street; private homes and your own household won&apos;t
          appear.
        </p>
      )}
      {state.kind === 'loaded' && state.homes.length > 0 && (
        <ul className="mt-1">
          {state.homes.map((home) => {
            const where = [home.city, home.state].filter(Boolean).join(', ');
            return (
              <li key={home.id}>
                <button
                  type="button"
                  onClick={() => onChoose({ homeId: home.id, address: home.address, relativeLabel: where })}
                  className="w-full flex items-center gap-3 py-2 text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-app-home-bg flex items-center justify-center shrink-0 text-app-home">
                    <HomeIcon size={17} strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-app-text truncate">{home.address}</span>
                    <span className="block text-[12px] text-app-text-muted truncate">{where}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
