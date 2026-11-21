'use client';

// ============================================================
// "Where does it start?" (travelling card, Part 2; founder's D4): asked once, the first time someone with no town
// starts or passes on a travelling card. A field ("Your town or ZIP code"), the matching towns from the Census lists the
// server carries, and "Use Vancouver, WA" when the server can suggest one. The town is kept in their profile's town
// fields (PUT /api/mailbox/cards/town). Never their address or point.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useCardTowns, useSaveCardTown } from '@/lib/mailbox-queries';
import { mailLoadMessage } from '../mailLoadMessage';
import styles from './CardTravel.module.css';

export default function TownSheet({ onDone, onClose }: {
  /** Their town was kept: "Vancouver, WA". */
  onDone: (town: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const towns = useCardTowns(typed);
  const suggestion = useCardTowns('');
  const save = useSaveCardTown();
  const field = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Asks the server a moment after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => setTyped(q), 180);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => { field.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !save.isPending) { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, save.isPending]);

  const choose = (id: string) => {
    setError(null);
    save.mutate(id, {
      onSuccess: ({ town }) => onDone(town),
      onError: (err) => setError(mailLoadMessage(err)),
    });
  };

  const found = typed.trim() ? towns.data?.towns ?? [] : [];
  const suggested = suggestion.data?.suggested ?? null;
  return createPortal(
    <div className={styles.backdrop} onClick={(event) => { if (event.target === event.currentTarget && !save.isPending) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={`${listId}-title`} data-testid="cardTownSheet">
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose} disabled={save.isPending}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h2 id={`${listId}-title`} className={styles.title}>Where does it start?</h2>
        <label htmlFor={`${listId}-q`} className={styles.label}>Your town or ZIP code</label>
        <input
          id={`${listId}-q`}
          ref={field}
          className={styles.field}
          value={q}
          onChange={(event) => setQ(event.target.value.slice(0, 64))}
          autoComplete="address-level2"
          inputMode="text"
          aria-controls={`${listId}-list`}
          data-testid="cardTownField"
        />
        <ul id={`${listId}-list`} className={styles.list} aria-live="polite">
          {found.map((t) => (
            <li key={t.id}>
              <button type="button" className={styles.row} disabled={save.isPending} onClick={() => choose(t.id)} data-testid="cardTownOption">
                <b>{t.label}</b>{t.zip ? <span>{t.zip}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {suggested ? (
          <button type="button" className={styles.use} disabled={save.isPending} onClick={() => choose(suggested.id)} data-testid="cardTownUse">
            {save.isPending && save.variables === suggested.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Use {suggested.label}
          </button>
        ) : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
