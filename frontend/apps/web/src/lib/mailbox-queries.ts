// ============================================================
// MAILBOX REACT QUERY HOOKS
//
// TanStack Query wrappers for every mailbox API function.
// Query hooks for reads, mutation hooks for writes.
//
// Cache key convention:
//   ['mailbox', domain, ...params]
//
// Mutations invalidate related queries on success.
// ============================================================

'use client';

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import * as api from '@/lib/mailbox-api';
import { MailboxApiError } from '@/lib/mailbox-api';
import { businesses as businessesApi, mailboxV2P2 as mailboxV2P2Api } from '@pantopus/api';
import type { AssetFullDetail } from '@/lib/mailbox-api';
import type { DeletedMail, HolidayCards, HolidayCardArrivalsFor, HolidayCardPreview, SentHolidayCard, SentPiece, SentPieceDetail, RecipientSearchResult } from '@pantopus/api';

import type {
  DrawerMeta,
  MailboxDrawers,
  MailItemV2,
  MailItemDetailResponse,
  MailboxPaginatedResponse,
  VaultFolder,
  VaultSearchResult,
  EarnWallet,
  WalletTransaction,
  OfferRedemption,
  HomeAsset,
  AssetPhoto,
  HomeMapPin,
  CommunityMailItem,
  CommunityReactionCount,
  MailTask,
  MailDaySummary,
  MailDaySettings,
  Stamp,
  SeasonalTheme,
  MailMemory,
  YearInMail,
  VacationHold,
  AuditEvent,
  AutoFileRule,
  ReactionType,
  HoldAction,
  PackageHoldAction,
} from '@/types/mailbox';

// ── Cache key factories ──────────────────────────────────────

export const mailboxKeys = {
  all: ['mailbox'] as const,

  // Drawers
  drawers: () => [...mailboxKeys.all, 'drawers'] as const,
  drawerItems: (drawer: string, params?: Record<string, any>) =>
    [...mailboxKeys.all, 'drawer', drawer, params] as const,
  itemDetail: (itemId: string) =>
    [...mailboxKeys.all, 'item', itemId] as const,
  // Christmas cards: the season's pictures and today's card; the card search.
  holidayCards: () => [...mailboxKeys.all, 'holiday-cards'] as const,
  cardRecipients: (query: string) => [...mailboxKeys.all, 'card-recipients', query] as const,
  cardArrivals: (userId: string) => [...mailboxKeys.all, 'card-arrivals', userId] as const,
  // Sent: what you've sent (newest first), and one sent card.
  sent: () => [...mailboxKeys.all, 'sent'] as const,
  sentCard: (id: string) => [...mailboxKeys.all, 'sent', 'card', id] as const,
  deleted: () => [...mailboxKeys.all, 'deleted'] as const,

  // Counter
  counter: () => [...mailboxKeys.all, 'counter'] as const,

  // Bundles
  bundleItems: (bundleId: string) =>
    [...mailboxKeys.all, 'bundle', bundleId] as const,

  // Vault
  vaultFolders: () => [...mailboxKeys.all, 'vault', 'folders'] as const,
  vaultFolderItems: (folderId: string, params?: Record<string, any>) =>
    [...mailboxKeys.all, 'vault', 'folder', folderId, params] as const,
  vaultSearch: (query: string) =>
    [...mailboxKeys.all, 'vault', 'search', query] as const,

  // Earn
  earnWallet: () => [...mailboxKeys.all, 'earn', 'wallet'] as const,
  walletTransactions: (params?: Record<string, any>) =>
    [...mailboxKeys.all, 'earn', 'transactions', params] as const,

  // Records
  homeAssets: (homeId: string) =>
    [...mailboxKeys.all, 'records', 'assets', homeId] as const,
  assetDetail: (assetId: string) =>
    [...mailboxKeys.all, 'records', 'asset', assetId] as const,

  // Map
  mapPins: (homeId: string, params?: Record<string, any>) =>
    [...mailboxKeys.all, 'map', 'pins', homeId, params] as const,

  // Community
  communityItems: (params?: Record<string, any>) =>
    [...mailboxKeys.all, 'community', params] as const,

  // Tasks
  tasks: (homeId?: string) =>
    [...mailboxKeys.all, 'tasks', homeId] as const,

  // Mail Day
  mailDaySummary: () => [...mailboxKeys.all, 'mailday', 'summary'] as const,
  mailDaySettings: () => [...mailboxKeys.all, 'mailday', 'settings'] as const,

  // Stamps & Themes
  stamps: () => [...mailboxKeys.all, 'stamps'] as const,
  themes: () => [...mailboxKeys.all, 'themes'] as const,

  // Memory
  memories: () => [...mailboxKeys.all, 'memories'] as const,
  yearInMail: (year: number) =>
    [...mailboxKeys.all, 'memory', 'year', year] as const,

  // Travel
  vacationHold: () => [...mailboxKeys.all, 'vacation'] as const,
} as const;

