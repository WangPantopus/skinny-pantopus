// ============================================================
// Place — SWITCH PLACE sheet (web mirror of place-switcher.jsx, C2).
//
// A bottom sheet for residents who hold more than one place. Each
// place is a row: address + Verified/Claimed status + chevron. Picking
// a place switches the dashboard's active home; "Add a place" routes to
// claim/verify another address. Verified = green check chip, Claimed =
// amber home chip — the same trust read the avatar badge carries.
//
// Mobile-first bottom sheet; a centered dialog on a comfortable desktop
// width. ESC / backdrop close, body-scroll lock — the shared sheet
// behavior, in the Place token language (no left-borders, color in the
// tiles and chips).
// ============================================================

'use client';

import { useEffect } from 'react';
import { House, Plus, ShieldCheck, Home as HomeIcon, X } from 'lucide-react';
import Chip from '../primitives/Chip';
import { Chevron } from './primitives';

export type PlaceSwitcherStatus = 'verified' | 'claimed';

export interface PlaceSwitcherHome {
  id: string;
  /** Street line, e.g. "1421 SE Oak St". */
  line1: string;
  /** City line, e.g. "Portland, OR". */
  city: string;
  status: PlaceSwitcherStatus;
}

export interface PlaceSwitcherProps {
  open: boolean;
  onClose: () => void;
  homes: PlaceSwitcherHome[];
  /** The home the dashboard is currently showing. */
  activeId: string | null;
  /** Switch the active place — the dashboard re-queries for it. */
  onPick: (id: string) => void;
  /** Claim or verify another address. */
  onAddPlace: () => void;
}

// ── A status marker — Verified (green) or Claimed (amber) ────
function StatusChip({ status }: { status: PlaceSwitcherStatus }) {
  return status === 'verified' ? (
    <Chip label="Verified" variant="success" icon={ShieldCheck} />
  ) : (
    <Chip label="Claimed" variant="warning" icon={HomeIcon} />
  );
}

// ── One place row inside the sheet ──────────────────────────
function PlaceRow({
  home,
  active,
  onClick,
}: {
  home: PlaceSwitcherHome;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex items-center gap-3 w-full text-left p-3.5 rounded-2xl transition-colors ${
        active ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : 'hover:bg-app-hover'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-xl ${
          active ? 'bg-primary-100 text-primary-600' : 'bg-app-surface-sunken text-app-text-secondary'
        }`}
      >
        <House size={21} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em] truncate">{home.line1}</div>
        <div
          className={`text-[13px] mt-0.5 truncate ${
            active ? 'text-primary-700 font-semibold' : 'text-app-text-muted font-medium'
          }`}
        >
          {active ? 'Current place' : home.city}
        </div>
      </div>
      <StatusChip status={home.status} />
      <Chevron />
    </button>
  );
}

export default function PlaceSwitcher({ open, onClose, homes, activeId, onPick, onAddPlace }: PlaceSwitcherProps) {
  // ESC to close + lock body scroll while open (the shared sheet behavior).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Switch place"
    >
      {/* scrim */}
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} />

      {/* sheet */}
      <div
        className="relative w-full sm:max-w-[440px] bg-app-surface rounded-t-[22px] sm:rounded-[22px] shadow-2xl pb-8 sm:pb-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grabber (mobile feel) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="w-9 h-[5px] rounded-full bg-app-border" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-[18px] pt-3 pb-2">
          <h2 className="text-[19px] font-bold -tracking-[0.015em] text-app-text">Switch place</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-full bg-app-surface-sunken text-app-text-secondary hover:text-app-text transition-colors"
          >
            <X size={17} strokeWidth={2.25} />
          </button>
        </div>

        {/* places + add */}
        <div className="px-3 pt-0.5">
          <div className="flex flex-col gap-0.5">
            {homes.map((h) => (
              <PlaceRow key={h.id} home={h} active={h.id === activeId} onClick={() => onPick(h.id)} />
            ))}
          </div>

          <div className="h-px bg-app-border-subtle mx-3.5 my-2" />

          <button
            type="button"
            onClick={onAddPlace}
            className="flex items-center gap-3 w-full text-left p-3.5 rounded-2xl hover:bg-app-hover transition-colors"
          >
            <span className="inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-xl bg-primary-100 text-primary-600">
              <Plus size={21} strokeWidth={2.25} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15.5px] font-semibold text-primary-600 -tracking-[0.01em]">Add a place</div>
              <div className="text-[13px] text-app-text-muted font-medium mt-0.5">Claim or verify another address</div>
            </div>
            <Chevron />
          </button>
        </div>
      </div>
    </div>
  );
}
