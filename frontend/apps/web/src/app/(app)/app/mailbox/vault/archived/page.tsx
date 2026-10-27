'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useDrawerTab } from '@/lib/mailbox-queries';
import { DRAWER_LABELS, isMailboxDrawer, mailboxHref, type MailboxDrawer } from '@/components/mailbox/MailboxHeader';
import PieceList from '@/components/mailbox/PieceList';

/**
 * Archived mail of the drawer chosen in the Mailbox's chips (`?drawer=`), so
 * nothing archived just vanishes. Opening a piece offers Back to Incoming.
 */
export default function ArchivedMailPage() {
  const router = useRouter();
  const drawerParam = useSearchParams().get('drawer');
  const drawer: Exclude<MailboxDrawer, 'earn'> = isMailboxDrawer(drawerParam) && drawerParam !== 'earn' ? drawerParam : 'personal';
  const pieces = useDrawerTab(drawer, 'archived');

  return (
    <div className="mx-auto w-full max-w-2xl md:h-full md:overflow-y-auto">
      <div className="flex items-center px-2 py-1.5 md:hidden">
        <button
          type="button"
          onClick={() => router.push(mailboxHref('vault', drawer))}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary hover:bg-app-hover hover:text-app-text"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Vault
        </button>
      </div>
      <div className="px-4 pt-3">
        <h1 className="text-xl font-semibold text-app-text">Archived<span className="sr-only"> · {DRAWER_LABELS[drawer]}</span></h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">Mail you archived stays here. Open a piece to bring it back to Incoming.</p>
      </div>
      <div className="px-3 pb-8 pt-4">
        <PieceList
          pieces={pieces}
          label="Archived mail"
          failTitle="Couldn't open Archived"
          empty={<p className="px-2 pt-6 text-center text-sm text-app-text-secondary">Nothing archived.</p>}
          onOpen={(item) => router.push(`/app/mailbox/${item.drawer}/${item.id}`)}
        />
      </div>
    </div>
  );
}
