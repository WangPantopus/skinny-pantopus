'use client';

// ============================================================
// The envelope sheet (Mail tab drawings, R6-Envelope board): who sent the
// piece, how Pantopus checked them, and its trail: postmarked, delivered,
// opened, then filed, shredded or paid.
// ============================================================

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import MailPiece, { pieceKind, pieceOutside, pieceTrust } from './MailPiece';

function trailTime(iso: string | null | undefined, withTime = true): string | null {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!withTime) return day.toUpperCase();
  return `${day} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`.toUpperCase();
}

/** How Pantopus checked the sender, in one sentence. */
function howChecked(piece: MailItemV2): string {
  if (piece.from_pantopus) return 'This comes from Pantopus itself.';
  switch (piece.sender_trust) {
    case 'verified_gov': return 'Pantopus checked that this sender is a government office.';
    case 'verified_utility': return 'Pantopus checked that this sender is a utility that serves your address.';
    case 'verified_business': return "Pantopus checked this business's license and its address.";
    case 'pantopus_user': return 'A Pantopus neighbor with a verified address sent this.';
    default: return "Pantopus couldn't check who sent this. Be careful with links, payments and personal details.";
  }
}

type Step = { label: string; when: string | null; done: boolean };

function trail(piece: MailItemV2): Step[] {
  const town = piece.postmark?.town ? ` · ${piece.postmark.town.toUpperCase()}` : '';
  const steps: Step[] = [
    { label: 'Postmarked', when: piece.postmark?.date ? `${trailTime(piece.postmark.date, false)}${town}` : null, done: Boolean(piece.postmark?.date) },
    { label: 'Delivered to your mailbox', when: trailTime(piece.delivered_at || piece.created_at), done: true },
    { label: 'Opened', when: trailTime(piece.first_opened_at || piece.opened_at), done: Boolean(piece.first_opened_at || piece.opened_at || piece.viewed) },
  ];
  if (piece.removed?.action === 'deleted') steps.push({ label: 'Shredded', when: trailTime(piece.removed.at), done: true });
  else if (piece.invoice?.status === 'paid') steps.push({ label: 'Paid', when: null, done: true });
  else if (piece.lifecycle === 'filed') steps.push({ label: 'Filed in the Vault', when: null, done: true });
  else if (piece.acknowledged_at) steps.push({ label: 'Acknowledged', when: trailTime(piece.acknowledged_at), done: true });
  else steps.push({ label: piece.invoice || pieceKind(piece) === 'bill' ? 'Paid or filed' : 'Filed in the Vault', when: 'Not yet', done: false });
  return steps;
}

export default function SenderSheet({
  piece,
  recipientName,
  recipientLine,
  onClose,
}: {
  piece: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const trust = pieceTrust(piece);
  const from = piece.sender_display || 'Unknown sender';
  const title = `The ${pieceOutside(pieceKind(piece))}`;

  // Focus the sheet, close on Escape, keep Tab inside, and give focus back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button, a[href]'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [onClose]);

  // On the document body, above the app's tab bar and header.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-app-surface px-5 pb-6 pt-3 shadow-2xl md:rounded-3xl"
      >
        <div aria-hidden="true" className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-app-border md:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-app-text">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl text-app-text hover:bg-app-hover">
            <X className="h-[22px] w-[22px]" aria-hidden />
          </button>
        </div>

        <div className="mt-2 max-w-[358px]">
          <MailPiece item={piece} recipientName={recipientName} recipientLine={recipientLine} opened={Boolean(piece.opened_at || piece.viewed)} />
        </div>

        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-app-text-secondary">Who sent it</h3>
          <div className="mt-2 flex items-center gap-2.5">
            <div aria-hidden="true" className="h-9 w-9 flex-shrink-0 rounded-lg bg-slate-800 text-center text-base font-bold leading-9 text-white">{from.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-app-text">{from}</p>
              <p className={`text-xs font-semibold ${trust.mark ? 'text-emerald-700' : trust.label === 'Unverified sender' ? 'text-red-700' : 'text-app-text-secondary'}`}>{trust.label}</p>
            </div>
          </div>
          <p className="mt-2 text-sm leading-5 text-app-text-strong">{howChecked(piece)}</p>
        </div>

        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-app-text-secondary">Its trail</h3>
          <ol className="relative mt-2.5">
            {trail(piece).map((step, index, all) => (
              <li key={step.label} className={`relative pl-[26px] ${index < all.length - 1 ? 'pb-3' : ''}`}>
                {index < all.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-6px] left-[6px] top-[6px] w-0.5 bg-app-border" /> : null}
                <span aria-hidden="true" className={`absolute left-0 top-[5px] h-3.5 w-3.5 rounded-full border-2 ${step.done ? 'border-primary-600 bg-primary-600' : 'border-app-border bg-app-surface'}`} />
                <p className={`text-sm leading-5 ${step.done ? 'font-semibold text-app-text' : 'text-app-text-secondary'}`}>{step.label}</p>
                {step.when ? <p className="font-mono text-xs leading-4 text-app-text-muted">{step.when}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>,
    document.body,
  );
}