// ── Shared defaults ──────────────────────────────────────────

const STALE_30S = 30 * 1000;
const STALE_1M = 60 * 1000;
const STALE_5M = 5 * 60 * 1000;

// ============================================================
// DRAWER HOOKS
// ============================================================

const selectDrawers = (data: MailboxDrawers): DrawerMeta[] => data.drawers;

/**
 * The Mail tab badge: unopened mail in Me, Home and Biz. The server's
 * `unread_total` once it sends one, until then the drawers' unread counts
 * without Earn.
 */
export function mailUnreadTotal(data: MailboxDrawers): number {
  if (typeof data.unread_total === 'number' && Number.isFinite(data.unread_total)) return Math.max(0, data.unread_total);
  return data.drawers
    .filter((drawer) => drawer.drawer !== 'earn')
    .reduce((sum, drawer) => sum + (Number(drawer.unread_count) || 0), 0);
}

export function useDrawerMeta(
  options?: Omit<UseQueryOptions<MailboxDrawers, MailboxApiError, DrawerMeta[]>, 'queryKey' | 'queryFn' | 'select'>,
) {
  return useQuery<MailboxDrawers, MailboxApiError, DrawerMeta[]>({
    queryKey: mailboxKeys.drawers(),
    queryFn: api.getDrawers,
    select: selectDrawers,
    staleTime: STALE_30S,
    ...options,
  });
}

/** The whole drawers reply (the delivery and the Homes for the hero); shares the drawers request. */
// ── Christmas cards (launch key holiday_cards) ─────────────────

/** The season's pictures, the arrivals open now and today's card (null until it's sent). */
export function useHolidayCards(
  options?: Omit<UseQueryOptions<HolidayCards, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HolidayCards, MailboxApiError>({
    queryKey: mailboxKeys.holidayCards(),
    queryFn: api.getHolidayCards,
    staleTime: STALE_30S,
    ...options,
  });
}

/** People a card can go to, by name (two letters or more). */
export function useCardRecipients(query: string) {
  const q = query.trim();
  return useQuery<RecipientSearchResult[], MailboxApiError>({
    queryKey: mailboxKeys.cardRecipients(q.toLowerCase()),
    queryFn: () => api.searchCardRecipients(q),
    enabled: q.length >= 2,
    staleTime: STALE_30S,
  });
}

/** When a card to this person can come, by their clock: their arrivals and the day of their next 7 a.m. mail. */
export function useCardArrivals(userId: string | null) {
  return useQuery<HolidayCardArrivalsFor, MailboxApiError>({
    queryKey: mailboxKeys.cardArrivals(userId ?? ''),
    queryFn: () => api.getHolidayCardArrivals(userId as string),
    enabled: !!userId,
    staleTime: STALE_30S,
  });
}

// Sending or taking back a card moves today's card, Sent and the Mailbox's flag (the drawers reply).
function invalidateSentCards(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: mailboxKeys.holidayCards() });
  void qc.invalidateQueries({ queryKey: mailboxKeys.sent() });
  void qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
}

export function useSendHolidayCard() {
  const qc = useQueryClient();
  return useMutation<{ card: SentHolidayCard }, MailboxApiError, Parameters<typeof api.sendHolidayCard>[0]>({
    mutationFn: api.sendHolidayCard,
    onSettled: () => invalidateSentCards(qc),
  });
}

/** Look it over: what they will get, checked as sending it would be; nothing is stored or sent. */
export function usePreviewHolidayCard() {
  return useMutation<HolidayCardPreview, MailboxApiError, Parameters<typeof api.previewHolidayCard>[0]>({
    mutationFn: api.previewHolidayCard,
  });
}

export function useTakeBackHolidayCard() {
  const qc = useQueryClient();
  return useMutation<{ taken_back: true }, MailboxApiError, string>({
    mutationFn: api.takeBackHolidayCard,
    onSettled: () => invalidateSentCards(qc),
  });
}

