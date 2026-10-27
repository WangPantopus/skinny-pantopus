'use client';

import type { MailItemV2 } from '@/types/mailbox';
import { useBundleItems } from '@/lib/mailbox-queries';
import MailRow from './MailRow';
import { mailLoadMessage } from './mailLoadMessage';
import type { Addressee } from './useMailAddressee';

// The pieces inside an opened bundle, each opening as its own letter: under the
// bundle in a drawer list, and on the bundle's own page.
export default function BundlePieces({
  bundleId,
  addressee,
  timeZone,
  onOpen,
}: {
  bundleId: string;
  addressee: (item: MailItemV2) => Addressee;
  timeZone?: string;
  onOpen: (item: MailItemV2) => void;
}) {
  const { data: pieces, isPending, isError, error, refetch } = useBundleItems(bundleId);
  if (isPending) {
    return (
      <div className="ml-4 mt-3 border-l-2 border-app-border pl-3" role="status" aria-label="Opening the bundle">
        <div className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="ml-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
        <p>Couldn&apos;t open this bundle. {mailLoadMessage(error)}</p>
        <button type="button" onClick={() => { void refetch(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
      </div>
    );
  }
  if (!pieces?.length) {
    return <p className="ml-4 mt-3 border-l-2 border-app-border pl-3 text-sm text-app-text-secondary">This bundle is empty. Its pieces may have been filed or shredded.</p>;
  }
  return (
    <div role="list" aria-label="Pieces in this bundle" className="ml-4 mt-3 space-y-4 border-l-2 border-app-border pl-3">
      {pieces.map((piece) => {
        const to = addressee(piece);
        return (
          <div role="listitem" key={piece.id}>
            <MailRow item={piece} recipientName={to.name} recipientLine={to.line} timeZone={timeZone} onOpen={() => onOpen(piece)} />
          </div>
        );
      })}
    </div>
  );
}
