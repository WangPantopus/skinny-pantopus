// ============================================================
// MAILBOX API CLIENT
//
// Typed API functions for the Pantopus web mailbox.
// Uses the existing @pantopus/api Axios client — no new HTTP lib.
//
// Every function throws MailboxApiError on failure.
// ============================================================

import { get, post, uploadFile, apiRequest } from '@pantopus/api';

/** PATCH helper — not barrel-exported from @pantopus/api */
function patch<T>(url: string, data?: Record<string, any>): Promise<T> {
  return apiRequest<T>('PATCH', url, data);
}

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
  ReactionType,
  AutoFileRule,
  HoldAction,
  PackageHoldAction,
} from '@/types/mailbox';

// ============================================================
// ERROR CLASS
// ============================================================

export class MailboxApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'MailboxApiError';
  }
}

// ── Helpers ──────────────────────────────────────────────────

type DrawerParam = 'personal' | 'home' | 'business' | 'earn';

/**
 * Wraps an API call so that every rejection becomes a MailboxApiError.
 * The existing Axios interceptor rejects with { message, statusCode, data }.
 */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof MailboxApiError) throw err;

    // Shape produced by @pantopus/api response interceptor
    const e = err as {
      message?: string;
      statusCode?: number;
      data?: { error?: string };
    };

    // Network-level failure (no response at all)
    if (!e.statusCode) {
      throw new MailboxApiError(
        'NETWORK_ERROR',
        e.message || 'Network error — unable to reach API',
        0,
        true,
      );
    }

    const code =
      e.statusCode === 401
        ? 'UNAUTHORIZED'
        : e.statusCode === 403
          ? 'FORBIDDEN'
          : e.statusCode === 404
            ? 'NOT_FOUND'
            : e.statusCode === 422
              ? 'VALIDATION_ERROR'
              : e.statusCode >= 500
                ? 'SERVER_ERROR'
                : 'REQUEST_ERROR';

    throw new MailboxApiError(
      code,
      e.message || e.data?.error || 'An error occurred',
      e.statusCode,
      e.statusCode >= 500,
    );
  }
}

// ============================================================
// DRAWERS
// ============================================================

export async function getDrawerMeta(): Promise<DrawerMeta[]> {
  return call(async () => {
    const res = await get<{ drawers: DrawerMeta[] }>('/api/mailbox/v2/drawers');
    return res.drawers;
  });
}

export async function getDrawerItems(
  drawer: DrawerParam,
  params?: { page?: number; limit?: number; filter?: string },
): Promise<MailboxPaginatedResponse<MailItemV2>> {
  return call(async () => {
    const res = await get<{ mail: MailItemV2[]; total: number; drawer: string }>(
      `/api/mailbox/v2/drawer/${drawer}`,
      {
        limit: params?.limit ?? 20,
        offset: params?.page ? (params.page - 1) * (params.limit ?? 20) : 0,
        ...(params?.filter ? { filter: params.filter } : {}),
      },
    );
    const limit = params?.limit ?? 20;
    const page = params?.page ?? 1;
    return {
      items: res.mail,
      total: res.total,
      page,
      has_more: page * limit < res.total,
    };
  });
}

export async function getItemDetail(itemId: string): Promise<MailItemDetailResponse> {
  return call(async () => {
    const res = await get<{ mail: MailItemV2 }>(`/api/mailbox/v2/item/${itemId}`);
    // Map the flat MailItemV2 into the wrapper/inside/policy shape
    const mail = res.mail;
    return {
      wrapper: {
        id: mail.id,
        drawer: mail.drawer,
        mail_object_type: mail.mail_object_type,
        sender_display: mail.sender_display || '',
        sender_logo_url: mail.sender_logo_url,
        sender_trust: mail.sender_trust,
        sender_user_id: mail.sender_user_id,
        recipient_user_id: mail.recipient_user_id,
        recipient_home_id: mail.recipient_home_id,
        recipient_name: mail.recipient_name,
        outside_title: mail.display_title || mail.subject || '',
        preview_text: mail.preview_text,
        urgency: mail.urgency,
        privacy: mail.privacy,
        lifecycle: mail.lifecycle,
        category: mail.category as MailItemDetailResponse['wrapper']['category'],
        starred: mail.starred ?? false,
        created_at: mail.created_at,
        opened_at: mail.opened_at,
      },
      inside: {
        mail_id: mail.id,
        blocks: mail.content
          ? [{ id: `${mail.id}-text`, order: 0, type: 'text' as const, format: 'plain' as const, content: mail.content }]
          : [],
        actions: [],
        key_facts: typeof mail.key_facts === 'string'
          ? JSON.parse(mail.key_facts || '[]')
          : (mail.key_facts ?? []),
        attachments: (mail.attachments ?? []).map((url, i) => ({
          id: `${mail.id}-att-${i}`,
          filename: url.split('/').pop() || 'attachment',
          url,
          mime_type: 'application/octet-stream',
          size_bytes: 0,
        })),
      },
      policy: {
        requires_acknowledgment: false,
        certified: false,
      },
    };
  });
}

