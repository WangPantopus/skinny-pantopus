// ============================================================
// MAILBOX ENDPOINTS
// Digital mailbox and advertising campaigns
// ============================================================

import { get, post, put, del, patch } from '../client';
import type { Mail, AdCampaign, ApiResponse } from '@pantopus/types';

export interface MailboxSummary {
  total_mail: number;
  unread_count: number;
  ad_count: number;
  unread_ad_count: number;
  starred_count: number;
  total_earned: number;
  pending_earnings: number;
}

export interface MailboxPagination {
  limit: number;
  offset: number;
  total: number;
}

export type MailboxScope = 'personal' | 'home' | 'all';

export interface MailboxSeedResult {
  message: string;
  insertedCount: number;
  summary: {
    unread: number;
    ads: number;
    starred: number;
  };
  mail: Array<Pick<Mail, 'id' | 'type' | 'subject' | 'viewed' | 'archived' | 'starred' | 'payout_amount' | 'created_at'>>;
}

export interface MailReadSessionStartResult {
  success: boolean;
  sessionId?: string;
  mailId?: string;
  error?: string;
}

export interface MailReadSessionCloseResult {
  success: boolean;
  sessionId?: string;
  mailId?: string;
  activeTimeMs?: number;
  error?: string;
}

export interface MailLink {
  id: string;
  mail_item_id: string;
  target_type: 'bill' | 'issue' | 'package' | 'document';
  target_id: string;
  created_by: 'system' | 'user';
  status: 'active' | 'undone';
  created_at: string;
  updated_at: string;
}

export type StructuredMailSendPayload = {
  destination?: {
    deliveryTargetType: 'home' | 'user';
    homeId: string;
    userId?: string;
    attnUserId?: string;
    attnLabel?: string;
    visibility?: 'home_members' | 'attn_only' | 'attn_plus_admins';
  };
  recipient?: {
    mode?: 'self' | 'user' | 'home';
    userId?: string;
    homeId?: string;
  };
  envelope?: {
    type?: Mail['type'];
    subject?: string;
    attachments?: string[];
    senderBusinessName?: string;
    senderAddress?: string;
    payoutAmount?: number;
    category?: string;
    tags?: string[];
    priority?: Mail['priority'];
    expiresAt?: string;
  };
  object?: {
    format?: 'mailjson_v1' | 'html' | 'markdown' | 'plain_text' | 'pdf' | 'binary';
    mimeType?: string;
    title?: string;
    content?: string;
    attachments?: string[];
    payload?: Record<string, unknown>;
  };
  policy?: {
    payoutAmount?: number;
  };
  tracking?: Record<string, unknown>;
};

export type LegacyMailSendPayload = {
  recipientUserId?: string;
  recipientHomeId?: string;
  destination?: {
    deliveryTargetType: 'home' | 'user';
    homeId: string;
    userId?: string;
    attnUserId?: string;
    attnLabel?: string;
    visibility?: 'home_members' | 'attn_only' | 'attn_plus_admins';
  };
  type: Mail['type'];
  subject?: string;
  content: string;
  attachments?: string[];
  senderBusinessName?: string;
  senderAddress?: string;
  payoutAmount?: number;
  category?: string;
  tags?: string[];
  priority?: Mail['priority'];
  expiresAt?: string;
};

/**
 * Get user's mailbox
 */