/** Sent: the cards you sent, newest first, 25 at a time (the server's cursor pages on). */
export function useSentCards(options?: { enabled?: boolean }) {
  return useInfiniteQuery<{ items: SentPiece[]; next: string | null }, MailboxApiError>({
    queryKey: mailboxKeys.sent(),
    queryFn: ({ pageParam }) => api.getSentCards(pageParam ? { before: pageParam as string } : undefined),
    initialPageParam: null,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: options?.enabled ?? true,
    staleTime: STALE_30S,
  });
}

/** One card you sent, with your note and its trail. */
export function useSentCard(id: string) {
  return useQuery<SentPieceDetail, MailboxApiError>({
    queryKey: mailboxKeys.sentCard(id),
    queryFn: () => api.getSentCard(id),
    staleTime: STALE_30S,
    // Not found is an answer (it was taken back, or it isn't yours): no retry.
    retry: (count, error) => error.status !== 404 && count < 2,
  });
}

export function useMailboxDrawers(
  options?: Omit<UseQueryOptions<MailboxDrawers, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailboxDrawers, MailboxApiError>({
    queryKey: mailboxKeys.drawers(),
    queryFn: api.getDrawers,
    staleTime: STALE_30S,
    ...options,
  });
}

/**
 * Do something with a piece (counter, done, file, unfile, shred, acknowledge).
 * The letter updates in place from the server's answer; lists and counts
 * refresh. A failure leaves everything as it was.
 */
export function useMailAction(itemId: string) {
  const qc = useQueryClient();
  return useMutation<MailItemV2 | null, MailboxApiError, { action: api.MailActionName; folderId?: string }>({
    mutationFn: ({ action, folderId }) => api.mailAction(itemId, action, folderId),
    onSuccess: (piece) => {
      if (piece) {
        qc.setQueryData<MailItemDetailResponse>(mailboxKeys.itemDetail(itemId), (detail) => (detail ? {
          ...detail,
          piece: { ...detail.piece, ...piece },
          wrapper: { ...detail.wrapper, lifecycle: piece.lifecycle, removed: piece.removed ?? undefined, acknowledged_at: piece.acknowledged_at ?? detail.wrapper.acknowledged_at },
        } : detail));
      }
      qc.invalidateQueries({ queryKey: mailboxKeys.itemDetail(itemId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.counter() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'vault'] });
      qc.invalidateQueries({ queryKey: mailboxKeys.deleted() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'search'] });
    },
  });
}

type BookletPages = {
  pages: { page_number: number; image_url?: string; text_content?: string }[];
  cover_image_url?: string;
  download_url?: string;
  download_size_bytes?: number;
};

/**
 * A booklet's pages, cover and download (GET /api/mailbox/v2/p2/booklet/:id);
 * no pages when the sender sent only a cover.
 */
export function useBooklet(itemId: string, enabled: boolean) {
  return useQuery<BookletPages, MailboxApiError>({
    queryKey: [...mailboxKeys.all, 'booklet', itemId],
    queryFn: async () => {
      try {
        const reply = await mailboxV2P2Api.getBooklet(itemId);
        return {
          pages: (reply?.pages ?? []).map((page) => ({ page_number: page.page_number, image_url: page.image_url, text_content: page.text_content })),
          cover_image_url: reply?.booklet?.cover_image_url ?? undefined,
          download_url: reply?.booklet?.download_url ?? undefined,
          download_size_bytes: reply?.booklet?.download_size_bytes ?? undefined,
        };
      } catch (err) {
        const e = err as { statusCode?: number; message?: string; data?: { code?: string } };
        throw new MailboxApiError(e.statusCode ? 'REQUEST_ERROR' : 'NETWORK_ERROR', e.message || 'Error', e.statusCode ?? 0, (e.statusCode ?? 500) >= 500, e.data?.code);
      }
    },
    enabled,
    staleTime: STALE_5M,
  });
}