export async function markItemOpened(itemId: string): Promise<void> {
  return call(async () => {
    await post(`/api/mailbox/v2/item/${itemId}/action`, { action: 'open' });
  });
}

export async function fileItemToVault(itemId: string, folderId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p2/vault/file', { mailId: itemId, folderId });
  });
}

// ============================================================
// COUNTER
// ============================================================

export async function getCounterItems(): Promise<MailItemV2[]> {
  return call(async () => {
    const res = await get<{ items: MailItemV2[] }>('/api/mailbox/v2/counter');
    return res.items;
  });
}

// ============================================================
// BUNDLES
// ============================================================

export async function expandBundle(bundleId: string): Promise<MailItemV2[]> {
  return call(async () => {
    const res = await get<{ bundle: unknown; items: MailItemV2[] }>(
      `/api/mailbox/v2/p2/bundle/${bundleId}/items`,
    );
    return res.items;
  });
}

export async function fileAllBundleItems(bundleId: string, folderId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p2/bundle/action', {
      bundleId,
      action: 'file_all',
      folderId,
    });
  });
}

export async function extractFromBundle(bundleId: string, itemId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p2/bundle/action', {
      bundleId,
      action: 'extract_item',
      itemId,
    });
  });
}

// ============================================================
// CERTIFIED MAIL
// ============================================================

export async function acknowledgeCertifiedMail(itemId: string): Promise<{
  acknowledged_at: string;
  audit_trail: AuditEvent[];
  proof_pdf_url: string;
}> {
  return call(async () => {
    const res = await post<{
      message: string;
      acknowledgedAt: string;
      routedTo: string;
      auditTrail: AuditEvent[];
    }>('/api/mailbox/v2/p2/certified/acknowledge', { mailId: itemId });

    // Also fetch proof URL
    const proof = await get<{ proof: Record<string, any> }>(
      `/api/mailbox/v2/p2/certified/${itemId}/proof`,
    );

    return {
      acknowledged_at: res.acknowledgedAt,
      audit_trail: res.auditTrail,
      proof_pdf_url: (proof.proof?.url as string) ?? '',
    };
  });
}

// ============================================================
// VAULT
// ============================================================

export async function getVaultFolders(): Promise<VaultFolder[]> {
  return call(async () => {
    const res = await get<{
      folders: VaultFolder[];
      grouped: Record<string, VaultFolder[]>;
    }>('/api/mailbox/v2/p2/vault/folders');
    return res.folders;
  });
}

export async function getFolderItems(
  folderId: string,
  params?: { page?: number; limit?: number },
): Promise<MailboxPaginatedResponse<MailItemV2>> {
  return call(async () => {
    const limit = params?.limit ?? 20;
    const page = params?.page ?? 1;
    const res = await get<{ items: MailItemV2[]; total: number }>(
      `/api/mailbox/v2/p2/vault/folder/${folderId}/items`,
      { limit, offset: (page - 1) * limit },
    );
    return {
      items: res.items,
      total: res.total,
      page,
      has_more: page * limit < res.total,
    };
  });
}

export async function searchVault(query: string): Promise<VaultSearchResult[]> {
  return call(async () => {
    const res = await get<{
      results: VaultSearchResult[];
      total: number;
      query: string;
    }>('/api/mailbox/v2/p2/vault/search', { q: query });
    return res.results;
  });
}

export async function createVaultFolder(data: {
  label: string;
  icon: string;
  color: string;
  drawer: DrawerParam;
  autoFileRules?: AutoFileRule[];
}): Promise<VaultFolder> {
  return call(async () => {
    const res = await post<{ folder: VaultFolder }>(
      '/api/mailbox/v2/p2/vault/folder',
      data,
    );
    return res.folder;
  });
}

// ============================================================
// EARN
// ============================================================

