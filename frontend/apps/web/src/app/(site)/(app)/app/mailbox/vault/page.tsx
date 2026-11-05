'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ChevronRight, Plus, Search, X } from 'lucide-react';
import type { MailItemV2, VaultFolder } from '@/types/mailbox';
import { useCreateVaultFolder, useDrawerTab, useMailboxDrawers, useMailSearch, useVaultFolders } from '@/lib/mailbox-queries';
import { VaultFolderCard } from '@/components/mailbox';
import { DRAWER_LABELS, isMailboxDrawer, type MailboxDrawer } from '@/components/mailbox/MailboxHeader';
import { isMailRead } from '@/components/mailbox/MailItemCard';
import MailRow from '@/components/mailbox/MailRow';
import { pieceKind } from '@/components/mailbox/MailPiece';
import { cardPicture } from '@/components/mailbox/cards/cardArt';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import useMailAddressee from '@/components/mailbox/useMailAddressee';
import ErrorState from '@/components/ui/ErrorState';
import { toast } from '@/components/ui/toast-store';

type Drawer = Exclude<MailboxDrawer, 'earn'>;

// The paper colour of each kind's small swatch in the filed list.
const PAPER: Record<string, string> = { letter: '#fbf6ea', postcard: '#fffdf7', parcel: '#d9b98a', booklet: '#f1f5f9' };

// A Christmas card's swatch is its picture once it's been opened, and its red envelope before that or while sealed.
function swatchStyle(item: MailItemV2): CSSProperties {
  if (!item.card) return { background: PAPER[pieceKind(item)] ?? '#ffffff' };
  if (item.card.sealed || !isMailRead(item)) return { background: '#9f2f28' };
  return { backgroundImage: `url(${cardPicture(item.card.design, 'thumb')})`, backgroundSize: 'cover', backgroundPosition: 'center 28%' };
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * The Vault of the drawer chosen in the Mailbox's chips (Mail tab drawings,
 * R10-Vault): search, the server's folders as manila folders (a Home's
 * cabinet is shared by everyone who reads its mail), Archived, and the mail
 * filed here, newest first.
 */
