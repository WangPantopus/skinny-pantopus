'use client';

// ============================================================
// A card in your Mailbox on the table (launch key card_table): the table, and
// the things you can do with the card from its ⋯ menu: who sent it and its
// trail, the Vault, Shred, Open it again, Report and Block. Each comes back to
// the table; Shred goes back to the Mailbox, as the card has gone. Share opens
// its sheet over the table.
// ============================================================

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { MailItemV2, VaultFolder } from '@/types/mailbox';
import type { MailActionName } from '@/lib/mailbox-api';
import { useCardArrivals, useHolidayCards, useMailAction, useVaultFolders } from '@/lib/mailbox-queries';
import { confirmStore } from '@/components/ui/confirm-store';
import ReportModal from '@/components/ui/ReportModal';
import { toast } from '@/components/ui/toast-store';
import SenderSheet from '../SenderSheet';
import { mailLoadMessage } from '../mailLoadMessage';
import CardShareSheet from './CardShareSheet';
import CardTable, { type TableMenuItem } from './CardTable';
import { firstNameOf } from './cardArt';
import { sendOneBackPath } from './sendOneBack';

const DONE_WORDS: Partial<Record<MailActionName, string>> = {
  file: 'Filed in the Vault',
  unfile: 'Back in Incoming',
  shred: 'Shredded. You can bring it back from Recently shredded for 30 days',
};

/** Which folder it goes in; the same choices as under a letter. */
function VaultSheet({ piece, onFile, onClose }: { piece: MailItemV2; onFile: (folderId?: string) => void; onClose: () => void }) {
  const folders = useVaultFolders({ enabled: true });
  const fitting = (folders.data ?? []).filter((folder: VaultFolder) => folder.drawer === piece.drawer
    && (folder.drawer !== 'home' || folder.home_id === piece.recipient_home_id));
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label="File in the Vault" className="relative max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-app-surface px-4 pb-6 pt-3 shadow-2xl md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-app-text">File in the Vault</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-app-text-secondary hover:bg-app-hover">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {folders.isPending ? <p className="px-1 py-2 text-sm text-app-text-secondary">Opening your Vault…</p> : null}
        {folders.isError ? (
          <div className="px-1 py-2">
            <p className="text-sm text-app-text-secondary">Couldn&apos;t open your Vault. {mailLoadMessage(folders.error)}</p>
            <button type="button" onClick={() => { void folders.refetch(); }} className="mt-1 min-h-[44px] text-sm font-semibold text-primary-600">Try again</button>
          </div>
        ) : null}
        {fitting.map((folder) => (
          <button key={folder.id} type="button" onClick={() => onFile(folder.id)} className="flex min-h-[44px] w-full items-center rounded-lg px-2 text-left text-sm text-app-text hover:bg-app-hover">
            <span className="truncate">{folder.label}</span>
          </button>
        ))}
        {folders.isPending || folders.isError ? null : (
          <button type="button" onClick={() => onFile()} className="flex min-h-[44px] w-full items-center rounded-lg px-2 text-left text-sm text-app-text hover:bg-app-hover">File without a folder</button>
        )}
      </section>
    </div>,
    document.body,
  );
}

