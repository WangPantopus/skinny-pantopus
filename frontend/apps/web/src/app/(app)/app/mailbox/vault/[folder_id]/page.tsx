'use client';

import { useParams, useRouter } from 'next/navigation';
import type { VaultFolder } from '@/types/mailbox';
import { useDrawerTab, useMailboxDrawers, useVaultFolders } from '@/lib/mailbox-queries';
import { isMailboxDrawer, mailboxHref } from '@/components/mailbox/MailboxHeader';
import PieceList from '@/components/mailbox/PieceList';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import ErrorState from '@/components/ui/ErrorState';

/**
 * One Vault folder (Mail tab drawings, R10-Vault): what's filed in it, drawn
 * as paper, each opening as its letter. A Home folder belongs to that Home's
 * cabinet and everyone who reads the Home's mail sees the same pieces.
 */
export default function VaultFolderPage() {
  const router = useRouter();
  const { folder_id: folderId } = useParams<{ folder_id: string }>();
  const folders = useVaultFolders();
  const { data: drawers } = useMailboxDrawers();
  const folder = folders.data?.find((f: VaultFolder) => f.id === folderId);
  const drawer = folder && isMailboxDrawer(folder.drawer) && folder.drawer !== 'earn' ? folder.drawer : null;
  const pieces = useDrawerTab(drawer ?? 'personal', 'vault', { folderId }, { enabled: !!drawer });

  const vaultHref = mailboxHref('vault', drawer ?? 'personal');
  const homes = drawers?.homes ?? [];
  const home = folder?.home_id ? homes.find((h) => h.home_id === folder.home_id) : undefined;
  const count = folder?.item_count ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl md:h-full md:overflow-y-auto">
      {/* Phones: back to the Vault (wider screens keep the Mailbox's tabs above) */}
      <div className="flex items-center px-2 py-1.5 md:hidden">
        <button
          type="button"
          onClick={() => router.push(vaultHref)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary hover:bg-app-hover hover:text-app-text"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Vault
        </button>
      </div>

      {folders.isPending ? (
        <div className="px-4 pt-3" role="status" aria-label="Opening the folder">
          <div className="h-[88px] w-full max-w-[280px] rounded-[10px] bg-app-surface-sunken animate-pulse" />
        </div>
      ) : folders.isError ? (
        <ErrorState title="Couldn't open this folder" message={mailLoadMessage(folders.error)} onRetry={() => { void folders.refetch(); }} />
      ) : !folder || !drawer ? (
        <div role="alert" className="px-6 py-16 text-center">
          <h1 className="text-base font-semibold text-app-text">This folder isn&apos;t here</h1>
          <p className="mt-1 text-sm text-app-text-secondary">It may have been removed, or it belongs to a home whose mail you can&apos;t open.</p>
          <button type="button" onClick={() => router.push('/app/mailbox/vault')} className="mt-4 min-h-[44px] rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
            Back to the Vault
          </button>
        </div>
      ) : (
        <>
          {/* The folder, as a manila folder with its tab */}
          <div className="px-4 pt-3">
            <div aria-hidden="true" className="h-3 w-[46%] max-w-[130px] rounded-t-[7px] bg-[#e6cf92]" />
            <div className="rounded-b-[10px] rounded-tr-[10px] bg-[#f3e3b5] px-4 py-3 text-[#111827] shadow-sm">
              <h1 className="text-lg font-semibold leading-6">{folder.label}</h1>
              <p className="text-sm text-[#5c4410]">
                {count === 0 ? 'Nothing filed yet' : `${count} ${count === 1 ? 'piece' : 'pieces'}`}
                {home ? ` · ${home.name || home.address_line}` : ''}
              </p>
            </div>
          </div>

          <div className="px-3 pb-8 pt-4">
            <PieceList
              pieces={pieces}
              label={`Filed in ${folder.label}`}
              failTitle={`Couldn't open ${folder.label}`}
              empty={(
                <p className="px-2 pt-6 text-center text-sm text-app-text-secondary">
                  Nothing filed here yet. Open a piece and choose File in the Vault to keep it in this folder.
                </p>
              )}
              onOpen={(item) => router.push(`/app/mailbox/${item.drawer}/${item.id}`)}
            />
          </div>
        </>
      )}
    </div>
  );
}
