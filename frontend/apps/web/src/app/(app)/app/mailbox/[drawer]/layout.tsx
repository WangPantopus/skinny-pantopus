'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { MailItemV2 } from '@/types/mailbox';
import { useQueryClient } from '@tanstack/react-query';
import { mailboxKeys, useDrawerTab, useMarkItemOpened } from '@/lib/mailbox-queries';
import { OfferCard } from '@/components/mailbox';
import { DRAWER_LABELS, isMailboxDrawer, type MailboxDrawer } from '@/components/mailbox/MailboxHeader';
import MailRow, { deliveryDayLabel } from '@/components/mailbox/MailRow';
import BundlePieces from '@/components/mailbox/BundlePieces';
import HomeLockedBox from '@/components/mailbox/HomeLockedBox';
import WelcomePorch, { isSealedWelcome } from '@/components/mailbox/WelcomePorch';
import { useMe } from '@/lib/me';
import MailboxIllustration from '@/components/mailbox/MailboxIllustration';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import useMailAddressee, { type Addressee } from '@/components/mailbox/useMailAddressee';
import { useMailboxContext } from '@/contexts/MailboxContext';
import ErrorState from '@/components/ui/ErrorState';
import SendCardRow from '@/components/mailbox/cards/SendCardRow';
import SentList from '@/components/mailbox/sent/SentList';

// ── Types ────────────────────────────────────────────────────
type DrawerParam = MailboxDrawer;

const MAIL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY_LINES: Record<DrawerParam, string> = {
  personal: 'Letters, bills and notices for you arrive here each morning.',
  home: 'Mail for your home arrives here each morning.',
  business: 'Mail for your business arrives here each morning.',
  earn: 'Offers you can open for a reward arrive here.',
};

// ── Helpers ──────────────────────────────────────────────────
function toOfferEnvelope(item: MailItemV2) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = item as any;
  return {
    id: item.id,
    advertiser_id: item.sender_user_id || '',
    business_name: item.sender_display || '',
    business_logo_url: item.sender_logo_url,
    offer_title: item.display_title || item.subject || '',
    offer_subtitle: a.offer_subtitle,
    payout_amount: a.payout_amount || 0,
    expires_at: a.expires_at,
    status: (item.opened_at ? 'opened' : 'available') as 'available' | 'opened',
    opened: !!item.opened_at,
  };
}

// ── Layout ───────────────────────────────────────────────────
export default function DrawerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ drawer: string }>;
}) {
  const { drawer } = use(params);
  // Sent isn't a drawer of incoming mail: it lists what you sent (no drawer list to load).
  if (drawer === 'sent') return <SentLayout>{children}</SentLayout>;
  return <DrawerList drawerParam={drawer}>{children}</DrawerList>;
}

/** Sent beside the card open from it, as Incoming sits beside a letter (phones show one at a time). */
function SentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selectedId = pathname.match(/\/mailbox\/sent\/([^/]+)/)?.[1];
  return (
    <div className="md:flex md:h-full md:overflow-hidden">
      <div
        className={`flex flex-col md:h-full flex-shrink-0 md:border-r border-app-border bg-app ${
          selectedId ? 'hidden md:flex md:w-[380px] lg:w-[400px]' : 'w-full md:w-[380px] lg:w-[400px]'
        }`}
      >
        <h2 className="sr-only">Sent</h2>
        <div className="md:flex-1 md:overflow-y-auto">
          <SentList selectedId={selectedId} />
        </div>
      </div>
      <div className={`md:flex-1 min-w-0 md:overflow-hidden ${selectedId ? '' : 'hidden md:block'}`}>
        {children}
      </div>
    </div>
  );
}