export async function getEarnWallet(): Promise<EarnWallet> {
  return call(async () => {
    const res = await get<{ wallet: { balance: number; lifetime_withdrawals: number; lifetime_received: number } }>(
      '/api/wallet',
    );
    return {
      available_balance: res.wallet.balance / 100,
      pending_balance: 0,
      lifetime_earned: res.wallet.lifetime_received / 100,
      lifetime_saved: 0,
      withdrawal_threshold: 1,
    };
  });
}

export async function getWalletTransactions(
  params?: { page?: number; limit?: number },
): Promise<MailboxPaginatedResponse<WalletTransaction>> {
  return call(async () => {
    const limit = params?.limit ?? 20;
    const page = params?.page ?? 1;
    const res = await get<{ transactions: Array<WalletTransaction & { direction?: string }>; total: number }>(
      '/api/wallet/transactions',
      { limit, offset: (page - 1) * limit },
    );
    return {
      items: res.transactions.map(tx => ({
        ...tx,
        // Canonical wallet stores cents; convert to dollars for legacy consumers
        amount: (tx.direction === 'debit' ? -1 : 1) * (tx.amount / 100),
      })),
      total: res.total,
      page,
      has_more: page * limit < res.total,
    };
  });
}

export async function initiateWithdrawal(data: {
  amount: number;
  method: 'pantopus_credit' | 'bank_transfer' | 'gift_card';
}): Promise<{ status: string; estimated_days?: number }> {
  return call(async () => {
    // Canonical wallet expects cents; legacy callers send dollars
    const amountCents = Math.round(data.amount * 100);
    const res = await post<{ transaction: WalletTransaction; message: string }>(
      '/api/wallet/withdraw',
      { amount: amountCents },
    );
    return {
      status: res.transaction.status,
      estimated_days: data.method === 'bank_transfer' ? 3 : undefined,
    };
  });
}

export async function engageOffer(itemId: string): Promise<{ earn_amount: number }> {
  return call(async () => {
    const res = await post<{
      message: string;
      amount?: number;
      status?: string;
      alreadyOpened?: boolean;
      capped?: boolean;
    }>('/api/mailbox/v2/earn/open', { offerId: itemId });
    return { earn_amount: res.amount ?? 0 };
  });
}

export async function redeemOffer(
  itemId: string,
  mode: string,
): Promise<OfferRedemption> {
  return call(async () => {
    // Initiate browse to get merchant info, then reveal code
    const browse = await post<{
      offer: unknown;
      merchantOnPantopus: boolean;
      discountType: string;
      discountValue: number;
    }>('/api/mailbox/v2/p2/coupon/browse', { offerId: itemId });

    if (mode === 'code_reveal') {
      const reveal = await post<{ code: string | null }>(
        `/api/mailbox/v2/earn/reveal/${itemId}`,
      );
      return {
        id: itemId,
        offer_id: itemId,
        user_id: '',
        redemption_type: 'code_reveal' as const,
        code: reveal.code ?? undefined,
        code_revealed_at: new Date().toISOString(),
        status: 'redeemed' as const,
        created_at: new Date().toISOString(),
        redeemed_at: new Date().toISOString(),
      };
    }

    if (mode === 'save') {
      await post(`/api/mailbox/v2/p2/coupon/save`, { offerId: itemId });
      return {
        id: itemId,
        offer_id: itemId,
        user_id: '',
        redemption_type: 'save' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };
    }

    // Default: in_store_qr
    const qr = await get<{ qrCodeUrl?: string; code?: string }>(
      `/api/mailbox/v2/p2/coupon/qr/${itemId}`,
    );
    return {
      id: itemId,
      offer_id: itemId,
      user_id: '',
      redemption_type: 'in_store_qr' as const,
      code: qr.code ?? undefined,
      status: 'redeemed' as const,
      created_at: new Date().toISOString(),
      redeemed_at: new Date().toISOString(),
      discount_applied: browse.discountValue,
    };
  });
}

// ============================================================
// TRANSLATION
// ============================================================

export async function detectLanguage(
  itemId: string,
): Promise<{ detected_language: string; confidence: number }> {
  return call(async () => {
    // The translate endpoint auto-detects
    const res = await post<{
      translated_text: string;
      from_language: string;
      to_language: string;
      cached: boolean;
    }>('/api/mailbox/v2/p3/translate', { mailId: itemId });
    return {
      detected_language: res.from_language,
      confidence: 1.0,
    };
  });
}