/** A drawer's Counter, Vault (all of it or one folder) or Archived list, a page at a time ("Show more"). */
export function useDrawerTab(
  drawer: 'personal' | 'home' | 'business',
  tab: 'counter' | 'vault' | 'archived',
  params?: { folderId?: string; homeId?: string },
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>({
    queryKey: [...mailboxKeys.drawerItems(drawer, { tab, ...params }), 'pages'],
    queryFn: ({ pageParam }) => api.getDrawerItems(drawer, { tab, page: pageParam as number, limit: 30, ...params }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    enabled: options?.enabled ?? true,
    staleTime: STALE_30S,
  });
}

/** Search all mail on the server, a page at a time ("Show more"). */
export function useMailSearch(query: string) {
  const q = query.trim();
  return useInfiniteQuery<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>({
    queryKey: [...mailboxKeys.all, 'search', q],
    queryFn: ({ pageParam }) => api.searchMail(q, { offset: pageParam as number, limit: 30 }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.next_offset : undefined),
    enabled: q.length >= 2,
    staleTime: STALE_30S,
  });
}

/** Whether the person owns a business: the Biz drawer is for business owners. */
export function useOwnsBusiness() {
  return useQuery<{ businesses: { role_base: string }[] }, unknown, boolean>({
    queryKey: [...mailboxKeys.all, 'owns-business'],
    queryFn: () => businessesApi.getMyBusinesses(),
    select: (reply) => (reply?.businesses ?? []).some((membership) => membership.role_base === 'owner'),
    staleTime: STALE_5M,
  });
}

/** The Mail tab badge count; shares the drawers request with useDrawerMeta. */
export function useMailUnread(
  options?: Omit<UseQueryOptions<MailboxDrawers, MailboxApiError, number>, 'queryKey' | 'queryFn' | 'select'>,
) {
  return useQuery<MailboxDrawers, MailboxApiError, number>({
    queryKey: mailboxKeys.drawers(),
    queryFn: api.getDrawers,
    select: mailUnreadTotal,
    staleTime: STALE_30S,
    ...options,
  });
}

export function useDrawerItems(
  drawer: 'personal' | 'home' | 'business' | 'earn',
  params?: { page?: number; limit?: number; filter?: string; tab?: 'incoming' | 'counter' | 'vault' | 'archived'; homeId?: string; folderId?: string },
  options?: Omit<
    UseQueryOptions<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>({
    queryKey: mailboxKeys.drawerItems(drawer, params as Record<string, any>),
    queryFn: () => api.getDrawerItems(drawer, params),
    staleTime: STALE_30S,
    ...options,
  });
}

export function useItemDetail(
  itemId: string,
  options?: Omit<
    UseQueryOptions<MailItemDetailResponse, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<MailItemDetailResponse, MailboxApiError>({
    queryKey: mailboxKeys.itemDetail(itemId),
    queryFn: () => api.getItemDetail(itemId),
    staleTime: STALE_1M,
    enabled: !!itemId,
    ...options,
  });
}

export function useMarkItemOpened(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    // Loading a letter (GET /api/mailbox/v2/item/:id) is what marks it opened; the item action route has no
    // "open" action. So wait for that load, sharing the detail query's request, then refresh the lists and counts.
    mutationFn: async (itemId) => {
      await qc.fetchQuery({
        queryKey: mailboxKeys.itemDetail(itemId),
        queryFn: () => api.getItemDetail(itemId),
        staleTime: STALE_1M,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.counter() });
      qc.invalidateQueries({ queryKey: mailboxKeys.mailDaySummary() });
      // Invalidate all drawer item lists
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
    },
    ...options,
  });
}

export function useFileItemToVault(
  options?: UseMutationOptions<void, MailboxApiError, { itemId: string; folderId: string }>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, { itemId: string; folderId: string }>({
    mutationFn: ({ itemId, folderId }) => api.fileItemToVault(itemId, folderId),
    onSuccess: (_data, { itemId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.mailDaySummary() });
      qc.invalidateQueries({ queryKey: mailboxKeys.itemDetail(itemId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.vaultFolders() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'vault', 'folder'] });
    },
    ...options,
  });
}

// ============================================================
// COUNTER HOOKS
// ============================================================

