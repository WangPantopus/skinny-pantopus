// ============================================================
// VerifyResidency — public third-party checker for residency letters.
// A landlord/school holding a letter enters (or deep-links) the printed
// code; the page answers from GET /api/public/residency-letters/:code:
//   * active   — genuine and currently valid (green)
//   * revoked  — genuine but revoked by the resident (amber, NOT valid)
//   * unknown  — no such letter (neutral)
// Anonymous by design — no account, nothing persisted.
// ============================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { ResidencyLetterVerification } from '@pantopus/api';
import { LayoutDashboard, ShieldCheck, ShieldAlert, ShieldX, Loader2, Search } from 'lucide-react';

type CheckState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'error' }
  | { phase: 'result'; result: ResidencyLetterVerification };

// Forgiving display normalization: uppercase, group as XXXX-XXXX-XXXX-XXXX.
function prettifyCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return chars.replace(/(.{4})(?=.)/g, '$1-');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ResultPanel({ result }: { result: ResidencyLetterVerification }) {
  if (!result.valid) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 flex items-start gap-3.5">
        <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <ShieldX size={22} strokeWidth={2} className="text-app-text-muted" />
        </span>
        <div>
          <div className="text-[16px] font-bold text-app-text -tracking-[0.01em]">No letter found</div>
          <div className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1">
            This code doesn&apos;t match any Pantopus residency letter. Check it against the paper — codes use letters and numbers only.
          </div>
        </div>
      </div>
    );
  }

  const revoked = result.status === 'revoked';
  const address = result.address;
  const cityZip = address
    ? [[address.city, address.state].filter(Boolean).join(', '), address.zipcode].filter(Boolean).join(' ')
    : '';

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-5 py-4 flex items-center gap-3.5 ${revoked ? 'bg-app-warning-light/50' : 'bg-app-home-bg'}`}>
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-app-surface border ${revoked ? 'border-app-warning' : 'border-app-success-light'}`}>
          {revoked
            ? <ShieldAlert size={24} strokeWidth={2} className="text-app-warning" />
            : <ShieldCheck size={24} strokeWidth={2} className="text-app-home" />}
        </span>
        <div>
          <div className="text-[17px] font-bold text-app-text -tracking-[0.01em]">
            {revoked ? 'Genuine, but revoked' : 'Verified residency letter'}
          </div>
          <div className="text-[13px] text-app-text-secondary mt-0.5">
            {revoked
              ? `This letter was issued by Pantopus but the resident revoked it on ${fmtDate(result.revoked_at)}. Treat it as no longer valid.`
              : 'Issued by Pantopus and currently active.'}
          </div>
        </div>
      </div>
      <div className="px-5 py-4 grid gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">Resident</div>
          <div className="text-[15px] font-semibold text-app-text">{result.resident_name}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">Verified address</div>
          <div className="text-[15px] font-semibold text-app-text leading-[21px]">{address?.line1}<br />{cityZip}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">Issued</div>
            <div className="text-[14px] text-app-text-strong">{fmtDate(result.issued_at)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-0.5">Issued for</div>
            <div className="text-[14px] text-app-text-strong">{result.purpose}</div>
          </div>
        </div>
        <div className="text-[12.5px] text-app-text-muted leading-[18px] pt-2 border-t border-app-border-subtle">
          Match these details against the letter you were handed. This check confirms the letter&apos;s code, holder, address, and current status — it is not a government record.
        </div>
      </div>
    </div>
  );
}

export default function VerifyResidency({ initialCode }: { initialCode?: string }) {
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
      const result = await api.residencyLetters.verifyResidencyLetter(normalized);
      setState({ phase: 'result', result });
    } catch {
      setState({ phase: 'error' });
    }
  }, []);

  // Deep link: the letter's QR/URL lands here with the code — check it.
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
          Verify a residency letter
        </h1>
        <p className="text-[14.5px] text-app-text-secondary leading-[21px] mt-2">
          Enter the verification code printed on the letter to confirm it&apos;s genuine and still active.
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
            aria-label="Letter verification code"
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
          Residency letters are issued by verified Pantopus residents from their address-verified homes.{' '}
          <Link href="/start" className="text-primary-600 font-semibold hover:underline">See what Pantopus knows about an address →</Link>
        </p>
      </div>
    </main>
  );
}