export async function translateItem(
  itemId: string,
  targetLang?: string,
): Promise<{ translated_content: string; from_language: string }> {
  return call(async () => {
    const res = await post<{
      translated_text: string;
      from_language: string;
      to_language: string;
      cached: boolean;
    }>('/api/mailbox/v2/p3/translate', {
      mailId: itemId,
      ...(targetLang ? { targetLang } : {}),
    });
    return {
      translated_content: res.translated_text,
      from_language: res.from_language,
    };
  });
}

// ============================================================
// RECORDS (Phase 3)
// ============================================================

export async function getHomeAssets(homeId: string): Promise<HomeAsset[]> {
  return call(async () => {
    const res = await get<{
      assets: HomeAsset[];
      rooms: string[];
    }>('/api/mailbox/v2/p3/records/assets', { homeId });
    // HomeAssetSummary → HomeAsset (same shape for list)
    return res.assets as unknown as HomeAsset[];
  });
}

export async function getAssetDetail(assetId: string): Promise<HomeAsset> {
  return call(async () => {
    const res = await get<{
      asset: HomeAsset;
      mail: MailItemV2[];
      gigs: { id: string; title: string; status: string; created_at: string }[];
      photos: AssetPhoto[];
    }>(`/api/mailbox/v2/p3/records/asset/${assetId}/mail`);
    return res.asset;
  });
}

export type AssetFullDetail = {
  asset: HomeAsset;
  mail: MailItemV2[];
  gigs: { id: string; title: string; status: string; created_at: string }[];
  photos: AssetPhoto[];
};

export async function getAssetFullDetail(assetId: string): Promise<AssetFullDetail> {
  return call(async () => {
    return get<AssetFullDetail>(`/api/mailbox/v2/p3/records/asset/${assetId}/mail`);
  });
}

export async function createAsset(data: {
  homeId: string;
  name: string;
  category: HomeAsset['category'];
  room?: string;
  manufacturer?: string;
  model_number?: string;
}): Promise<HomeAsset> {
  return call(async () => {
    const res = await post<{ asset: HomeAsset }>(
      '/api/mailbox/v2/p3/records/assets',
      data,
    );
    return res.asset;
  });
}

export async function linkMailToAsset(
  assetId: string,
  itemId: string,
  linkType?: string,
): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/records/link', {
      mailId: itemId,
      assetId,
      ...(linkType ? { linkType } : {}),
    });
  });
}

export async function addAssetPhoto(
  assetId: string,
  file: File,
): Promise<AssetPhoto> {
  return call(async () => {
    const res = await uploadFile<{ photo: AssetPhoto }>(
      `/api/mailbox/v2/p3/records/asset/${assetId}/photos`,
      file,
    );
    return res.photo;
  });
}

// ============================================================
// MAP (Phase 3)
// ============================================================

export async function getMapPins(
  homeId: string,
  params?: { type?: string; bounds?: { north: number; south: number; east: number; west: number } },
): Promise<HomeMapPin[]> {
  return call(async () => {
    const res = await get<{ pins: HomeMapPin[] }>(
      '/api/mailbox/v2/p3/map/pins',
      { homeId, ...params },
    );
    return res.pins;
  });
}

export async function addPinToCalendar(pinId: string): Promise<void> {
  return call(async () => {
    await post(`/api/mailbox/v2/p3/map/pin/${pinId}/calendar`);
  });
}

// ============================================================
// COMMUNITY (Phase 3)
// ============================================================

export async function getCommunityItems(
  params?: { homeId?: string; type?: string; limit?: number; offset?: number },
): Promise<CommunityMailItem[]> {
  return call(async () => {
    const res = await get<{ items: CommunityMailItem[]; total: number }>(
      '/api/mailbox/v2/p3/community/feed',
      params,
    );
    return res.items;
  });
}

export async function publishToCommunity(
  itemId: string,
  scope: 'building' | 'neighborhood' | 'city',
  commentary?: string,
): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/community/publish', {
      mailId: itemId,
      publishedTo: scope,
      ...(commentary ? { commentary } : {}),
    });
  });
}

export async function reactToCommunityItem(
  itemId: string,
  reaction: ReactionType,
): Promise<CommunityReactionCount[]> {
  return call(async () => {
    const res = await post<{
      message: string;
      reactions: CommunityReactionCount[];
    }>('/api/mailbox/v2/p3/community/react', {
      communityItemId: itemId,
      reactionType: reaction,
    });
    return res.reactions;
  });
}

export async function rsvpCommunityEvent(itemId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/community/rsvp', {
      communityItemId: itemId,
    });
  });
}

// ============================================================
// TASKS (Phase 3)
// ============================================================