export function useCounterItems(
  options?: Omit<UseQueryOptions<MailItemV2[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailItemV2[], MailboxApiError>({
    queryKey: mailboxKeys.counter(),
    queryFn: api.getCounterItems,
    staleTime: STALE_30S,
    ...options,
  });
}

// ============================================================
// BUNDLE HOOKS
// ============================================================

export function useBundleItems(
  bundleId: string,
  options?: Omit<UseQueryOptions<MailItemV2[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailItemV2[], MailboxApiError>({
    queryKey: mailboxKeys.bundleItems(bundleId),
    queryFn: () => api.expandBundle(bundleId),
    staleTime: STALE_1M,
    enabled: !!bundleId,
    ...options,
  });
}

export function useFileAllBundleItems(
  options?: UseMutationOptions<void, MailboxApiError, { bundleId: string; folderId: string }>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, { bundleId: string; folderId: string }>({
    mutationFn: ({ bundleId, folderId }) => api.fileAllBundleItems(bundleId, folderId),
    onSuccess: (_data, { bundleId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.bundleItems(bundleId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.mailDaySummary() });
      qc.invalidateQueries({ queryKey: mailboxKeys.vaultFolders() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
    },
    ...options,
  });
}

export function useExtractFromBundle(
  options?: UseMutationOptions<void, MailboxApiError, { bundleId: string; itemId: string }>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, { bundleId: string; itemId: string }>({
    mutationFn: ({ bundleId, itemId }) => api.extractFromBundle(bundleId, itemId),
    onSuccess: (_data, { bundleId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.bundleItems(bundleId) });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
    },
    ...options,
  });
}

// ============================================================
// CERTIFIED MAIL HOOKS
// ============================================================

export function useAcknowledgeCertifiedMail(
  options?: UseMutationOptions<
    { acknowledged_at: string; audit_trail: AuditEvent[]; proof_pdf_url: string },
    MailboxApiError,
    string
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    { acknowledged_at: string; audit_trail: AuditEvent[]; proof_pdf_url: string },
    MailboxApiError,
    string
  >({
    mutationFn: api.acknowledgeCertifiedMail,
    onSuccess: (_data, itemId) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.itemDetail(itemId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.counter() });
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
    },
    ...options,
  });
}

// ============================================================
// VAULT HOOKS
// ============================================================

export function useVaultFolders(
  options?: Omit<UseQueryOptions<VaultFolder[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<VaultFolder[], MailboxApiError>({
    queryKey: mailboxKeys.vaultFolders(),
    queryFn: api.getVaultFolders,
    staleTime: STALE_1M,
    ...options,
  });
}

export function useVaultFolderItems(
  folderId: string,
  params?: { page?: number; limit?: number },
  options?: Omit<
    UseQueryOptions<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<MailboxPaginatedResponse<MailItemV2>, MailboxApiError>({
    queryKey: mailboxKeys.vaultFolderItems(folderId, params as Record<string, any>),
    queryFn: () => api.getFolderItems(folderId, params),
    staleTime: STALE_1M,
    enabled: !!folderId,
    ...options,
  });
}

export function useVaultSearch(
  query: string,
  options?: Omit<UseQueryOptions<VaultSearchResult[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<VaultSearchResult[], MailboxApiError>({
    queryKey: mailboxKeys.vaultSearch(query),
    queryFn: () => api.searchVault(query),
    staleTime: STALE_30S,
    enabled: query.length >= 2,
    ...options,
  });
}

export function useCreateVaultFolder(
  options?: UseMutationOptions<
    VaultFolder,
    MailboxApiError,
    { label: string; icon: string; color: string; drawer: 'personal' | 'home' | 'business' | 'earn'; home_id?: string; autoFileRules?: AutoFileRule[] }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    VaultFolder,
    MailboxApiError,
    { label: string; icon: string; color: string; drawer: 'personal' | 'home' | 'business' | 'earn'; home_id?: string; autoFileRules?: AutoFileRule[] }
  >({
    mutationFn: api.createVaultFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.vaultFolders() });
    },
    ...options,
  });
}

// ============================================================
// EARN HOOKS
// ============================================================

export function useEarnWallet(
  options?: Omit<UseQueryOptions<EarnWallet, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<EarnWallet, MailboxApiError>({
    queryKey: mailboxKeys.earnWallet(),
    queryFn: api.getEarnWallet,
    staleTime: STALE_1M,
    ...options,
  });
}

export function useWalletTransactions(
  params?: { page?: number; limit?: number },
  options?: Omit<
    UseQueryOptions<MailboxPaginatedResponse<WalletTransaction>, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<MailboxPaginatedResponse<WalletTransaction>, MailboxApiError>({
    queryKey: mailboxKeys.walletTransactions(params as Record<string, any>),
    queryFn: () => api.getWalletTransactions(params),
    staleTime: STALE_1M,
    ...options,
  });
}