function DrawerList({ drawerParam, children }: { drawerParam: string; children: React.ReactNode }) {
  const drawer = drawerParam as DrawerParam;
  const pathname = usePathname();
  const router = useRouter();
  // The Home drawer narrowed to one Home (Home links carry ?homeId=).
  const homeParam = useSearchParams().get('homeId');
  const homeId = drawer === 'home' && homeParam && MAIL_ID.test(homeParam) ? homeParam.toLowerCase() : undefined;

  // Detect if we're on an item detail sub-route
  const isItemView = pathname.split('/').filter(Boolean).length > 3;

  // Older links open a letter as /app/mailbox/:mailId (mail notifications and
  // the Home bill, package and document links), which lands here with the
  // letter's id as the drawer. Open the letter's existing detail page instead,
  // without loading a drawer by that id (it would fail and show an error).
  const isLetterLink = MAIL_ID.test(drawerParam);
  // Any other word in the drawer's place (an old Mail Day link such as
  // /app/mailbox/mailday, or Earn while it's hidden) opens Me.
  const isUnknown = !isLetterLink && !isMailboxDrawer(drawerParam);
  useEffect(() => {
    if (isUnknown) { router.replace('/app/mailbox/personal'); return; }
    if (!isLetterLink) return;
    const scope = new URLSearchParams(window.location.search).get('scope');
    router.replace(`/app/mailbox/${scope === 'home' ? 'home' : 'personal'}/${drawerParam.toLowerCase()}`);
  }, [isLetterLink, isUnknown, drawerParam, router]);

  // ── State ───────────────────────────────────────────────
  const [openBundle, setOpenBundle] = useState<string | null>(null);
  const [openingOffers, setOpeningOffers] = useState<Set<string>>(new Set());

  // Keep bundle expansion scoped to the current drawer. The query owns its
  // pages, so refetching after an action replaces old rows instead of keeping
  // an append-only copy of letters that were opened, filed or shredded.
  const listKey = `${drawer}|${homeId ?? ''}`;
  const [pagedDrawer, setPagedDrawer] = useState(listKey);
  if (pagedDrawer !== listKey) {
    setPagedDrawer(listKey);
    setOpenBundle(null);
  }

  const {
    data, isPending, isError, isFetching, error, refetch,
    hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError,
  } = useDrawerTab(drawer, 'incoming', { limit: 20, homeId }, { enabled: !isLetterLink && !isUnknown });
  const allItems = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const markOpened = useMarkItemOpened();
  const queryClient = useQueryClient();
  const { addressee, timeZone, homes } = useMailAddressee();
  const narrowedHome = homeId ? homes?.find((home) => home.home_id === homeId) : undefined;
  // Homes whose mail waits on proof of address (R14): the closed box in place of
  // the list when that's all there is (or it's the Home asked for), a card above
  // the other Homes' mail otherwise.
  const lockedHomes = drawer === 'home'
    ? (homes ?? []).filter((home) => home.mail_access === 'needs_proof' && (!homeId || home.home_id === homeId))
    : [];
  const openHomeCount = (homes ?? []).filter((home) => home.mail_access === 'open').length;
  const homeLocked = lockedHomes.length > 0
    && (Boolean(homeId) || openHomeCount === 0 || error?.serverCode === 'MAIL_HOME_NEEDS_PROOF');

  // The first day (R12): the porch with Pantopus's sealed welcome letter, once;
  // closing it leaves the letter sealed in Incoming (remembered in this browser).
  const { data: me } = useMe();
  const welcome = drawer === 'personal' && !isItemView ? allItems.find(isSealedWelcome) : undefined;
  const porchKey = me?.id ? `pantopus_mail_welcome_closed:${me.id}` : null;
  const [porchClosed, setPorchClosed] = useState<{ key: string; id: string | null } | null>(null);
  useEffect(() => {
    if (!porchKey) return;
    let closedId: string | null = null;
    try { closedId = window.localStorage.getItem(porchKey); } catch { /* storage off: the porch shows each visit */ }
    setPorchClosed({ key: porchKey, id: closedId });
  }, [porchKey]);
  const showPorch = Boolean(welcome && porchClosed && porchClosed.key === porchKey && porchClosed.id !== welcome.id);
  const closePorch = useCallback(() => {
    if (!welcome || !porchKey) return;
    try { window.localStorage.setItem(porchKey, welcome.id); } catch { /* storage off */ }
    setPorchClosed({ key: porchKey, id: welcome.id });
  }, [welcome, porchKey]);
  const ownAddress = homes?.find((home) => home.mail_access === 'open')?.address_line ?? null;
  const { deliveryOpening } = useMailboxContext();

  // ── Infinite scroll ─────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetching && !isFetchNextPageError) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // allItems.length: the sentinel only mounts once rows render.
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, allItems.length]);

  // ── Item click ──────────────────────────────────────────
  const selectedItemId = pathname.match(/\/mailbox\/[^/]+\/([^/]+)/)?.[1];

  const handleItemClick = useCallback((item: MailItemV2) => {
    const href = `/app/mailbox/${drawer}/${item.id}`;

    // Mark as opened if unread
    if (!item.opened_at) {
      markOpened.mutate(item.id);
    }

    // Desktop: update URL without full navigation (keeps list in place)
    // Mobile: navigate to detail page
    if (window.innerWidth >= 768) {
      window.history.pushState(null, '', href);
      // Force Next.js to re-render with the new pathname
      router.push(href, { scroll: false });
    } else {
      router.push(href);
    }
  }, [drawer, markOpened, router]);

  // Incoming lists a bundle once and leaves out its pieces (the server's rule, SRV-5).
  const rows = allItems;

  // Pieces under day headings, in the mailbox's own time zone.
  const groups = useMemo(() => {
    const out: { label: string; items: MailItemV2[] }[] = [];
    for (const item of rows) {
      const label = deliveryDayLabel(item, timeZone);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [rows, timeZone]);

  // A letter link has no drawer to show while it opens the letter.
  if (isLetterLink || isUnknown) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]" role="status" aria-label={isLetterLink ? 'Opening your letter' : 'Opening your mailbox'}>
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  let slideIndex = 0;

  // Phones scroll the page (the Mailbox layout); from md up the list and the
  // letter scroll side by side.
  return (
    <div className="md:flex md:h-full md:overflow-hidden">
      {/* ── List panel ───────────────────────────────────── */}
      <div
        className={`flex flex-col md:h-full flex-shrink-0 md:border-r border-app-border bg-app ${
          isItemView ? 'hidden md:flex md:w-[380px] lg:w-[400px]' : 'w-full md:w-[380px] lg:w-[400px]'
        }`}
      >
        {/* The drawer and tab are in the Mailbox's chips and tabs above */}
        <h2 className="sr-only">{DRAWER_LABELS[drawer]} · Incoming</h2>
        {homeId ? (
          <div className="flex items-center justify-between gap-3 px-4 pt-3 text-sm">
            <p className="min-w-0 truncate text-app-text-secondary">
              {narrowedHome ? <>Mail for <span className="font-medium text-app-text">{narrowedHome.name || narrowedHome.address_line}</span></> : 'Mail for one of your homes'}
            </p>
            <Link href="/app/mailbox/home" className="flex-shrink-0 font-semibold text-primary-600 hover:underline">All homes</Link>
          </div>
        ) : null}

        {/* Item list */}
        <div className="md:flex-1 md:overflow-y-auto">
          {/* Christmas cards (holiday_cards): the way in, at the top of your own mail */}
          {drawer === 'personal' ? <SendCardRow /> : null}
          {!homeLocked ? lockedHomes.map((home) => <HomeLockedBox key={home.home_id} home={home} compact />) : null}
          {homeLocked ? (
            <HomeLockedBox home={lockedHomes[0]} />
          ) : isPending ? (
            // Loading: paper-shaped placeholders
            <div className="space-y-5 px-4 py-4" role="status" aria-label="Loading your mail">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />
                  <div className="mt-2 h-3 w-32 rounded bg-app-surface-sunken animate-pulse" />
                </div>
              ))}
            </div>
          ) : isError && allItems.length === 0 ? (
            // A failed first page is not an empty mailbox.
            <ErrorState
              title="Couldn't load your mail"
              message={mailLoadMessage(error)}
              // The drawer counts (chips and the Mail badge) failed with the list; bring them back too.
              onRetry={() => { void refetch(); void queryClient.invalidateQueries({ queryKey: mailboxKeys.drawers() }); }}
            />
          ) : rows.length === 0 ? (
            <section aria-label="No mail" className="flex flex-col items-center px-6 py-12 text-center">
              <MailboxIllustration state="open-empty" size={132} />
              <h3 className="mt-3 text-lg font-semibold text-app-text">Your mailbox is empty</h3>
              <p className="mt-1 max-w-xs text-sm text-app-text-secondary">{EMPTY_LINES[drawer]}</p>
            </section>
          ) : (
            <div className="pb-6">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="px-3 pt-4">
                  <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary">{group.label}</h3>
                  <div role="list" className="space-y-4">
                    {group.items.map((item) => {
                      // Today's pieces slide out of the box during the delivery moment.
                      const slideInDelayMs = deliveryOpening && group.label === 'Today' && slideIndex < 6 ? 450 + 90 * slideIndex++ : undefined;
                      return (
                        <div role="listitem" key={item.id}>
                          <DrawerItemRenderer
                            item={item}
                            drawer={drawer}
                            isSelected={selectedItemId === item.id}
                            addressee={addressee}
                            timeZone={timeZone}
                            slideInDelayMs={slideInDelayMs}
                            bundleOpen={openBundle === item.id}
                            onToggleBundle={() => setOpenBundle((open) => (open === item.id ? null : item.id))}
                            openingOffers={openingOffers}
                            setOpeningOffers={setOpeningOffers}
                            onClick={handleItemClick}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />

              {/* A later page failed: keep the rows, retry that same page */}
              {isError && allItems.length > 0 && (
                <div role="alert" className="mx-3 my-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                  <p>{isFetchNextPageError ? "Couldn't load more mail." : "Couldn't refresh your mail."} {mailLoadMessage(error)}</p>
                  <button
                    type="button"
                    disabled={isFetching}
                    onClick={() => { if (!isFetching) void (isFetchNextPageError ? fetchNextPage() : refetch()); }}
                    className="flex-shrink-0 font-semibold text-primary-600 hover:underline disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Loading more indicator */}
              {isFetchingNextPage && (
                <div className="py-4 text-center" role="status" aria-label="Loading more mail">
                  <div className="inline-block w-5 h-5 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────── */}
      <div
        className={`md:flex-1 min-w-0 md:overflow-hidden ${
          isItemView ? '' : 'hidden md:block'
        }`}
      >
        {children}
      </div>

      {showPorch && welcome ? (
        <WelcomePorch
          address={ownAddress}
          onOpen={() => { closePorch(); router.push(`/app/mailbox/personal/${welcome.id}`); }}
          onClose={closePorch}
        />
      ) : null}
    </div>
  );
}

// ── Item Renderer ────────────────────────────────────────────
function DrawerItemRenderer({
  item,
  drawer,
  isSelected,
  addressee,
  timeZone,
  slideInDelayMs,
  bundleOpen,
  onToggleBundle,
  openingOffers,
  setOpeningOffers,
  onClick,
}: {
  item: MailItemV2;
  drawer: string;
  isSelected: boolean;
  addressee: (item: MailItemV2) => Addressee;
  timeZone?: string;
  slideInDelayMs?: number;
  bundleOpen: boolean;
  onToggleBundle: () => void;
  openingOffers: Set<string>;
  setOpeningOffers: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClick: (item: MailItemV2) => void;
}) {
  const to = addressee(item);

  // A bundle opens to its pieces.
  if (item.mail_object_type === 'bundle' || item.kind === 'bundle') {
    return (
      <div>
        <MailRow
          item={{ ...item, kind: 'bundle' }}
          recipientName={to.name}
          recipientLine={to.line}
          timeZone={timeZone}
          onOpen={onToggleBundle}
          expanded={bundleOpen}
          slideInDelayMs={slideInDelayMs}
        />
        {bundleOpen ? <BundlePieces bundleId={item.id} addressee={addressee} timeZone={timeZone} onOpen={onClick} /> : null}
      </div>
    );
  }

  // Earn drawer: OfferCard
  if (drawer === 'earn') {
    const offer = toOfferEnvelope(item);
    if (offer.payout_amount > 0) {
      return (
        <div className="px-1">
          <OfferCard
            item={offer}
            isOpening={openingOffers.has(item.id)}
            onOpen={() => {
              setOpeningOffers(prev => new Set(prev).add(item.id));
              setTimeout(() => {
                setOpeningOffers(prev => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
                onClick(item);
              }, 1500);
            }}
          />
        </div>
      );
    }
  }

  return (
    <MailRow
      item={item}
      recipientName={to.name}
      recipientLine={to.line}
      timeZone={timeZone}
      selected={isSelected}
      onOpen={() => onClick(item)}
      slideInDelayMs={slideInDelayMs}
    />
  );
}