export async function getTasks(
  homeId?: string,
): Promise<{ active: MailTask[]; completed: MailTask[] }> {
  return call(async () => {
    return get<{ active: MailTask[]; completed: MailTask[] }>(
      '/api/mailbox/v2/p3/tasks',
      homeId ? { homeId } : undefined,
    );
  });
}

export async function createTaskFromMail(data: {
  mailId: string;
  homeId: string;
  title: string;
  dueAt?: string;
  priority?: 'low' | 'medium' | 'high';
  description?: string;
}): Promise<MailTask> {
  return call(async () => {
    const res = await post<{ task: MailTask }>(
      '/api/mailbox/v2/p3/tasks/from-mail',
      data,
    );
    return res.task;
  });
}

export async function updateTask(
  taskId: string,
  updates: { status?: string; title?: string; priority?: string; dueAt?: string },
): Promise<MailTask> {
  return call(async () => {
    const res = await patch<{ task: MailTask }>(
      `/api/mailbox/v2/p3/tasks/${taskId}`,
      updates,
    );
    return res.task;
  });
}

export async function escalateTaskToGig(
  taskId: string,
  data?: { title?: string; description?: string; compensation?: number },
): Promise<{ gig_id: string }> {
  return call(async () => {
    const res = await post<{ gigId: string; title: string }>(
      `/api/mailbox/v2/p3/tasks/${taskId}/to-gig`,
      data ?? {},
    );
    return { gig_id: res.gigId };
  });
}

// ============================================================
// MAIL DAY (Phase 3)
// ============================================================

export async function getMailDaySummary(): Promise<MailDaySummary> {
  return call(async () => {
    return get<MailDaySummary>('/api/mailbox/v2/p3/mailday/summary');
  });
}

export async function dismissMailDaySummary(): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/mailday/summary/dismiss', {});
  });
}

export async function getMailDaySettings(): Promise<MailDaySettings> {
  return call(async () => {
    return get<MailDaySettings>('/api/mailbox/v2/p3/mailday/settings');
  });
}

export async function updateMailDaySettings(
  updates: Partial<MailDaySettings>,
): Promise<MailDaySettings> {
  return call(async () => {
    const res = await patch<{ settings: MailDaySettings }>(
      '/api/mailbox/v2/p3/mailday/settings',
      updates,
    );
    return res.settings;
  });
}

// ============================================================
// STAMPS & THEMES (Phase 3)
// ============================================================

export async function getStamps(): Promise<{
  earned: Stamp[];
  locked: { stamp_type: string; name: string; description: string; rarity: string; progress?: number; target?: number }[];
  total_earned: number;
  total_available: number;
}> {
  return call(async () => {
    return get('/api/mailbox/v2/p3/stamps');
  });
}

export async function getThemes(): Promise<{ themes: SeasonalTheme[]; active: string }> {
  return call(async () => {
    return get('/api/mailbox/v2/p3/themes');
  });
}

export async function setActiveTheme(themeId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/themes/apply', { themeId });
  });
}

// ============================================================
// MEMORY (Phase 3)
// ============================================================

export async function getMailMemories(): Promise<MailMemory[]> {
  return call(async () => {
    const res = await get<{ memories: MailMemory[] }>(
      '/api/mailbox/v2/p3/memory/on-this-day',
    );
    return res.memories as unknown as MailMemory[];
  });
}

export async function getYearInMail(year: number): Promise<YearInMail> {
  return call(async () => {
    return get<YearInMail>(`/api/mailbox/v2/p3/memory/year/${year}`);
  });
}

export async function dismissMemory(memoryId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/memory/dismiss', { memoryId });
  });
}

// ============================================================
// TRAVEL (Phase 3)
// ============================================================

export async function getVacationHold(): Promise<VacationHold | null> {
  return call(async () => {
    const res = await get<{
      active: VacationHold | null;
      upcoming: VacationHold | null;
    }>('/api/mailbox/v2/p3/vacation/status');
    return res.active ?? res.upcoming;
  });
}

export async function createVacationHold(data: {
  homeId: string;
  startDate: string;
  endDate: string;
  holdAction: HoldAction;
  packageAction: PackageHoldAction;
  autoNeighborRequest?: boolean;
}): Promise<VacationHold> {
  return call(async () => {
    const res = await post<{ hold: VacationHold }>(
      '/api/mailbox/v2/p3/vacation/start',
      data,
    );
    return res.hold;
  });
}

export async function cancelVacationHold(holdId: string): Promise<void> {
  return call(async () => {
    await post('/api/mailbox/v2/p3/vacation/cancel', { holdId });
  });
}