export function useInitiateWithdrawal(
  options?: UseMutationOptions<
    { status: string; estimated_days?: number },
    MailboxApiError,
    { amount: number; method: 'pantopus_credit' | 'bank_transfer' | 'gift_card' }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    { status: string; estimated_days?: number },
    MailboxApiError,
    { amount: number; method: 'pantopus_credit' | 'bank_transfer' | 'gift_card' }
  >({
    mutationFn: api.initiateWithdrawal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.earnWallet() });
      qc.invalidateQueries({ queryKey: mailboxKeys.walletTransactions() });
    },
    ...options,
  });
}

export function useEngageOffer(
  options?: UseMutationOptions<{ earn_amount: number }, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<{ earn_amount: number }, MailboxApiError, string>({
    mutationFn: api.engageOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.earnWallet() });
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer', 'earn'] });
    },
    ...options,
  });
}

export function useRedeemOffer(
  options?: UseMutationOptions<
    OfferRedemption,
    MailboxApiError,
    { itemId: string; mode: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<OfferRedemption, MailboxApiError, { itemId: string; mode: string }>({
    mutationFn: ({ itemId, mode }) => api.redeemOffer(itemId, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.earnWallet() });
      qc.invalidateQueries({ queryKey: mailboxKeys.walletTransactions() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer', 'earn'] });
    },
    ...options,
  });
}

// ============================================================
// RECORDS HOOKS (Phase 3)
// ============================================================

export function useHomeAssets(
  homeId: string,
  options?: Omit<UseQueryOptions<HomeAsset[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HomeAsset[], MailboxApiError>({
    queryKey: mailboxKeys.homeAssets(homeId),
    queryFn: () => api.getHomeAssets(homeId),
    staleTime: STALE_1M,
    enabled: !!homeId,
    ...options,
  });
}

export function useAssetDetail(
  assetId: string,
  options?: Omit<UseQueryOptions<HomeAsset, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HomeAsset, MailboxApiError>({
    queryKey: mailboxKeys.assetDetail(assetId),
    queryFn: () => api.getAssetDetail(assetId),
    staleTime: STALE_1M,
    enabled: !!assetId,
    ...options,
  });
}

export function useAssetFullDetail(
  assetId: string,
  options?: Omit<UseQueryOptions<AssetFullDetail, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AssetFullDetail, MailboxApiError>({
    queryKey: [...mailboxKeys.assetDetail(assetId), 'full'],
    queryFn: () => api.getAssetFullDetail(assetId),
    staleTime: STALE_1M,
    enabled: !!assetId,
    ...options,
  });
}

export function useCreateAsset(
  options?: UseMutationOptions<
    HomeAsset,
    MailboxApiError,
    { homeId: string; name: string; category: HomeAsset['category']; room?: string; manufacturer?: string; model_number?: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    HomeAsset,
    MailboxApiError,
    { homeId: string; name: string; category: HomeAsset['category']; room?: string; manufacturer?: string; model_number?: string }
  >({
    mutationFn: api.createAsset,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.homeAssets(variables.homeId) });
    },
    ...options,
  });
}

export function useLinkMailToAsset(
  options?: UseMutationOptions<
    void,
    MailboxApiError,
    { assetId: string; itemId: string; linkType?: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    void,
    MailboxApiError,
    { assetId: string; itemId: string; linkType?: string }
  >({
    mutationFn: ({ assetId, itemId, linkType }) =>
      api.linkMailToAsset(assetId, itemId, linkType),
    onSuccess: (_data, { assetId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.assetDetail(assetId) });
    },
    ...options,
  });
}

export function useAddAssetPhoto(
  options?: UseMutationOptions<
    AssetPhoto,
    MailboxApiError,
    { assetId: string; file: File }
  >,
) {
  const qc = useQueryClient();
  return useMutation<AssetPhoto, MailboxApiError, { assetId: string; file: File }>({
    mutationFn: ({ assetId, file }) => api.addAssetPhoto(assetId, file),
    onSuccess: (_data, { assetId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.assetDetail(assetId) });
    },
    ...options,
  });
}

// ============================================================
// MAP HOOKS (Phase 3)
// ============================================================

