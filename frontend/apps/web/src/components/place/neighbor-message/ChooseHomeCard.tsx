// ============================================================
// Neighbor message · Choose a home — the web mirror of the iOS
// ChooseNeighborCard. Address suggestions while you type; picking one
// (or Use this address) asks the server whether it's on your block.
//
// Any address on your block can be chosen. The server never says who
// lives there: a note reaches a verified household if one lives there,
// and nothing here or after sending tells the sender either way.
// ============================================================

'use client';

import { useRef, useState } from 'react';
import * as api from '@pantopus/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export interface ChosenAddress {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  relativeLabel: string;
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'refused'; message: string };

function usable(text: string): boolean {
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
  onChoose: (chosen: ChosenAddress) => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const generation = useRef(0);

  const check = async (address: api.neighborMessages.NeighborAddress) => {
    const mine = ++generation.current;
    setState({ kind: 'checking' });
    try {
      const res = await api.neighborMessages.checkNeighborAddress(senderHomeId, address);
      if (mine !== generation.current) return;
      if (res.status === 'on_block') {
        const { address: street, city, state: region, zipcode } = res;
        onChoose({ address: street, city, state: region, zipcode, relativeLabel: [city, region].filter(Boolean).join(', ') });
      } else {
        setState({ kind: 'refused', message: res.message });
      }
    } catch {
      if (mine === generation.current) {
        setState({ kind: 'refused', message: "Couldn't check that address. Check your connection and try again." });
      }
    }
  };

  const checking = state.kind === 'checking';

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="text-[15px] font-semibold text-app-text">Choose a home</div>
      <p className="text-[13px] text-app-text-muted mt-1 leading-[18px]">
        Enter the house number and street of any home on your block. If a verified household lives there, they&apos;ll
        get your note. We won&apos;t tell you either way.
      </p>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (usable(query)) void check({ address: query.trim() });
        }}
      >
        <AddressAutocomplete
          value={query}
          onChange={(text) => {
            generation.current++;
            setQuery(text);
            setState({ kind: 'idle' });
          }}
          // A picked suggestion is the exact address: check it at once.
          onSelectNormalized={(n) => void check({ address: n.address, city: n.city, state: n.state, zipcode: n.zipcode })}
          ariaLabel="House number and street"
          placeholder="House number and street"
          hintText={null}
          inputClassName="w-full h-11 px-3 text-[14px] text-app-text bg-app-surface-sunken border border-app-border rounded-[10px] outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10"
          near={near}
          streetOnly
        />
        <button
          type="submit"
          disabled={!usable(query) || checking}
          className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:text-app-text-muted disabled:cursor-not-allowed"
        >
          {checking ? 'Checking…' : 'Use this address'}
        </button>
      </form>
      {state.kind === 'refused' && (
        <p role="alert" className="mt-2 text-[13px] text-app-error">
          {state.message}
        </p>
      )}
    </div>
  );
}
