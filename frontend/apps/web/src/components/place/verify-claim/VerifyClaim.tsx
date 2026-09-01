// ============================================================
// VerifyClaim — public third-party checker for residency CLAIMS.
// A clerk/leasing agent/coach opens the claim's link (or types the
// code); the page answers from GET /api/public/residency-claims/:code.
//
// Unlike the letter check, the answer is LIVE:
//   * active             — statement holds right now (green)
//   * no_longer_verified — genuine claim, but the issuer no longer holds
//                          verified occupancy (amber, NOT valid)
//   * expired            — past its chosen lifetime (amber, NOT valid)
//   * revoked            — pulled by the holder (amber, NOT valid)
//   * unknown            — no such claim (neutral)
// The page shows the frozen statement and NOTHING else — a scoped claim
// discloses one fact, never the address. Anonymous by design.
// ============================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { ResidencyClaimVerification } from '@pantopus/api';
import { LayoutDashboard, ShieldCheck, ShieldAlert, ShieldX, Loader2, Search, Clock } from 'lucide-react';

type CheckState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'error' }
  | { phase: 'result'; result: ResidencyClaimVerification };

// Forgiving display normalization: uppercase, group as XXXX-XXXX-XXXX-XXXX.
function prettifyCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return chars.replace(/(.{4})(?=.)/g, '$1-');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const NOT_VALID_COPY: Record<string, { title: string; detail: (r: ResidencyClaimVerification) => string }> = {
  revoked: {
    title: 'Genuine, but revoked',
    detail: (r) => `This claim was issued through Pantopus but the holder revoked it on ${fmtDate(r.revoked_at)}. Treat it as no longer valid.`,
  },
  expired: {
    title: 'Genuine, but expired',
    detail: (r) => `This claim reached its chosen expiry on ${fmtDate(r.expires_at)}. Ask the holder for a fresh one — issuing takes seconds.`,
  },
  no_longer_verified: {
    title: 'No longer a verified resident',
    detail: () => 'This claim is genuine, but the holder’s address verification is no longer active for that home. Treat it as not valid.',
  },
};

