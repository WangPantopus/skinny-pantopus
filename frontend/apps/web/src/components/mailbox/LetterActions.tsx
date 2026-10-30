'use client';

// ============================================================
// What you can do with a piece, in mail words (Mail tab drawings, R5-Bill
// board): Pay, Acknowledge, Put on the counter / Done, File in the Vault /
// Take out of the Vault, and Shred (confirmed here on the page; it can be
// brought back for 30 days). Each goes to the server; a failure says what
// happened and leaves the piece as it was.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Check, Inbox, Trash2 } from 'lucide-react';
import type { MailItemV2, VaultFolder } from '@/types/mailbox';
import type { MailActionName } from '@/lib/mailbox-api';
import { useMailAction, useVaultFolders } from '@/lib/mailbox-queries';
import { toast } from '@/components/ui/toast-store';
import { mailLoadMessage } from './mailLoadMessage';

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

const DONE_WORDS: Record<MailActionName, string> = {
  counter: 'Put on the counter',
  done: 'Done. Filed in the Vault',
  file: 'Filed in the Vault',
  unfile: 'Back in Incoming',
  shred: 'Shredded. You can bring it back from Recently shredded for 30 days',
  acknowledge: 'Acknowledged',
};

export default function LetterActions({ piece }: { piece: MailItemV2 }) {
  const action = useMailAction(piece.id);
  const [error, setError] = useState<string | null>(null);
  const [confirmShred, setConfirmShred] = useState(false);
  const [pickFolder, setPickFolder] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const shredButtonRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const folders = useVaultFolders({ enabled: pickFolder });

  // The folders that fit this piece: its own drawer's, and for Home mail its own home's cabinet.
  const fitting = (folders.data ?? []).filter((folder: VaultFolder) => folder.drawer === piece.drawer
    && (folder.drawer !== 'home' || folder.home_id === piece.recipient_home_id));

  useEffect(() => {
    if (!pickFolder) return;
    const onDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickFolder(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPickFolder(false); pickerButtonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickFolder]);

  // The Shred question takes focus while it's asked, and gives it back to Shred if you keep the mail.
  const asked = useRef(false);
  useEffect(() => {
    if (confirmShred) keepButtonRef.current?.focus();
    else if (asked.current) shredButtonRef.current?.focus();
    asked.current = confirmShred;
  }, [confirmShred]);

  const run = (name: MailActionName, folderId?: string) => {
    setError(null);
    action.mutate({ action: name, folderId }, {
      onSuccess: () => {
        asked.current = false;
        setConfirmShred(false);
        setPickFolder(false);
        // The button pressed may be gone now (Done becomes Take out of the Vault): keep focus with the actions.
        groupRef.current?.focus();
        toast.success(DONE_WORDS[name]);
      },
      onError: (err) => setError(`That didn't work: ${mailLoadMessage(err)} Your mail is as it was.`),
    });
  };

  const busy = action.isPending;
  const filed = piece.lifecycle === 'filed';
  const archived = Boolean(piece.archived) && !filed;
  const invoice = piece.invoice;
  const payable = invoice && (invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue');
  const needsAck = piece.ack_required && !piece.acknowledged_at && !piece.certified;

  if (piece.removed) return null;

  const secondary = 'flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border border-app-border bg-app-surface px-2 py-1.5 text-xs font-semibold text-app-text-strong transition hover:bg-app-hover disabled:opacity-60';

  return (
    <div ref={groupRef} tabIndex={-1} className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-app-border bg-app/95 px-4 pb-4 pt-3 backdrop-blur focus:outline-none md:bottom-0" aria-label="What to do with this mail" role="group">
      <div className="mx-auto max-w-2xl space-y-2">
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {invoice?.status === 'paid' ? (
          <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-3 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden /> Paid · {money(invoice.total_cents, invoice.currency)}
          </p>
        ) : payable ? (
          <Link href={`/app/invoice/${invoice.id}`} className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-600 text-base font-semibold text-white hover:bg-primary-700">
            Pay {money(invoice.total_cents, invoice.currency)}
          </Link>
        ) : null}

        {needsAck ? (
          <button type="button" onClick={() => run('acknowledge')} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-600 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            Acknowledge
          </button>
        ) : null}

        {confirmShred ? (
          <div role="alertdialog" aria-label="Shred this mail?" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">Shred this mail?</p>
            <p className="mt-0.5 text-sm text-red-700">
              {piece.recipient_home_id ? 'It goes for everyone in your household. ' : ''}You can bring it back from Recently shredded for 30 days.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => run('shred')} disabled={busy} className="min-h-[44px] flex-1 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {busy ? 'Shredding…' : 'Shred'}
              </button>
              <button ref={keepButtonRef} type="button" onClick={() => setConfirmShred(false)} disabled={busy} className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text">
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className={`grid gap-2 ${filed || archived || piece.card ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {/* Filed or archived mail isn't on the counter; bring it back first. A Christmas card is nothing to do. */}
            {filed || archived || piece.card ? null : piece.on_counter ? (
              <button type="button" onClick={() => run('done')} disabled={busy} className={secondary}>
                <Check className="h-[18px] w-[18px]" aria-hidden />
                <span>Done</span>
              </button>
            ) : (
              <button type="button" onClick={() => run('counter')} disabled={busy} className={secondary}>
                <Inbox className="h-[18px] w-[18px]" aria-hidden />
                <span>Put on the counter</span>
              </button>
            )}

            {filed || archived ? (
              <button type="button" onClick={() => run('unfile')} disabled={busy} className={secondary}>
                <ArchiveRestore className="h-[18px] w-[18px]" aria-hidden />
                <span>{filed ? 'Take out of the Vault' : 'Back to Incoming'}</span>
              </button>
            ) : (
              <div ref={pickerRef} className="relative">
                <button
                  ref={pickerButtonRef}
                  type="button"
                  onClick={() => setPickFolder((open) => !open)}
                  disabled={busy}
                  aria-expanded={pickFolder}
                  aria-controls="vault-folders"
                  className={`${secondary} w-full`}
                >
                  <Archive className="h-[18px] w-[18px]" aria-hidden />
                  <span>File in the Vault</span>
                </button>
                {pickFolder ? (
                  <div id="vault-folders" role="group" aria-label="Vault folders" className="absolute bottom-full left-1/2 z-20 mb-2 max-h-64 w-56 -translate-x-1/2 overflow-y-auto rounded-xl border border-app-border bg-app-surface py-1 shadow-lg">
                    {folders.isPending ? (
                      <p className="px-3 py-2 text-sm text-app-text-secondary">Opening your Vault…</p>
                    ) : folders.isError ? (
                      <div className="px-3 py-2">
                        <p className="text-sm text-app-text-secondary">Couldn&apos;t open your Vault. {mailLoadMessage(folders.error)}</p>
                        <button type="button" onClick={() => { void folders.refetch(); }} className="mt-1 text-sm font-semibold text-primary-600">Try again</button>
                      </div>
                    ) : (
                      <>
                        {fitting.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => run('file', folder.id)}
                            aria-label={folder.item_count > 0 ? `${folder.label}, ${folder.item_count} ${folder.item_count === 1 ? 'piece' : 'pieces'}` : folder.label}
                            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm text-app-text hover:bg-app-hover"
                          >
                            <span className="truncate">{folder.label}</span>
                            {folder.item_count > 0 ? <span aria-hidden="true" className="ml-auto text-xs text-app-text-muted">{folder.item_count}</span> : null}
                          </button>
                        ))}
                        <button type="button" onClick={() => run('file')} className="flex min-h-[44px] w-full items-center px-3 text-left text-sm text-app-text-secondary hover:bg-app-hover">
                          File without a folder
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <button ref={shredButtonRef} type="button" onClick={() => setConfirmShred(true)} disabled={busy} className={secondary}>
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
              <span>Shred</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
