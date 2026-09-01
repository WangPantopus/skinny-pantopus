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
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import * as api from '@/lib/mailbox-api';
import { MailboxApiError } from '@/lib/mailbox-api';
import type { AssetFullDetail } from '@/lib/mailbox-api';

import type {
  DrawerMeta,
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

  // Translation
  translation: (itemId: string) =>
    [...mailboxKeys.all, 'translation', itemId] as const,
  languageDetect: (itemId: string) =>
    [...mailboxKeys.all, 'language', itemId] as const,

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

export function useDrawerMeta(
  options?: Omit<UseQueryOptions<DrawerMeta[], MailboxApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DrawerMeta[], MailboxApiError>({
    queryKey: mailboxKeys.drawers(),
    queryFn: api.getDrawerMeta,
    staleTime: STALE_30S,
    ...options,
  });
}

export function useDrawerItems(
  drawer: 'personal' | 'home' | 'business' | 'earn',
  params?: { page?: number; limit?: number; filter?: string },
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
    mutationFn: api.markItemOpened,
    onSuccess: (_data, itemId) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.drawers() });
      qc.invalidateQueries({ queryKey: mailboxKeys.itemDetail(itemId) });
      qc.invalidateQueries({ queryKey: mailboxKeys.counter() });
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
    { label: string; icon: string; color: string; drawer: 'personal' | 'home' | 'business' | 'earn'; autoFileRules?: AutoFileRule[] }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    VaultFolder,
    MailboxApiError,
    { label: string; icon: string; color: string; drawer: 'personal' | 'home' | 'business' | 'earn'; autoFileRules?: AutoFileRule[] }
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
// TRANSLATION HOOKS
// ============================================================

export function useDetectLanguage(
  itemId: string,
  options?: Omit<
    UseQueryOptions<{ detected_language: string; confidence: number }, MailboxApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<{ detected_language: string; confidence: number }, MailboxApiError>({
    queryKey: mailboxKeys.languageDetect(itemId),
    queryFn: () => api.detectLanguage(itemId),
    staleTime: STALE_5M,
    enabled: !!itemId,
    ...options,
  });
}

export function useTranslateItem(
  options?: UseMutationOptions<
    { translated_content: string; from_language: string },
    MailboxApiError,
    { itemId: string; targetLang?: string }
  >,
) {
  const qc = useQueryClient();
  return useMutation<
    { translated_content: string; from_language: string },
    MailboxApiError,
    { itemId: string; targetLang?: string }
  >({
    mutationFn: ({ itemId, targetLang }) => api.translateItem(itemId, targetLang),
    onSuccess: (_data, { itemId }) => {
      qc.invalidateQueries({ queryKey: mailboxKeys.translation(itemId) });
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

export function useAddPinToCalendar(
  options?: UseMutationOptions<void, MailboxApiError, string>,
) {
  return useMutation<void, MailboxApiError, string>({
    mutationFn: api.addPinToCalendar,
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

export function useDismissMailDaySummary(
  options?: UseMutationOptions<void, MailboxApiError, void>,
) {
  const qc = useQueryClient();
  return useMutation<void, MailboxApiError, void>({
    mutationFn: api.dismissMailDaySummary,
    onSuccess: () => {
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