export function useMapPins(
  homeId: string,
  params?: { type?: string; bounds?: { north: number; south: number; east: number; west: number } },
  options?: Omit<UseQueryOptions<HomeMapPin[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HomeMapPin[], MailboxApiError>({
    queryKey: mailboxKeys.mapPins(homeId, params as Record<string, any>),
    queryFn: () => api.getMapPins(homeId, params),
    staleTime: STALE_1M,
    enabled: !!homeId,
    ...options,
  });
}

// ============================================================
// COMMUNITY HOOKS (Phase 3)
// ============================================================

export function useCommunityItems(
  params?: { homeId?: string; type?: string; limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<CommunityMailItem[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CommunityMailItem[], MailboxApiError>({
    queryKey: mailboxKeys.communityItems(params as Record<string, any>),
    queryFn: () => api.getCommunityItems(params),
    staleTime: STALE_30S,
    ...options,
  });
}

export function usePublishToCommunity(
  options?: UseMutationOptions<
    void,
    MailboxApiError,
    { itemId: string; scope: 'building' | 'neighborhood' | 'city'; commentary?: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    void,
    MailboxApiError,
    { itemId: string; scope: 'building' | 'neighborhood' | 'city'; commentary?: string }
  >({
    mutationFn: ({ itemId, scope, commentary }) =>
      api.publishToCommunity(itemId, scope, commentary),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'community'] });
    },
    ...options,
  });
}

export function useReactToCommunityItem(
  options?: UseMutationOptions<
    CommunityReactionCount[],
    MailboxApiError,
    { itemId: string; reaction: ReactionType }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    CommunityReactionCount[],
    MailboxApiError,
    { itemId: string; reaction: ReactionType }
  >({
    mutationFn: ({ itemId, reaction }) => api.reactToCommunityItem(itemId, reaction),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'community'] });
    },
    ...options,
  });
}

export function useRsvpCommunityEvent(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.rsvpCommunityEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'community'] });
    },
    ...options,
  });
}

// ============================================================
// TASK HOOKS (Phase 3)
// ============================================================

export function useTasks(
  homeId?: string,
  options?: Omit<
    UseQueryOptions<{ active: MailTask[]; completed: MailTask[] }, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<{ active: MailTask[]; completed: MailTask[] }, MailboxApiError>({
    queryKey: mailboxKeys.tasks(homeId),
    queryFn: () => api.getTasks(homeId),
    staleTime: STALE_30S,
    ...options,
  });
}

export function useCreateTaskFromMail(
  options?: UseMutationOptions<
    MailTask,
    MailboxApiError,
    { mailId: string; homeId: string; title: string; dueAt?: string; priority?: 'low' | 'medium' | 'high'; description?: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    MailTask,
    MailboxApiError,
    { mailId: string; homeId: string; title: string; dueAt?: string; priority?: 'low' | 'medium' | 'high'; description?: string }
  >({
    mutationFn: api.createTaskFromMail,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.tasks(variables.homeId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.tasks() });
    },
    ...options,
  });
}

export function useUpdateTask(
  options?: UseMutationOptions<
    MailTask,
    MailboxApiError,
    { taskId: string; updates: { status?: string; title?: string; priority?: string; dueAt?: string } }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    MailTask,
    MailboxApiError,
    { taskId: string; updates: { status?: string; title?: string; priority?: string; dueAt?: string } }
  >({
    mutationFn: ({ taskId, updates }) => api.updateTask(taskId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'tasks'] });
    },
    ...options,
  });
}

export function useEscalateTaskToGig(
  options?: UseMutationOptions<
    { gig_id: string },
    MailboxApiError,
    { taskId: string; data?: { title?: string; description?: string; compensation?: number } }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    { gig_id: string },
    MailboxApiError,
    { taskId: string; data?: { title?: string; description?: string; compensation?: number } }
  >({
    mutationFn: ({ taskId, data }) => api.escalateTaskToGig(taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'tasks'] });
    },
    ...options,
  });
}

// ============================================================
// MAIL DAY HOOKS (Phase 3)
// ============================================================

export function useMailDaySummary(
  options?: Omit<UseQueryOptions<MailDaySummary, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailDaySummary, MailboxApiError>({
    queryKey: mailboxKeys.mailDaySummary(),
    queryFn: api.getMailDaySummary,
    staleTime: STALE_1M,
    ...options,
  });
}

export function useMailDaySettings(
  options?: Omit<UseQueryOptions<MailDaySettings, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailDaySettings, MailboxApiError>({
    queryKey: mailboxKeys.mailDaySettings(),
    queryFn: api.getMailDaySettings,
    staleTime: STALE_5M,
    ...options,
  });
}