export async function getMailbox(filters?: {
  type?: Mail['type'];
  viewed?: boolean | string;
  archived?: boolean | string;
  starred?: boolean | string;
  scope?: MailboxScope;
  homeId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ 
  mail: Mail[];
  summary: MailboxSummary;
  pagination: MailboxPagination;
  scope?: MailboxScope;
  homeId?: string | null;
}> {
  return get<{ 
    mail: Mail[]; 
    summary: MailboxSummary;
    pagination: MailboxPagination;
    scope?: MailboxScope;
    homeId?: string | null;
  }>('/api/mailbox', filters);
}

/**
 * Get a single mail item
 */
export async function getMail(mailId: string): Promise<{ mail: Mail }> {
  return get<{ mail: Mail }>(`/api/mailbox/${mailId}`);
}

/**
 * Get fanout links for a mail item
 */
export async function getMailLinks(mailId: string): Promise<{ links: MailLink[] }> {
  return get<{ links: MailLink[] }>(`/api/mailbox/${mailId}/links`);
}

/**
 * Get inbox summary counts for InboxEarnCard
 */
export async function getSummary(params?: {
  scope?: string;
  homeId?: string;
}): Promise<{ total: number; unread: number; bills: number; notices: number; offers: number }> {
  const searchParams = new URLSearchParams();
  if (params?.scope) searchParams.append('scope', params.scope);
  if (params?.homeId) searchParams.append('homeId', params.homeId);
  const qs = searchParams.toString();
  return get(`/mailbox/summary${qs ? `?${qs}` : ''}`);
}

/**
 * Mark mail as read/viewed (earns credits for ads)
 */
export async function markMailAsRead(mailId: string): Promise<{ 
  message: string;
  alreadyViewed: boolean;
  payout: number;
  viewedAt?: string;
}> {
  return patch<{ message: string; alreadyViewed: boolean; payout: number; viewedAt?: string }>(`/api/mailbox/${mailId}/view`);
}

/**
 * Delete mail
 */
export async function deleteMail(mailId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/mailbox/${mailId}`);
}

/**
 * Toggle star on a mail item
 */
export async function starMail(mailId: string, starred?: boolean): Promise<{ message: string }> {
  return patch<{ message: string }>(`/api/mailbox/${mailId}/star`, { starred });
}

/**
 * Send mail to an address
 */
export async function sendMail(data: LegacyMailSendPayload | StructuredMailSendPayload): Promise<{
  message: string;
  mail: {
    id: string;
    type: Mail['type'];
    subject: string | null;
    mailType?: Mail['mail_type'] | null;
    displayTitle?: string | null;
    previewText?: string | null;
    primaryAction?: Mail['primary_action'] | null;
    actionRequired?: boolean;
    recipientUserId?: string | null;
    recipientHomeId?: string | null;
    addressHomeId?: string | null;
    deliveryTargetType?: 'home' | 'user' | null;
    deliveryTargetId?: string | null;
    attnUserId?: string | null;
    attnLabel?: string | null;
    deliveryVisibility?: 'home_members' | 'attn_only' | 'attn_plus_admins' | null;
    createdAt: string;
  };
}> {
  return post<{
    message: string;
    mail: {
      id: string;
      type: Mail['type'];
      subject: string | null;
      mailType?: Mail['mail_type'] | null;
      displayTitle?: string | null;
      previewText?: string | null;
      primaryAction?: Mail['primary_action'] | null;
      actionRequired?: boolean;
      recipientUserId?: string | null;
      recipientHomeId?: string | null;
      addressHomeId?: string | null;
      deliveryTargetType?: 'home' | 'user' | null;
      deliveryTargetId?: string | null;
      attnUserId?: string | null;
      attnLabel?: string | null;
      deliveryVisibility?: 'home_members' | 'attn_only' | 'attn_plus_admins' | null;
      createdAt: string;
    };
  }>('/api/mailbox/send', data);
}

/**
 * Get unread mail count
 */
export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  const { summary } = await getMailbox({ viewed: false, limit: 1, offset: 0 });
  return { unreadCount: summary.unread_count || 0 };
}

/**
 * Mark all mail as read
 */
export async function markAllAsRead(): Promise<ApiResponse> {
  let offset = 0;
  const limit = 100;
  let markedCount = 0;

  while (true) {
    const { mail } = await getMailbox({ viewed: false, archived: false, limit, offset });
    if (!mail.length) break;

    await Promise.all(mail.map((item) => markMailAsRead(item.id)));
    markedCount += mail.length;

    if (mail.length < limit) break;
    offset += limit;
  }

  return { message: `Marked ${markedCount} mail item(s) as read` };
}

// ============ AD CAMPAIGN ENDPOINTS ============

/**
 * Create an advertising campaign
 */
export async function createAdCampaign(data: {
  name: string;
  description?: string;
  targetCities?: string[];
  targetStates?: string[];
  targetZipcodes?: string[];
  targetLocation?: {
    latitude: number;
    longitude: number;
  };
  targetRadiusMeters?: number;
  budgetTotal: number;
  pricePerView?: number;
  startsAt?: string;
  endsAt?: string;
}): Promise<{ message: string; campaign: AdCampaign }> {
  return post<{ message: string; campaign: AdCampaign }>('/api/mailbox/campaigns', data);
}

/**
 * Get user's ad campaigns
 */
export async function getAdCampaigns(filters?: {
  status?: 'draft' | 'active' | 'paused' | 'completed';
  page?: number;
  limit?: number;
}): Promise<{ 
  campaigns: AdCampaign[];
}> {
  return get<{ campaigns: AdCampaign[] }>('/api/mailbox/campaigns', filters);
}

/**
 * Get a specific ad campaign
 */
export async function getAdCampaign(campaignId: string): Promise<{ 
  campaign: AdCampaign;
}> {
  return getAdCampaigns().then((result) => ({
    campaign: result.campaigns.find((campaign) => campaign.id === campaignId) as AdCampaign,
  }));
}

/**
 * Update ad campaign
 */
export async function updateAdCampaign(
  campaignId: string,
  data: Partial<{
    campaign_name: string;
    description: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    budget_total: number;
    end_date: string;
  }>
): Promise<{ campaign: AdCampaign }> {
  return put<{ campaign: AdCampaign }>(`/api/mailbox/campaigns/${campaignId}`, data as any);
}

/**
 * Delete/cancel ad campaign
 */
export async function deleteAdCampaign(campaignId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/mailbox/campaigns/${campaignId}`);
}

