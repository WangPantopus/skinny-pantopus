'use client';

// Pinboards (Pulse, reinvented, phase 3; coord/CONTRACT.md §8i): add your piece to a shared prompt, such as "Best fall
// tree on your walk". A pinboard is its first photo Moment and the pieces people add while it's open (7 days, one piece
// a person); it stays. Each piece's own audience decides who sees it.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@pantopus/api/client';
import type { Moment } from '@pantopus/api/endpoints/moments';
import { MomentFace } from '@/components/moments/MomentFace';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import './pinboard.css';

type Person = Moment['author'];

export interface PinboardInfo {
  start_id: string;
  prompt: string;
  pieces: number;
  open: boolean;
  is_start: boolean;
}
export function pinboardOf(m: Moment | null | undefined): PinboardInfo | null {
  const p = (m as (Moment & { pinboard?: PinboardInfo | null }) | null | undefined)?.pinboard;
  return p && typeof p.start_id === 'string' ? p : null;
}

interface Board {
  start_id: string;
  prompt: string;
  started_by: Person;
  started_at: string;
  open_until: string;
  open: boolean;
  pieces: { id: string; author: Person; at: string; thumb_url: string | null; media_url: string | null }[];
  can_add: boolean;
}

/**
 * Over Pulse: the prompt, its pieces newest first, and "Add your piece" while it's open. A tap on a piece opens it in the
 * viewer, with the board's other pieces next to it; closing the viewer comes back to the board (LEAD-8, 10:37).
 */
export default function PinboardView({
  id,
  onClose,
  onAdd,
  onPiece,
}: {
  id: string;
  onClose(): void;
  onAdd(start: { id: string; prompt: string }): void;
  onPiece?(piece: string, pieces: string[]): void;
}) {
  const reread = useRereadSwitch();
  const board = useQuery({
    queryKey: ['reinvented', 'pinboard', id],
    queryFn: ({ signal }) => get<{ pinboard: Board }>(`/api/reinvented/pinboards/${encodeURIComponent(id)}`, {}, { signal }),
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  useEffect(() => {
    if (board.error && isSwitchedOff(board.error)) void reread();
  }, [board.error, reread]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const b = board.data?.pinboard;
  return (
    <div className="pb-scrim" data-covers-shell="" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="pb-box" role="dialog" aria-modal="true" aria-label={b ? `Pinboard: ${b.prompt}` : 'Pinboard'} tabIndex={-1}>
        <header className="pb-head">
          <div>
            <p className="pb-kicker">Pinboard</p>
            <h2>{b?.prompt || '…'}</h2>
            {b && (
              <p className="pb-sub">
                Started by {b.started_by?.name || 'someone'} · {b.pieces.length} {b.pieces.length === 1 ? 'piece' : 'pieces'} ·{' '}
                {b.open ? `open until ${new Date(b.open_until).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'closed'}
              </p>
            )}
          </div>
          <button type="button" className="pb-close" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        {board.isPending ? (
          <p className="pb-note">Loading…</p>
        ) : board.isError ? (
          <p className="pb-note">This pinboard couldn’t load.</p>
        ) : b ? (
          <>
            <div className="pb-grid">
              {b.pieces.map((p) => (
                <figure key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a signed picture of the piece */}
                  {p.media_url || p.thumb_url ? <img src={p.media_url || p.thumb_url || ''} alt={`${p.author?.name || 'Someone'}’s piece`} loading="lazy" /> : null}
                  <figcaption>
                    <MomentFace author={p.author} /> {p.author?.name}
                  </figcaption>
                  {onPiece && (
                    <button
                      type="button"
                      className="pb-open"
                      aria-label={`Open ${p.author?.name || 'someone'}’s piece`}
                      onClick={() =>
                        onPiece(
                          p.id,
                          b.pieces.map((x) => x.id),
                        )
                      }
                    />
                  )}
                </figure>
              ))}
            </div>
            {b.can_add ? (
              <button type="button" className="pb-add" onClick={() => onAdd({ id: b.start_id, prompt: b.prompt })}>
                Add your piece
              </button>
            ) : (
              <p className="pb-note">{b.open ? 'You’ve added your piece.' : 'This pinboard has closed.'}</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