export function useUpdateMailDaySettings(
  options?: UseMutationOptions<MailDaySettings, MailboxApiError, Partial<MailDaySettings>>,
) {
  const qc = useQueryClient();
  return useMutation<MailDaySettings, MailboxApiError, Partial<MailDaySettings>>({
    mutationFn: api.updateMailDaySettings,
    onSuccess: (data) => {
      qc.setQueryData(mailboxKeys.mailDaySettings(), data);
      qc.invalidateQueries({ queryKey: mailboxKeys.mailDaySummary() });
    },
    ...options,
  });
}

// ============================================================
// STAMPS & THEMES HOOKS (Phase 3)
// ============================================================

export function useStamps(
  options?: Omit<
    UseQueryOptions<
      { earned: Stamp[]; locked: { stamp_type: string; name: string; description: string; rarity: string; progress?: number; target?: number }[]; total_earned: number; total_available: number },
      MailboxApiError
    >,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<
    { earned: Stamp[]; locked: { stamp_type: string; name: string; description: string; rarity: string; progress?: number; target?: number }[]; total_earned: number; total_available: number },
    MailboxApiError
  >({
    queryKey: mailboxKeys.stamps(),
    queryFn: api.getStamps,
    staleTime: STALE_5M,
    ...options,
  });
}

export function useThemes(
  options?: Omit<
    UseQueryOptions<{ themes: SeasonalTheme[]; active: string }, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<{ themes: SeasonalTheme[]; active: string }, MailboxApiError>({
    queryKey: mailboxKeys.themes(),
    queryFn: api.getThemes,
    staleTime: STALE_5M,
    ...options,
  });
}

export function useSetActiveTheme(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.setActiveTheme,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.themes() });
    },
    ...options,
  });
}

// ============================================================
// MEMORY HOOKS (Phase 3)
// ============================================================

export function useMailMemories(
  options?: Omit<UseQueryOptions<MailMemory[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MailMemory[], MailboxApiError>({
    queryKey: mailboxKeys.memories(),
    queryFn: api.getMailMemories,
    staleTime: STALE_5M,
    ...options,
  });
}

export function useYearInMail(
  year: number,
  options?: Omit<UseQueryOptions<YearInMail, MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<YearInMail, MailboxApiError>({
    queryKey: mailboxKeys.yearInMail(year),
    queryFn: () => api.getYearInMail(year),
    staleTime: STALE_5M,
    enabled: year > 0,
    ...options,
  });
}

export function useDismissMemory(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.dismissMemory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.memories() });
    },
    ...options,
  });
}

// ============================================================
// TRAVEL HOOKS (Phase 3)
// ============================================================

export function useVacationHold(
  options?: Omit<
    UseQueryOptions<VacationHold | null, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<VacationHold | null, MailboxApiError>({
    queryKey: mailboxKeys.vacationHold(),
    queryFn: api.getVacationHold,
    staleTime: STALE_1M,
    ...options,
  });
}

export function useCreateVacationHold(
  options?: UseMutationOptions<
    VacationHold,
    MailboxApiError,
    {
      homeId: string;
      startDate: string;
      endDate: string;
      holdAction: HoldAction;
      packageAction: PackageHoldAction;
      autoNeighborRequest?: boolean;
    }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    VacationHold,
    MailboxApiError,
    {
      homeId: string;
      startDate: string;
      endDate: string;
      holdAction: HoldAction;
      packageAction: PackageHoldAction;
      autoNeighborRequest?: boolean;
    }
  >({
    mutationFn: api.createVacationHold,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.vacationHold() });
    },
    ...options,
  });
}

export function useCancelVacationHold(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.cancelVacationHold,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mailboxKeys.vacationHold() });
    },
    ...options,
  });
}

// ============================================================
// RECENTLY DELETED HOOKS
// ============================================================

export function useDeletedMail(
  options?: Omit<UseQueryOptions<DeletedMail[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DeletedMail[], MailboxApiError>({
    queryKey: mailboxKeys.deleted(),
    queryFn: api.getDeletedMail,
    ...options,
  });
}

/** Restore a deleted or dismissed letter; it returns to every list and count. */
export function useRestoreMail(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.restoreMail,
    onSuccess: (_data, itemId) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.deleted() });
      qc.invalidateQueries({ queryKey: mailboxKeys.itemDetail(itemId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.mailDaySummary() });
      qc.invalidateQueries({ queryKey: [...mailboxKeys.all, 'drawer'] });
      qc.invalidateQueries({ queryKey: mailboxKeys.counter() });
    },
    ...options,
  });
}
