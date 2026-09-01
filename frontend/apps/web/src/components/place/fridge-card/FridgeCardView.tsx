// ============================================================
// FridgeCardView — the public 911-ready household card.
// Opened by whoever holds the link or scans the printout: a panicking
// babysitter, a house-sitter, a neighbor. Design priorities, in order:
//   1. the ADDRESS is the headline — it is the first thing a 911
//      dispatcher asks for, and the reader may not know it;
//   2. sections read at a glance under stress — no chrome, big type;
//   3. it prints beautifully (the "fridge" in fridge card) — the
//      Print button and @media print styles are part of the product.
// A revoked card shows a clear "no longer active" state and NO content.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { FridgeCardPublic, FridgeCardSectionKey } from '@pantopus/api';
import { Phone, Users, Cross, PawPrint, Wrench, StickyNote, Printer, Loader2, ShieldX, MapPin } from 'lucide-react';

const SECTION_META: Record<FridgeCardSectionKey, { title: string; icon: typeof Users }> = {
  household: { title: 'Household', icon: Users },
  medical: { title: 'Medical', icon: Cross },
  pets: { title: 'Pets', icon: PawPrint },
  utilities: { title: 'Shutoffs & utilities', icon: Wrench },
  contacts: { title: 'Emergency contacts', icon: Phone },
  notes: { title: 'Notes', icon: StickyNote },
};

type ViewState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'result'; result: FridgeCardPublic };

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function DeadCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 flex items-start gap-3.5">
      <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
        <ShieldX size={22} strokeWidth={2} className="text-app-text-muted" />
      </span>
      <div>
        <div className="text-[16px] font-bold text-app-text -tracking-[0.01em]">{title}</div>
        <div className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1">{detail}</div>
      </div>
    </div>
  );
}

export default function FridgeCardView({ code }: { code: string }) {
  const [state, setState] = useState<ViewState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api.fridgeCards.getPublicFridgeCard(code)
      .then((result) => { if (!cancelled) setState({ phase: 'result', result }); })
      .catch(() => { if (!cancelled) setState({ phase: 'error' }); });
    return () => { cancelled = true; };
  }, [code]);

  if (state.phase === 'loading') {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-[14px] text-app-text-secondary">
          <Loader2 size={17} className="animate-spin text-app-text-muted" /> Loading the card…
        </div>
      </main>
    );
  }

  if (state.phase === 'error') {
    return (
      <main className="min-h-screen bg-app-bg">
        <div className="max-w-[560px] mx-auto px-4 sm:px-5 pt-10">
          <DeadCard title="Couldn’t load the card" detail="Check your connection and reload. In a real emergency, call 911 — dispatchers can help even without this page." />
        </div>
      </main>
    );
  }

  const { result } = state;
  if (!result.valid) {
    return (
      <main className="min-h-screen bg-app-bg">
        <div className="max-w-[560px] mx-auto px-4 sm:px-5 pt-10">
          <DeadCard title="No card found" detail="This link doesn’t match any Pantopus fridge card. Check it against the printout you were given." />
        </div>
      </main>
    );
  }
  if (result.status !== 'active') {
    return (
      <main className="min-h-screen bg-app-bg">
        <div className="max-w-[560px] mx-auto px-4 sm:px-5 pt-10">
          <DeadCard
            title="This card is no longer active"
            detail={`The household replaced or revoked this card${result.revoked_at ? ` on ${fmtDate(result.revoked_at)}` : ''}. Ask them for the current one.`}
          />
        </div>
      </main>
    );
  }

  const content = result.content!;

  return (
    <main className="min-h-screen bg-app-bg print:bg-white">
      <div className="max-w-[560px] mx-auto px-4 sm:px-5 pt-6 pb-16 print:pt-2 print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-app-text-muted">
            Pantopus fridge card{result.label ? ` · ${result.label}` : ''}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13px] font-semibold flex items-center gap-1.5 hover:bg-app-hover transition"
          >
            <Printer size={14} strokeWidth={2.25} /> Print for the fridge
          </button>
        </div>

        {/* The address IS the headline — what the caller reads to 911. */}
        <div className="bg-app-surface border-2 border-app-border-strong rounded-2xl shadow-sm p-5 print:border-black print:shadow-none">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-app-text-muted flex items-center gap-1.5">
            <MapPin size={12} strokeWidth={2.5} /> In an emergency, call 911 and say this address
          </div>
          <div className="text-[26px] leading-[32px] font-bold text-app-text -tracking-[0.01em] mt-2">{content.address.line1}</div>
          <div className="text-[18px] leading-[24px] font-semibold text-app-text-strong mt-0.5">{content.address.city_state_zip}</div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {content.sections.map((section) => {
            const meta = SECTION_META[section.key] ?? SECTION_META.notes;
            const Icon = meta.icon;
            return (
              <section key={section.key} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 print:border-black/40 print:shadow-none print:break-inside-avoid">
                <h2 className="text-[12px] font-bold tracking-[0.06em] uppercase text-app-text-muted flex items-center gap-1.5 mb-2">
                  <Icon size={13} strokeWidth={2.5} /> {meta.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-[15px] leading-[21px]">
                      {item.label && <span className="font-bold text-app-text">{item.label}</span>}
                      {item.label && item.note && <span className="text-app-text-muted"> — </span>}
                      {item.note && <span className="text-app-text-strong">{item.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="text-[12px] text-app-text-muted leading-[18px] mt-5 pt-3 border-t border-app-border-subtle">
          Prepared by the verified residents of this address on {fmtDate(result.issued_at)}. This card is read by people, not delivered to 911 dispatch. The household can revoke it at any time.
          <span className="print:hidden">
            {' '}<Link href="/start" className="text-primary-600 font-semibold hover:underline">What is Pantopus?</Link>
          </span>
        </div>
      </div>
    </main>
  );
}