export default function VaultPage() {
  const router = useRouter();
  const drawerParam = useSearchParams().get('drawer');
  const drawer: Drawer = isMailboxDrawer(drawerParam) && drawerParam !== 'earn' ? drawerParam : 'personal';
  const folders = useVaultFolders();
  const { data: drawers } = useMailboxDrawers();
  const filed = useDrawerTab(drawer, 'vault');
  const { addressee, timeZone } = useMailAddressee();

  // Search: the server's search of all your mail, filed and archived too.
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [text]);
  const search = useMailSearch(query);
  const results = search.data?.pages.flatMap((page) => page.items) ?? [];
  const searching = query.length > 0;

  // This drawer's folders; Home folders by the Home they belong to.
  const homes = drawers?.homes ?? [];
  const mine = useMemo(() => (folders.data ?? [])
    .filter((folder: VaultFolder) => folder.drawer === drawer)
    .sort((a, b) => a.sort_order - b.sort_order), [folders.data, drawer]);
  const cabinets = useMemo(() => {
    if (drawer !== 'home') return [{ key: drawer, title: null as string | null, folders: mine }];
    const ids = [...new Set(mine.map((folder) => folder.home_id ?? ''))];
    return ids.map((id) => {
      const home = homes.find((h) => h.home_id === id);
      return { key: id, title: ids.length > 1 ? (home?.name || home?.address_line || 'Your home') : null, folders: mine.filter((f) => (f.home_id ?? '') === id) };
    });
  }, [drawer, mine, homes]);
  const folderName = (id: string | null | undefined) => (folders.data ?? []).find((f: VaultFolder) => f.id === id)?.label;

  const openFolder = (folder: VaultFolder) => router.push(drawer === 'personal' ? `/app/mailbox/vault/${folder.id}` : `/app/mailbox/vault/${folder.id}?drawer=${drawer}`);
  const openPiece = (item: MailItemV2) => router.push(`/app/mailbox/${item.drawer}/${item.id}`);
  const filedItems = filed.data?.pages.flatMap((page) => page.items) ?? [];

  // ── A new folder ──────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const readable = homes.filter((h) => h.mail_access !== 'needs_proof');
  const [homeId, setHomeId] = useState('');
  const createFolder = useCreateVaultFolder();
  const [createError, setCreateError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (creating) nameRef.current?.focus(); }, [creating]);
  const create = () => {
    const name = label.trim();
    if (!name) { setCreateError('Give the folder a name.'); return; }
    if (drawer === 'home' && readable.length > 1 && !homeId) { setCreateError('Choose which home this folder is for.'); return; }
    setCreateError(null);
    createFolder.mutate(
      { label: name, icon: '📁', color: '#e6cf92', drawer, ...(drawer === 'home' && (homeId || readable[0]?.home_id) ? { home_id: homeId || readable[0].home_id } : {}) },
      {
        onSuccess: () => { setCreating(false); setLabel(''); setHomeId(''); toast.success(`Made the folder ${name}`); },
        onError: (err) => setCreateError(`Couldn't make the folder. ${mailLoadMessage(err)}`),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl md:h-full md:overflow-y-auto">
      <h2 className="sr-only">Vault · {DRAWER_LABELS[drawer]}</h2>

      {/* Search */}
      <form role="search" onSubmit={(event) => { event.preventDefault(); setQuery(text.trim()); }} className="relative px-4 pt-3.5">
        <label htmlFor="vault-search" className="sr-only">Search all your mail, filed too</label>
        <Search className="pointer-events-none absolute left-7 top-[calc(50%+7px)] h-4 w-4 -translate-y-1/2 text-app-text-muted" aria-hidden />
        <input
          id="vault-search"
          type="search"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search all your mail, filed too"
          autoComplete="off"
          className="w-full rounded-xl border border-app-border bg-app-surface py-2.5 pl-9 pr-10 text-sm text-app-text placeholder:text-app-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {text ? (
          <button type="button" onClick={() => { setText(''); setQuery(''); }} aria-label="Clear search" className="absolute right-5 top-[calc(50%+7px)] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-app-text-muted hover:text-app-text">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </form>

      {searching ? (
        <div className="px-3 pb-8 pt-3" aria-live="polite">
          {query.length < 2 ? (
            <p className="px-1 text-sm text-app-text-secondary">Type at least 2 letters to search.</p>
          ) : search.isPending ? (
            <div className="space-y-5 px-1" role="status" aria-label="Searching your mail">
              {[1, 2].map((i) => <div key={i} className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />)}
            </div>
          ) : search.isError && results.length === 0 ? (
            <ErrorState title="Couldn't search your mail" message={mailLoadMessage(search.error)} onRetry={() => { void search.refetch(); }} />
          ) : results.length === 0 ? (
            <p className="px-1 pt-4 text-center text-sm text-app-text-secondary">No mail matches &ldquo;{query}&rdquo;.</p>
          ) : (
            <>
              <p className="px-1 pb-2 text-xs text-app-text-muted">
                {results.length} {results.length === 1 ? 'piece shown' : 'pieces shown'} for &ldquo;{query}&rdquo;
              </p>
              <div role="list" aria-label="Search results" className="space-y-4">
                {results.map((item) => {
                  const to = addressee(item);
                  return <div role="listitem" key={item.id}><MailRow item={item} recipientName={to.name} recipientLine={to.line} timeZone={timeZone} onOpen={() => openPiece(item)} /></div>;
                })}
              </div>
              {search.isFetchNextPageError ? (
                <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                  <p>Couldn&apos;t load more results. {mailLoadMessage(search.error)}</p>
                  <button type="button" onClick={() => { void search.fetchNextPage(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
                </div>
              ) : search.hasNextPage ? (
                <button type="button" onClick={() => { void search.fetchNextPage(); }} disabled={search.isFetchingNextPage} className="mt-4 w-full rounded-xl border border-app-border bg-app-surface py-3 text-sm font-semibold text-primary-600 hover:bg-app-hover disabled:opacity-60">
                  {search.isFetchingNextPage ? 'Loading…' : 'Show more'}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.isPending ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-4 pt-4 sm:grid-cols-3" role="status" aria-label="Opening your Vault">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-[88px] rounded-[10px] bg-app-surface-sunken animate-pulse" />)}
            </div>
          ) : folders.isError ? (
            <ErrorState title="Couldn't open your Vault" message={mailLoadMessage(folders.error)} onRetry={() => { void folders.refetch(); void filed.refetch(); }} />
          ) : (
            cabinets.map((cabinet) => (
              <section key={cabinet.key} aria-label={cabinet.title ? `Folders for ${cabinet.title}` : 'Folders'} className="px-4 pt-4">
                {cabinet.title ? <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-app-text-secondary">{cabinet.title}</h3> : null}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-3">
                  {cabinet.folders.map((folder) => <VaultFolderCard key={folder.id} folder={folder} onClick={() => openFolder(folder)} />)}
                </div>
              </section>
            ))
          )}

          {/* Archived, and a new folder */}
          {!folders.isError ? (
            <div className="space-y-2 px-4 pt-4">
              <button
                type="button"
                onClick={() => router.push(drawer === 'personal' ? '/app/mailbox/vault/archived' : `/app/mailbox/vault/archived?drawer=${drawer}`)}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3.5 text-left text-sm font-semibold text-app-text hover:bg-app-hover"
              >
                <Archive className="h-[18px] w-[18px] text-app-text-secondary" aria-hidden />
                <span className="flex-1">Archived</span>
                <ChevronRight className="h-4 w-4 text-app-text-muted" aria-hidden />
              </button>
              {creating ? (
                <form onSubmit={(event) => { event.preventDefault(); create(); }} className="rounded-xl border border-app-border bg-app-surface p-3.5">
                  <label htmlFor="new-folder" className="text-sm font-semibold text-app-text">New folder in {DRAWER_LABELS[drawer]}</label>
                  <input
                    ref={nameRef}
                    id="new-folder"
                    value={label}
                    maxLength={100}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="For example, Car"
                    className="mt-1.5 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {drawer === 'home' && readable.length > 1 ? (
                    <>
                      <label htmlFor="new-folder-home" className="mt-2.5 block text-sm font-semibold text-app-text">For which home</label>
                      <select id="new-folder-home" value={homeId} onChange={(event) => setHomeId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text">
                        <option value="">Choose a home</option>
                        {readable.map((home) => <option key={home.home_id} value={home.home_id}>{home.name || home.address_line}</option>)}
                      </select>
                    </>
                  ) : null}
                  {createError ? <p role="alert" className="mt-2 text-sm text-red-700">{createError}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <button type="submit" disabled={createFolder.isPending} className="min-h-[44px] flex-1 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                      {createFolder.isPending ? 'Making it…' : 'Make the folder'}
                    </button>
                    <button type="button" onClick={() => { setCreating(false); setCreateError(null); }} className="min-h-[44px] flex-1 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setCreating(true)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 border-dashed border-app-border px-3.5 text-left text-sm font-semibold text-app-text-secondary hover:text-app-text">
                  <Plus className="h-[18px] w-[18px]" aria-hidden />
                  New folder
                </button>
              )}
            </div>
          ) : null}

          {/* What's filed here, newest first */}
          {!folders.isError ? (
            <section aria-label="Filed mail" className="px-4 pb-8 pt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-app-text-secondary">Filed mail</h3>
              {filed.isPending ? (
                <div className="mt-2 h-[168px] rounded-[20px] bg-app-surface-sunken animate-pulse" role="status" aria-label="Loading filed mail" />
              ) : filed.isError && filedItems.length === 0 ? (
                <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                  <p>Couldn&apos;t load your filed mail. {mailLoadMessage(filed.error)}</p>
                  <button type="button" onClick={() => { void filed.refetch(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
                </div>
              ) : filedItems.length === 0 ? (
                <p className="mt-2 text-sm text-app-text-secondary">Nothing filed in {DRAWER_LABELS[drawer]} yet. Open a piece and choose File in the Vault.</p>
              ) : (
                <>
                  <ul className="mt-2 overflow-hidden rounded-[20px] border border-app-border bg-app-surface">
                    {filedItems.map((item) => (
                      <li key={item.id} className="border-b border-app-border-subtle last:border-b-0">
                        <button type="button" onClick={() => openPiece(item)} className="flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-app-hover">
                          <span aria-hidden="true" className="h-6 w-[34px] flex-shrink-0 rounded-[3px] border border-[#e2dccd] shadow-sm" style={swatchStyle(item)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-app-text">{item.display_title || item.subject || 'Mail'}</span>
                            <span className="block truncate text-xs text-app-text-secondary">
                              {[item.sender_display, folderName(item.vault_folder_id), shortDate(item.delivered_at || item.created_at)].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {filed.isFetchNextPageError ? (
                    <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                      <p>Couldn&apos;t load more. {mailLoadMessage(filed.error)}</p>
                      <button type="button" onClick={() => { void filed.fetchNextPage(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
                    </div>
                  ) : filed.hasNextPage ? (
                    <button type="button" onClick={() => { void filed.fetchNextPage(); }} disabled={filed.isFetchingNextPage} className="mt-3 w-full rounded-xl border border-app-border bg-app-surface py-3 text-sm font-semibold text-primary-600 hover:bg-app-hover disabled:opacity-60">
                      {filed.isFetchingNextPage ? 'Loading…' : 'Show more'}
                    </button>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
