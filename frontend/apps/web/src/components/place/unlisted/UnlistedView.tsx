// ============================================================
// /unlisted — "type your address to get it off the internet", with no
// account and nothing stored.
//
// Plain useState + the api client, deliberately — NOT because react-query
// is unavailable. The root layout wraps every route in QueryProvider, so
// the older comment here claiming public routes render outside it was
// simply wrong. The reason is that this page must not participate in the
// app's cache: a cached query keyed on a typed address is a record of the
// lookup, on the one surface that promises there isn't one.
//
// Order on the page is the product:
//   1. QUICK EXIT, reachable from the first paint.
//   2. THE STATE'S ADDRESS CONFIDENTIALITY PROGRAM — a legal substitute
//      address, above every opt-out link, never behind a signup.
//   3. `method_note` verbatim: we did NOT look this address up anywhere,
//      because doing so would hand it to the very companies being left.
//   4. The removal paths, each carrying its own caveat in full.
//
// A deliberately plain input, not the funnel's typeahead: the address is
// sent once, to one place we run, rather than character by character.
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { PublicUnlisted } from '@pantopus/api';
import { MapPinned, Loader2, Search, Lock } from 'lucide-react';
import {
  QuickExit,
  StateProgramSection,
  MethodNote,
  BrokerGroups,
  WeDoNotRemoveNote,
  fmtDay,
} from './parts';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; result: PublicUnlisted };

export default function UnlistedView() {
  const [address, setAddress] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!value) return;
    setPhase({ kind: 'loading' });
    try {
      const result = await api.unlisted.getPublicUnlisted(value);
      setPhase({ kind: 'result', result });
    } catch {
      setPhase({ kind: 'error' });
    }
  };

  const result = phase.kind === 'result' ? phase.result : null;
  const profile = result?.unlisted;

  return (
    <main className="min-h-screen bg-app-bg">
      <div className="mx-auto w-full max-w-[560px] px-4 sm:px-5 pb-16">
        {/* Quick exit sits in the first row of the page, before anything
            else, so it is reachable the moment the page paints. */}
        <div className="flex items-start justify-between gap-3 pt-3">
          <div className="flex items-center gap-2.5 pt-1">
            <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-app-home shadow-sm">
              <MapPinned size={17} strokeWidth={2.25} className="text-white" />
            </span>
            <span className="text-lg font-bold -tracking-[0.02em] text-app-text">Pantopus</span>
          </div>
          <QuickExit />
        </div>

        <h1 className="text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px] font-bold -tracking-[0.025em] text-app-text mt-7">
          Get your address off the internet.
        </h1>
        <p className="mt-3 text-[15px] leading-[22px] text-app-text-secondary">
          Your state may offer a legal substitute address that fixes this at the source. Below that: the sites we
          have verified a removal path for, and the exact way to leave each one.
        </p>

        <form onSubmit={submit} className="mt-5">
          <label htmlFor="unlisted-address" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">
            Your address
          </label>
          <input
            id="unlisted-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="1421 SE Oak St, Portland, OR"
            className="w-full h-[52px] px-4 text-[15.5px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-xl outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 placeholder:text-app-text-muted"
          />
          <button
            type="submit"
            disabled={!address.trim() || phase.kind === 'loading'}
            className="w-full h-[52px] mt-2.5 rounded-xl bg-primary-600 text-white text-[15.5px] font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition disabled:opacity-50"
          >
            {phase.kind === 'loading'
              ? (<><Loader2 size={18} className="animate-spin" /> Looking up your state…</>)
              : (<><Search size={17} strokeWidth={2.25} /> Show me what to do</>)}
          </button>
        </form>

        <div className="flex items-start gap-2 mt-3 px-3.5 py-3 rounded-xl border border-app-border bg-app-surface">
          <Lock size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-app-text-muted" />
          <p className="text-[12.5px] leading-[18px] text-app-text-secondary">
            We do not save this address, and we do not send it anywhere else — not even to a mapping service. It is
            read once, on our server, to work out which state you are in, and the answer below is the same for
            everyone in that state.
          </p>
        </div>

        {phase.kind === 'error' ? (
          <p className="text-[13.5px] text-app-error leading-[20px] mt-4">
            We couldn&apos;t look that up. Check the address and try again.
          </p>
        ) : null}

        {/* "We could not read a state out of that" is a different answer
            from "you are not in the United States", and it is the far
            more common one. It must never be dressed as the geographic
            denial below: the removal list underneath is national and is
            still rendered in full. */}
        {result && result.status === 'could_not_place' ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-6">
            <h2 className="text-[16px] font-bold text-app-text -tracking-[0.01em]">
              {result.message ?? 'We could not tell which state that is'}
            </h2>
            <p className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1.5">
              Add the state or ZIP — &ldquo;Portland, OR&rdquo; or &ldquo;97214&rdquo; — and your state&apos;s
              program appears too. Everything below applies anywhere in the U.S.; the programs and removal paths
              come from U.S. law and U.S. public-record sites, so outside the U.S. they will not help you.
            </p>
          </div>
        ) : null}

        {result && result.status === 'unsupported_region' ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-6">
            <h2 className="text-[16px] font-bold text-app-text -tracking-[0.01em]">
              {result.message ?? 'Address removal help is U.S.-only for now'}
            </h2>
            <p className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1.5">
              The programs and removal paths here come from U.S. state law and U.S. public-record sites, so we have
              nothing accurate to give you outside the U.S. yet.
            </p>
          </div>
        ) : null}

        {profile ? (
          <div className="mt-7">
            {result?.place?.state ? (
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted px-1 mb-2">
                {[result.place.city, result.place.state].filter(Boolean).join(', ')}
              </div>
            ) : null}

            {/* 1. The escape hatch. Above the list, no account, no gate. */}
            <StateProgramSection profile={profile} />

            {/* 2. The honesty line, verbatim, next to the list it is about. */}
            <div className="mt-6">
              <MethodNote note={profile.method_note} />
            </div>

            {/* 3. The removal paths. */}
            <BrokerGroups profile={profile} />

            {profile.registry_verified_at ? (
              <p className="text-[12px] text-app-text-muted mt-4 px-1">
                {profile.broker_count} {profile.broker_count === 1 ? 'site' : 'sites'} · links last checked{' '}
                {fmtDay(profile.registry_verified_at)}. Sites move their opt-out pages, so tell us if one is dead.
              </p>
            ) : null}

            <WeDoNotRemoveNote />

            <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-4">
              <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">
                Want to keep track of which ones you have sent?
              </div>
              <p className="text-[13px] text-app-text-secondary leading-[19px] mt-1">
                {result?.disclaimer
                  ?? 'We did not save this address. Claim it to keep track of which removals you have sent.'}
              </p>
              <Link
                href="/register"
                className="inline-flex items-center mt-3 h-10 px-4 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13.5px] font-semibold hover:bg-app-hover transition"
              >
                Create a free account
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