export default function CardTablePiece({
  piece,
  recipientName,
  recipientLine,
  firstOpen,
  onClose,
}: {
  piece: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  /** It hadn't been opened before this visit: it plays from the envelope. */
  firstOpen: boolean;
  /** Back to the Mailbox. */
  onClose: () => void;
}) {
  const card = piece.card!;
  const from = piece.sender_display || 'Someone';
  const action = useMailAction(piece.id);
  const [replay, setReplay] = useState(0);
  const [sheet, setSheet] = useState<'sender' | 'vault' | 'report' | 'share' | null>(null);
  const [asking, setAsking] = useState(false);
  const filed = piece.lifecycle === 'filed';
  const archived = Boolean(piece.archived) && !filed;
  const router = useRouter();
  const [blockedNow, setBlockedNow] = useState(false);

  // Send one back (design plan Part 3): only while cards can be sent, never from a sealed card, and only when the
  // server would take a card to them (its person check answers no when either has blocked the other or their account
  // is gone). A new card to them, counted like any other.
  const season = useHolidayCards();
  const senderId = !card.sealed && !blockedNow && season.data?.open ? piece.sender_user_id ?? null : null;
  const theirs = useCardArrivals(senderId);
  const sendBack: TableMenuItem | null = senderId && theirs.isSuccess
    ? { label: `Send ${firstNameOf(from)} a card`, onSelect: () => router.push(sendOneBackPath({ userId: senderId, name: from })) }
    : null;

  const run = (name: MailActionName, folderId?: string, then?: () => void) => {
    action.mutate({ action: name, folderId }, {
      onSuccess: () => {
        setSheet(null);
        const words = DONE_WORDS[name];
        if (words) toast.success(words);
        then?.();
      },
      onError: (err) => toast.error(`That didn't work: ${mailLoadMessage(err)} Your mail is as it was.`),
    });
  };

  const shred = async () => {
    setAsking(true);
    const yes = await confirmStore.open({
      title: 'Shred this mail?',
      description: `${piece.recipient_home_id ? 'It goes for everyone in your household. ' : ''}You can bring it back from Recently shredded for 30 days.`,
      confirmLabel: 'Shred',
      cancelLabel: 'Keep it',
      variant: 'destructive',
    });
    setAsking(false);
    if (yes) run('shred', undefined, onClose);
  };

  const block = async () => {
    if (!piece.sender_user_id) return;
    setAsking(true);
    const yes = await confirmStore.open({
      title: `Block ${from}?`,
      description: `You won't be able to message each other or see each other's posts, and they can't send you another card. You can unblock them in Settings.`,
      confirmLabel: 'Block',
      variant: 'destructive',
    });
    setAsking(false);
    if (!yes) return;
    try {
      await api.blocks.blockUser(piece.sender_user_id);
      setBlockedNow(true);
      toast.success(`${from} is blocked`);
    } catch (err) {
      toast.error(err instanceof Error ? `Couldn't block them: ${err.message}` : 'Couldn\'t block them. Check your connection and try again.');
    }
  };

  const menu = useMemo<TableMenuItem[]>(() => {
    const items: TableMenuItem[] = [{ label: 'Who sent it and its trail', onSelect: () => setSheet('sender') }];
    if (filed) items.push({ label: 'Take out of the Vault', onSelect: () => run('unfile') });
    else if (archived) items.push({ label: 'Back to Incoming', onSelect: () => run('unfile') });
    else items.push({ label: 'File in the Vault', onSelect: () => setSheet('vault') });
    items.push({ label: 'Shred', onSelect: () => { void shred(); } });
    if (!card.sealed) items.push({ label: 'Open it again', onSelect: () => setReplay((n) => n + 1) });
    if (sendBack) items.push(sendBack);
    if (piece.sender_user_id) {
      items.push({ label: 'Report', onSelect: () => setSheet('report') });
      items.push({ label: 'Block', onSelect: () => { void block(); } });
    }
    return items;
    // The menu follows the piece; its handlers read the latest piece through this same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filed, archived, card.sealed, piece.sender_user_id, piece.recipient_home_id, from, sendBack?.label]);

  return (
    <CardTable
      card={card}
      // Its photo opens through the reader's own route (memories contract section 4).
      photoFrom={(fileId) => ({ piece: piece.id, fileId })}
      note={piece.content || ''}
      fromName={from}
      toName={recipientName}
      mailedOn={piece.postmark?.date || piece.created_at}
      startOnTable={!firstOpen}
      replay={replay}
      paused={sheet !== null || asking}
      menu={menu}
      sendBack={sendBack}
      onShare={() => setSheet('share')}
      onClose={onClose}
      overlay={(
        <>
          {sheet === 'share' ? (
            <CardShareSheet
              details={{ card, note: piece.content || '', fromName: from, mailedOn: piece.postmark?.date || piece.created_at, signature: card.signature ?? null }}
              slug={card.slug}
              onClose={() => setSheet(null)}
            />
          ) : null}
          {sheet === 'sender' ? <SenderSheet piece={piece} recipientName={recipientName} recipientLine={recipientLine} onClose={() => setSheet(null)} /> : null}
          {sheet === 'vault' ? <VaultSheet piece={piece} onFile={(folderId) => run('file', folderId)} onClose={() => setSheet(null)} /> : null}
          {sheet === 'report' && piece.sender_user_id ? (
            <ReportModal
              open
              entityType="user"
              layerClassName="z-[1000]"
              onClose={() => setSheet(null)}
              onSubmit={async (reason, details) => {
                await api.users.reportUser(piece.sender_user_id as string, reason, details);
                toast.success('Report submitted');
                setSheet(null);
              }}
            />
          ) : null}
        </>
      )}
    />
  );
}