/**
 * Pause ad campaign
 */
export async function pauseAdCampaign(campaignId: string): Promise<{ 
  campaign: AdCampaign;
}> {
  return post<{ campaign: AdCampaign }>(`/api/mailbox/campaigns/${campaignId}/pause`);
}

/**
 * Resume ad campaign
 */
export async function resumeAdCampaign(campaignId: string): Promise<{ 
  campaign: AdCampaign;
}> {
  return post<{ campaign: AdCampaign }>(`/api/mailbox/campaigns/${campaignId}/resume`);
}

/**
 * Get ad campaign statistics
 */
export async function getAdCampaignStats(campaignId: string): Promise<{ 
  stats: {
    total_sent: number;
    total_viewed: number;
    view_rate: number;
    budget_spent: number;
    budget_remaining: number;
    cost_per_view_actual: number;
    impressions: number;
  };
}> {
  return get<{ stats: any }>(`/api/mailbox/campaigns/${campaignId}/stats`);
}

/**
 * Get user's ad viewing earnings
 */
export async function getAdEarnings(): Promise<{ 
  totalEarned: number;
  pendingEarnings: number;
  currency: string;
}> {
  return get<{ 
    totalEarned: number;
    pendingEarnings: number;
    currency: string;
  }>('/api/mailbox/earnings/summary');
}

/**
 * Search mail
 */
export async function searchMail(query: string, filters?: {
  type?: Mail['type'];
  viewed?: boolean;
  archived?: boolean;
  starred?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ 
  mail: Mail[];
  total: number;
}> {
  return getMailbox({
    ...filters,
  }).then((result) => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? result.mail.filter((item) => {
          const subject = (item.subject || '').toLowerCase();
          const sender = (item.sender_business_name || item.sender_address || '').toLowerCase();
          const content = (item.content || '').toLowerCase();
          return subject.includes(normalizedQuery) || sender.includes(normalizedQuery) || content.includes(normalizedQuery);
        })
      : result.mail;

    return { mail: filtered, total: filtered.length };
  });
}

/**
 * Archive mail
 */
