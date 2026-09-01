// ============================================================
// DetailArchetype — unified detail shell (spec A10, web).
//
//   · Header slot (Profile / HomeHero / PostAuthor / custom)
//   · Body slot
//   · Optional right rail (metadata, related actions, media)
//   · Optional sticky footer for primary CTA
//
// Multi-column adaptation: body on left, rail on right when
// `rail` is provided. Collapses to single column under `lg:`.
//
// Note: the AppShell already provides the top nav + breadcrumbs,
// so this archetype renders only the page body. Use an
// `ArchetypePageHeader` ABOVE this if you need a title row.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { StickyFooter, type StickyFooterProps } from '../primitives';

export interface DetailArchetypeAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export interface DetailArchetypeProps {
  /** Hero / header slot (e.g. ProfileHeader, HomeHeroHeader). */
  header?: ReactNode;
  /** Top-right trailing actions. Default: Share + Overflow. */
  onShareClick?: () => void;
  onOverflowClick?: () => void;
  extraActions?: DetailArchetypeAction[];
  /** Body column (required). */
  body: ReactNode;
  /** Optional right rail — metadata, related, etc. */
  rail?: ReactNode;
  /** Optional sticky bottom CTA. */
  stickyFooter?: StickyFooterProps;
  /** 4px top accent strip (Mailbox Item Detail uses this). */
  accentColor?: string;
  className?: string;
}

export default function DetailArchetype({
  header,
  onShareClick,
  onOverflowClick,
  extraActions,
  body,
  rail,
  stickyFooter,
  accentColor,
  className = '',
}: DetailArchetypeProps) {
  return (
    <div className={className}>
      {accentColor ? (
        <div
          className="h-1 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
      {(onShareClick || onOverflowClick || extraActions?.length) ? (
        <div className="flex items-center justify-end gap-1 mb-2">
          {extraActions?.map((a) => (
            <IconBtn key={a.label} icon={a.icon} label={a.label} onClick={a.onClick} />
          ))}
          {onShareClick ? <IconBtn icon={Share2} label="Share" onClick={onShareClick} /> : null}
          {onOverflowClick ? <IconBtn icon={MoreHorizontal} label="More" onClick={onOverflowClick} /> : null}
        </div>
      ) : null}

      {header ? <div className="mb-6">{header}</div> : null}

      {rail ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="min-w-0">{body}</div>
          <aside className="lg:sticky lg:top-4 lg:self-start">{rail}</aside>
        </div>
      ) : (
        <div className="min-w-0">{body}</div>
      )}

      {stickyFooter ? <StickyFooter {...stickyFooter} /> : null}
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 rounded-md flex items-center justify-center text-app-text hover:bg-app-hover transition"
    >
      <Icon size={18} />
    </button>
  );
}
