// ============================================================
// Place — B1 · "Verify your address" prompt sheet (T3 → T4).
//
// The web mirror of docs/design/place (place-verify.jsx): a sheet over
// the claimed dashboard that frames the Band-D unlock, then lets the
// resident pick HOW to verify. It does not rebuild the verification
// machinery — each method routes into the EXISTING verification pages
// (verify-postcard / verify-landlord / claim-owner) carrying
// `?return=place`, so the success path lands back on /app/place.
//
// Reuses the shared BottomSheet shell (backdrop, Esc, scroll-lock,
// mobile-bottom / desktop-center) and the Place archetype atoms.
// Home-green carries the place; sky carries the CTA. Tokens only.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck,
  X,
  Send,
  Upload,
  MessageCircle,
  BadgeCheck,
  Mailbox,
  Clock,
} from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { IconTile } from '@/components/archetypes/place';

export interface VerifyPromptSheetProps {
  open: boolean;
  onClose: () => void;
  /** The claimed home being verified. */
  homeId: string;
  /** Display address, e.g. "1421 SE Oak St, Portland". */
  address: string;
}

type MethodId = 'mail' | 'landlord' | 'document';

interface Method {
  id: MethodId;
  icon: LucideIcon;
  label: string;
  sub: string;
  /** Routes into an existing verification page, keeping the place return. */
  href: (homeId: string) => string;
}

// Each method maps to a verification page already in the app. We carry
// `return=place` so those pages send the now-verified resident back to
// /app/place (the success reveal) instead of the home dashboard.
const METHODS: Method[] = [
  {
    id: 'mail',
    icon: Send,
    label: 'Mail a code to my address',
    sub: 'We send a postcard with a code. Most common.',
    href: (h) => `/app/homes/${h}/verify-postcard?return=place`,
  },
  {
    id: 'landlord',
    icon: ShieldCheck,
    label: 'Confirm with your landlord',
    sub: 'Your landlord confirms that you live here.',
    href: (h) => `/app/homes/${h}/verify-landlord?return=place`,
  },
  {
    id: 'document',
    icon: Upload,
    label: 'Upload a document',
    sub: 'A utility bill, lease, or bank statement.',
    href: (h) => `/app/homes/${h}/claim-owner/evidence?return=place`,
  },
];

// What verifying adds — the Band-D unlock, framed as a promise (no
// chevrons; these are not tappable destinations).
const BENEFITS: { icon: LucideIcon; label: string; sub: string }[] = [
  { icon: MessageCircle, label: 'Message your verified neighbors', sub: 'Direct messages with the people on your block' },
  { icon: BadgeCheck, label: 'Your verified badge', sub: 'The address-proven check on your profile' },
  { icon: Mailbox, label: 'Your digital mailbox', sub: 'Packages, civic notices, and permits in one place' },
];

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted mb-2 px-0.5">
      {children}
    </div>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`w-[22px] h-[22px] rounded-full shrink-0 box-border bg-app-surface transition-all ${
        selected
          ? 'border-[6.5px] border-primary-600 ring-[3px] ring-primary-600/20'
          : 'border-2 border-app-border-strong'
      }`}
    />
  );
}

export default function VerifyPromptSheet({ open, onClose, homeId, address }: VerifyPromptSheetProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<MethodId>('mail');

  const handleStart = () => {
    const method = METHODS.find((m) => m.id === selected) ?? METHODS[0];
    onClose();
    router.push(method.href(homeId));
  };

  const footer = (
    <button
      type="button"
      onClick={handleStart}
      className="w-full h-[52px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base -tracking-[0.01em] flex items-center justify-center gap-2 shadow-sm transition-colors"
    >
      <ShieldCheck size={17} strokeWidth={2.25} />
      Start verification
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} footer={footer}>
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <IconTile icon={ShieldCheck} tone="home" size={38} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-app-text -tracking-[0.02em] leading-[22px]">
            Verify your address
          </h2>
          <p className="text-[13px] text-app-text-secondary mt-0.5 truncate">{address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-[30px] h-[30px] shrink-0 rounded-full bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover flex items-center justify-center transition-colors"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* what verifying adds */}
      <div className="mb-5">
        <Overline>What this unlocks</Overline>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          {BENEFITS.map((b, i) => (
            <div
              key={b.label}
              className={`flex items-center gap-3 px-3.5 py-3 ${i > 0 ? 'border-t border-app-border-subtle' : ''}`}
            >
              <IconTile icon={b.icon} tone="home" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">{b.label}</div>
                <div className="text-[12.5px] text-app-text-secondary mt-0.5 leading-[17px]">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* method picker */}
      <div className="mb-4">
        <Overline>Choose how</Overline>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          {METHODS.map((m, i) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                aria-pressed={isSelected}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                  i > 0 ? 'border-t border-app-border-subtle' : ''
                } ${isSelected ? 'bg-primary-50' : 'hover:bg-app-hover'}`}
              >
                <IconTile icon={m.icon} tone={isSelected ? 'sky' : 'muted'} size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold text-app-text -tracking-[0.01em]">{m.label}</span>
                  <span className="block text-[12.5px] text-app-text-secondary mt-0.5 leading-[17px]">{m.sub}</span>
                </span>
                <Radio selected={isSelected} />
              </button>
            );
          })}
        </div>
      </div>

      {/* calm note — nothing is taken away while you wait */}
      <div className="flex items-start gap-2 px-0.5">
        <Clock size={15} strokeWidth={2} className="shrink-0 mt-0.5 text-app-text-muted" />
        <span className="text-[12.5px] text-app-text-secondary leading-[18px]">
          This can take a few days. Everything you have now stays available while you wait.
        </span>
      </div>
    </BottomSheet>
  );
}