export async function archiveMail(mailId: string): Promise<ApiResponse> {
  return patch<ApiResponse>(`/api/mailbox/${mailId}/archive`, { archived: true });
}

/**
 * Unarchive mail
 */
export async function unarchiveMail(mailId: string): Promise<ApiResponse> {
  return patch<ApiResponse>(`/api/mailbox/${mailId}/archive`, { archived: false });
}

/**
 * Get archived mail
 */
export async function getArchivedMail(): Promise<{ mail: Mail[] }> {
  return getMailbox({ archived: true }).then((result) => ({ mail: result.mail }));
}

/**
 * Start a read session for dwell-time analytics
 */
export async function startMailReadSession(
  mailId: string,
  clientMeta?: Record<string, any>
): Promise<MailReadSessionStartResult> {
  return post<MailReadSessionStartResult>(`/api/mailbox/${mailId}/read/start`, {
    clientMeta: clientMeta || {}
  });
}

/**
 * Close a read session and flush analytics
 */
export async function closeMailReadSession(
  sessionId: string,
  payload?: {
    activeTimeMs?: number;
    maxScrollPercent?: number;
    eventMeta?: Record<string, any>;
  }
): Promise<MailReadSessionCloseResult> {
  return post<MailReadSessionCloseResult>(`/api/mailbox/read/${sessionId}/close`, {
    activeTimeMs: payload?.activeTimeMs || 0,
    maxScrollPercent: payload?.maxScrollPercent,
    eventMeta: payload?.eventMeta || {}
  });
}

/**
 * Acknowledge a notice/certified mail item
 */
export async function acknowledgeMail(mailId: string): Promise<{
  message: string;
  ackStatus: 'pending' | 'acknowledged';
}> {
  return patch<{
    message: string;
    ackStatus: 'pending' | 'acknowledged';
  }>(`/api/mailbox/${mailId}/ack`);
}

/**
 * Create a fanout link for a mail item
 */
export async function createMailLink(
  mailId: string,
  data: {
    targetType: 'bill' | 'issue' | 'package' | 'document';
    targetId: string;
    createdBy?: 'system' | 'user';
  }
): Promise<{ message: string; link: MailLink }> {
  return post<{ message: string; link: MailLink }>(`/api/mailbox/${mailId}/links`, data);
}

// ============ PREFERENCES ENDPOINTS ============

export interface MailPreferences {
  user_id: string;
  receive_ads: boolean;
  receive_promotions: boolean;
  receive_newsletters: boolean;
  max_ads_per_day: number;
  preferred_ad_categories: string[];
  blocked_senders: string[];
  email_notifications: boolean;
  push_notifications: boolean;
  updated_at: string;
}

/**
 * Get user's mail & notification preferences
 */
export async function getPreferences(): Promise<{ preferences: MailPreferences }> {
  return get<{ preferences: MailPreferences }>('/api/mailbox/preferences');
}

/**
 * Update user's mail & notification preferences
 */
export async function updatePreferences(data: Partial<Pick<MailPreferences,
  | 'receive_ads'
  | 'receive_promotions'
  | 'receive_newsletters'
  | 'max_ads_per_day'
  | 'preferred_ad_categories'
  | 'blocked_senders'
  | 'email_notifications'
  | 'push_notifications'
>> & Partial<{
  receiveAds: boolean;
  receivePromotions: boolean;
  receiveNewsletters: boolean;
  maxAdsPerDay: number;
  preferredAdCategories: string[];
  blockedSenders: string[];
  emailNotifications: boolean;
  pushNotifications: boolean;
}>): Promise<{ message: string; preferences: MailPreferences }> {
  return patch<{ message: string; preferences: MailPreferences }>('/api/mailbox/preferences', data);
}

/**
 * Seed mailbox with local test data (development only)
 */
export async function seedMailboxTestData(options?: {
  count?: number;
  clearExisting?: boolean;
}): Promise<MailboxSeedResult> {
  return post<MailboxSeedResult>('/api/mailbox/seed/test-data', options || {});
}