function ResultPanel({ result }: { result: ResidencyClaimVerification }) {
  if (!result.valid) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 flex items-start gap-3.5">
        <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <ShieldX size={22} strokeWidth={2} className="text-app-text-muted" />
        </span>
        <div>
          <div className="text-[16px] font-bold text-app-text -tracking-[0.01em]">No claim found</div>
          <div className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1">
            This code doesn&apos;t match any Pantopus residency claim. Check it against what you were shown — codes use letters and numbers only.
          </div>
        </div>
      </div>
    );
  }

  const active = result.status === 'active';
  const notValid = !active ? NOT_VALID_COPY[result.status || ''] : null;

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-5 py-4 flex items-center gap-3.5 ${active ? 'bg-app-home-bg' : 'bg-app-warning-light/50'}`}>
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-app-surface border ${active ? 'border-app-success-light' : 'border-app-warning'}`}>
          {active
            ? <ShieldCheck size={24} strokeWidth={2} className="text-app-home" />
            : <ShieldAlert size={24} strokeWidth={2} className="text-app-warning" />}
        </span>
        <div>
          <div className="text-[17px] font-bold text-app-text -tracking-[0.01em]">
            {active ? 'Verified — checked live just now' : notValid?.title}
          </div>
          <div className="text-[13px] text-app-text-secondary mt-0.5">
            {active
              ? 'The statement below holds right now: the holder’s address verification is currently active.'
              : notValid?.detail(result)}
          </div>
        </div>
      </div>
      <div className="px-5 py-4 grid gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">This claim states</div>
          {result.statement ? (
            <div className="text-[16px] font-semibold text-app-text leading-[23px]">{result.statement}</div>
          ) : (
            // The server withholds a non-active claim's statement —
            // revocation and expiry actually pull the content.
            <div className="text-[14px] text-app-text-muted leading-[20px] italic">
              The statement is no longer disclosed. When a claim is revoked or expires, its content is withdrawn along with it.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">Issued</div>
            <div className="text-[14px] text-app-text-strong">{fmtDate(result.issued_at)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">
              {active ? 'Valid until' : 'Expiry'}
            </div>
            <div className="text-[14px] text-app-text-strong flex items-center gap-1.5">
              <Clock size={13} strokeWidth={2.25} className="text-app-text-muted" />
              {fmtDate(result.expires_at)}
            </div>
          </div>
        </div>
        <div className="text-[12.5px] text-app-text-muted leading-[18px] pt-2 border-t border-app-border-subtle">
          A claim discloses exactly one fact the holder chose to share — nothing more. This check confirms the claim&apos;s code, its statement, and the holder&apos;s current verification status; each check is logged for the holder. It is not a government record.
        </div>
      </div>
    </div>
  );
}

export default function VerifyClaim({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(() => prettifyCode(initialCode || ''));
  const [state, setState] = useState<CheckState>({ phase: 'idle' });

  const check = useCallback(async (value: string) => {
    const normalized = prettifyCode(value);
    if (normalized.replace(/-/g, '').length !== 16) {
      setState({ phase: 'result', result: { valid: false } });
      return;
    }
    setState({ phase: 'checking' });
    try {
      const result = await api.residencyClaims.verifyResidencyClaim(normalized);
      setState({ phase: 'result', result });
    } catch {
      setState({ phase: 'error' });
    }
  }, []);

  // Deep link: the claim's shared URL lands here with the code — check it.
  useEffect(() => {
    if (initialCode) void check(initialCode);
  }, [initialCode, check]);

  return (
    <main className="min-h-screen bg-app-bg">
      <div className="max-w-[480px] mx-auto px-4 sm:px-5 pt-8 pb-16">
        <Link href="/start" className="inline-flex items-center gap-2.5 mb-7">
          <span className="w-8 h-8 rounded-[9px] bg-primary-600 flex items-center justify-center">
            <LayoutDashboard size={18} strokeWidth={2.25} className="text-white" />
          </span>
          <span className="text-[17px] font-bold text-app-text -tracking-[0.01em]">Pantopus</span>
        </Link>

        <h1 className="text-[26px] font-bold text-app-text -tracking-[0.02em] leading-[32px]">
          Verify a residency claim
        </h1>
        <p className="text-[14.5px] text-app-text-secondary leading-[21px] mt-2">
          Enter the code you were shown to confirm the claim is genuine — checked live against the holder&apos;s current verification.
        </p>

        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void check(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(prettifyCode(e.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoFocus={!initialCode}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Claim verification code"
            className="flex-1 h-[50px] px-4 text-[16px] font-mono tracking-[0.06em] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-xl outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 placeholder:text-app-text-muted placeholder:font-sans placeholder:tracking-normal"
          />
          <button
            type="submit"
            disabled={state.phase === 'checking'}
            className="h-[50px] px-5 rounded-xl bg-primary-600 text-white text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition disabled:opacity-60"
          >
            {state.phase === 'checking' ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} strokeWidth={2.25} />}
            Check
          </button>
        </form>

        <div className="mt-5">
          {state.phase === 'checking' && (
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 text-[14px] text-app-text-secondary flex items-center gap-2.5">
              <Loader2 size={17} className="animate-spin text-app-text-muted" /> Checking the code…
            </div>
          )}
          {state.phase === 'error' && (
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 text-[14px] text-app-text-secondary">
              We couldn&apos;t reach verification just now. Try again in a moment.
            </div>
          )}
          {state.phase === 'result' && <ResultPanel result={state.result} />}
        </div>

        <p className="text-[12.5px] text-app-text-muted leading-[18px] mt-8">
          Residency claims are issued by verified Pantopus residents — proof of residence that shares one fact, not the whole address.{' '}
          <Link href="/start" className="text-primary-600 font-semibold hover:underline">See what Pantopus knows about an address →</Link>
        </p>
      </div>
    </main>
  );
}
