// ============================================================
// MAILBOX ENDPOINTS
// Digital mailbox and advertising campaigns
// ============================================================

import { get, post, put, del, patch } from '../client';
import type { Mail, AdCampaign, ApiResponse } from '@pantopus/types';
import type { MailItemV2 } from './mailboxV2';

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
 * Delete mail. It hides for everyone who could see it and can be restored
 * until `restorable_until` (30 days).
 */
export async function deleteMail(mailId: string): Promise<ApiResponse & { restorable_until?: string }> {
  return del<ApiResponse & { restorable_until?: string }>(`/api/mailbox/${mailId}`);
}

/**
 * Restore a deleted letter (within 30 days) or a dismissed one.
 */
export async function restoreMail(mailId: string): Promise<{ message: string }> {
  return post<{ message: string }>(`/api/mailbox/${mailId}/restore`);
}

/** A letter in Recently deleted. */
export interface DeletedMail {
  id: string;
  display_title?: string | null;
  subject?: string | null;
  preview_text?: string | null;
  sender_business_name?: string | null;
  sender_address?: string | null;
  recipient_user_id?: string | null;
  recipient_home_id?: string | null;
  drawer?: string | null;
  created_at: string;
  deleted_at: string;
  deleted_by_name: string | null;
  deleted_by_me: boolean;
  restorable_until: string;
}

/**
 * Recently deleted: letters deleted in the last 30 days that the caller
 * could see, newest first.
 */
export async function getDeletedMail(): Promise<{ mail: DeletedMail[] }> {
  return get<{ mail: DeletedMail[] }>('/api/mailbox/deleted');
}

/**
 * Toggle star on a mail item
 */
export async function starMail(mailId: string, starred?: boolean): Promise<{ message: string }> {
  return patch<{ message: string }>(`/api/mailbox/${mailId}/star`, { starred });
}

export interface SenderBusiness {
  id: string;
  name: string;
  verified: boolean;
}

/**
 * The businesses the signed-in user may send mail as (business permission mail.send), for compose's "Send as".
 */
export async function getSenderBusinesses(): Promise<{ businesses: SenderBusiness[] }> {
  return get<{ businesses: SenderBusiness[] }>('/api/mailbox/sender-businesses');
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
    /** The business the letter went out as; null when it went out under the sender's own name. */
    senderBusinessName?: string | null;
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

// ============ CHRISTMAS CARDS (launch key holiday_cards) ============

/** One of the season's pictures. The website serves the picture itself, by id. */
export interface HolidayCardDesign {
  id: string;
  number: number;
  /** Printed under the picture. */
  caption: string;
  /** The card's paper colour, for the strip the app prints under the picture. */
  paper: string;
  /** The collection it's in (`HolidayCardCollection.id`). */
  collection?: string | null;
  /** The picture's height in px at 960 px wide. */
  height?: number | null;
  /** Its public page, /cards/<slug> (launch key card_table). */
  slug?: string | null;
  /** The colour of the cloth it lies on (launch key card_table). */
  table?: string | null;
  /** The whole verse printed on a Christmas with Jesus Christ picture ("Read the verse"); only those nine have it. */
  verse?: string | null;
}

/** A collection "Pick a card" shows: its name, who it's for, and its pictures in grid order. */
export interface HolidayCardCollection {
  id: string;
  name: string;
  /** One line under the row of collections. */
  line: string;
  /** Design ids, in grid order. */
  designs: string[];
}

/**
 * When a card comes: with the next 7 a.m. mail, the next morning sealed until Christmas morning, or on Christmas
 * morning. A card by email comes when they open it (`now`), sealed until Christmas or not.
 */
export type HolidayCardArrival = 'next_morning' | 'sealed_christmas' | 'christmas_morning' | 'now';

/** A card as its sender sees it: today's card, and the answer to sending one. */
export interface SentHolidayCard {
  id: string;
  design: string;
  /** Their name as they show it, or the masked email address. By link: "them" until someone opens it. */
  to_name: string | null;
  by_email: boolean;
  /** Sent as a link anyone can open (launch key card_table). `by_email` is true too, so older apps still show something sensible. */
  by_link?: boolean;
  arrival: HolidayCardArrival;
  /** When it goes into their mailbox; null by email (when they open the email). */
  arrives_at: string | null;
  /** The day it goes into their mailbox, by their clock ("2026-10-31"); null by email. */
  arrives_on?: string | null;
  /** Sealed until then. */
  opens_at: string | null;
  /** The carrier's next 7 a.m. pickup; null by email (until they open it). */
  take_back_until: string | null;
  can_take_back: boolean;
  status: 'waiting' | 'delivered' | 'claimed' | 'expired' | 'withdrawn';
  sent_at: string | null;
}

/**
 * The sender's signature beside FROM (design plan 8.2, launch key card_table): pen strokes in a w × h box (400 × 100),
 * x to the right, y down, whole numbers, each stroke [x, y, x, y, ...]. At most `max_bytes` as compact JSON.
 */
export interface CardSignature {
  w: number;
  h: number;
  strokes: number[][];
}

export interface HolidayCards {
  postage_enabled?: boolean;
  /** The server keeps a signature beside FROM: its box and most bytes. Absent: set the typed name. */
  signature?: { w: number; h: number; max_bytes: number };
  /** Digital stamps left (postage on; null when they couldn't be read). */
  stamps?: { available: number; free_remaining: number; paid_remaining: number } | null;
  /** Sending is open (until December 31 ends where you are). */
  open: boolean;
  holiday: string;
  year: number;
  closes_on: string;
  message_limit: number;
  /** Every picture, in number order. */
  designs: HolidayCardDesign[];
  /** The collections "Pick a card" shows, in order (none from a server before collections: one grid of every design). */
  collections?: HolidayCardCollection[];
  /** The arrivals open now, to a person and by email. */
  arrivals: { person: HolidayCardArrival[]; email: HolidayCardArrival[] };
  /** Your next 7 a.m. round and Christmas morning, where you are. */
  next_round_at: string;
  christmas_morning_at: string;
  time_zone: string;
  /** Today's card, once you've sent it (one a day). */
  today: SentHolidayCard | null;
  /** How many one card can go to at once: 20 with digital stamps on (a list, sendHolidayCardList), else 1. */
  max_recipients?: number;
}

/** GET /api/mailbox/cards */
export async function getHolidayCards(): Promise<HolidayCards> {
  return get<HolidayCards>('/api/mailbox/cards');
}

/** When a card to one person can come, by their clock rather than yours. */
export interface HolidayCardArrivalsFor {
  /** The arrivals open to them now. */
  arrivals: HolidayCardArrival[];
  /** The day of their next 7 a.m. mail where they live ("2026-10-31"). */
  next_round_on: string;
}

/** GET /api/mailbox/cards/arrivals?to=<user_id>: the same checks as sending them a card. */
export async function getHolidayCardArrivals(userId: string): Promise<HolidayCardArrivalsFor> {
  return get<HolidayCardArrivalsFor>('/api/mailbox/cards/arrivals', { to: userId });
}

/** POST /api/mailbox/cards: send today's card, to one person found by name, by email to someone not on Pantopus, or as a link (launch key card_table). */
export async function sendHolidayCard(data: {
  design: string;
  message: string;
  arrival: HolidayCardArrival;
  to: { user_id: string } | { email: string } | { link: true };
  /**
   * One per card draft, sent again with every look and retry of it: a repeat of a send answers with the card it
   * stored (200), CARD_TAKEN_BACK once that card was taken back, or CARD_REQUEST_SENT (with `card`) when the draft
   * changed after it went.
   */
  request_id?: string;
  /** Signed beside FROM (only when `HolidayCards.signature` is there); CARD_SIGNATURE_INVALID / _TOO_LONG refuse it. */
  signature?: CardSignature | null;
}): Promise<{ card: SentHolidayCard; link?: string }> {
  return post<{ card: SentHolidayCard; link?: string }>('/api/mailbox/cards', data);
}

/**
 * GET /api/mailbox/cards/:id/link (its sender only): the link of a card sent by link, while nobody has opened it. A 409
 * says, in words to show as they come, what happened to it instead.
 */
export async function getHolidayCardLink(cardId: string): Promise<{ link: string }> {
  return get<{ link: string }>(`/api/mailbox/cards/${encodeURIComponent(cardId)}/link`);
}

/**
 * What the other person will get, before it's sent: the same body and the same checks as sending it, with nothing
 * stored or sent.
 */
export interface HolidayCardPreview {
  /** Their Mailbox's piece for it, as sending it would store it: the name the card carries, its postmark by their clock. */
  piece: MailItemV2;
  /** The day it goes into their mailbox, by their clock; null by email. */
  arrives_on: string | null;
  /** Sealed cards: the day the seal lifts, and how many days it waits sealed in their mailbox. */
  opens_on: string | null;
  sealed_days: number | null;
  take_back_until: string | null;
  /** By email: the email they get, in its own words. */
  email: { subject: string; heading: string; lines: string[]; button: string; footnote: string; footer?: string[];
    /** The sealed envelope at its top (launch key card_table). */
    picture?: string } | null;
  /** By email: the page its link opens (the address masked, as on that page). */
  link_page: { sender_name: string; sender_verified: boolean; sealed: boolean; sent_to: string; sent_on: string; by_link?: boolean } | null;
}

/** POST /api/mailbox/cards/preview */
export async function previewHolidayCard(data: Parameters<typeof sendHolidayCard>[0]): Promise<HolidayCardPreview> {
  return post<HolidayCardPreview>('/api/mailbox/cards/preview', data);
}

/**
 * One card to a list (digital stamps on): the same picture and note for up to `max_recipients` people or addresses,
 * each its own card under its own request ID (kept for every look and retry). One choice of arrival for the list: an
 * address reads "next_morning" as right away and "christmas_morning" as sealed until Christmas.
 */
export interface HolidayCardList {
  design: string;
  message: string;
  arrival: HolidayCardArrival;
  use_stamp: true;
  recipients: { to: { user_id: string } | { email: string }; request_id: string }[];
  /** One signature for the whole list, as one note. */
  signature?: CardSignature | null;
}

/** One card on a list's look: ready to go, sent by an earlier try of the list, or refused (and why). */
export type HolidayCardListLine =
  | { request_id: string; status: 'ready'; to_name: string | null; by_email: boolean; arrival: HolidayCardArrival;
    arrives_on: string | null; opens_on: string | null }
  | { request_id: string; status: 'already_sent'; card: SentHolidayCard }
  | { request_id: string; status: 'refused'; error: string; code: string };

/** A list's look: the first card that can go as its person will see it (none when nobody can), and every card's line. */
export type HolidayCardListPreview = Partial<HolidayCardPreview> & {
  recipients: HolidayCardListLine[];
  stamps: { available: number; free_remaining: number; paid_remaining: number };
  /** The stamps the ready cards take. */
  needed: number;
};

/** POST /api/mailbox/cards/batch/preview: every check sending the list runs; nothing is stored or sent. */
export async function previewHolidayCardList(data: HolidayCardList): Promise<HolidayCardListPreview> {
  return post<HolidayCardListPreview>('/api/mailbox/cards/batch/preview', data);
}

/** One card in a list's answer. A card not sent used no stamp. */
export type HolidayCardListResult =
  | { request_id: string; status: 'sent' | 'already_sent'; card: SentHolidayCard }
  | { request_id: string; status: 'not_sent'; error: string; code: string };

/**
 * POST /api/mailbox/cards/batch: send the list, card by card. 402 STAMPS_REQUIRED (with `needed` and `available`)
 * when the cards that can go need more stamps than are left; nothing is sent then.
 */
export async function sendHolidayCardList(data: HolidayCardList): Promise<{
  results: HolidayCardListResult[];
  stamps: { available: number; free_remaining: number; paid_remaining: number } | null;
}> {
  return post('/api/mailbox/cards/batch', data);
}

// ============ SENT (launch key mailbox) ============

/**
 * A card in its sender's Sent: where it is now and how it reached them, never whether it was opened, nor the other
 * person's ids, address or time zone. Days (`arrives_on`, `opens_on`, `postmarked_on`) are by their clock.
 */
export interface SentPiece {
  id: string;
  kind: 'card' | 'letter';
  subject?: string | null;
  sent_at: string;
  /** Their name as it was when sent; by email the masked address, or whoever claimed it. */
  to_name: string | null;
  /** A letter to a Home itself: `to_name` ("their household", "your household") is said whole, never as a first name. */
  to_household?: boolean;
  by_email: boolean;
  /** Sent as a link anyone can open (launch key card_table). `to_name` is "them" until someone opens it. */
  by_link?: boolean;
  arrival: HolidayCardArrival | null;
  /** To a person: before the 7 a.m. pickup, picked up (a Christmas-morning card on its way), in their mailbox. */
  status: 'waiting' | 'picked_up' | 'delivered' | 'claimed' | 'expired' | 'email_waiting';
  arrives_at: string | null;
  arrives_on: string | null;
  opens_on: string | null;
  sealed: boolean;
  can_take_back: boolean;
  take_back_until: string | null;
  /** The envelope as it reaches them: no postmark until the carrier has it. */
  envelope: { from: string; postmarked_on: string | null };
  card: { design: string | null; number: number | null; caption: string | null; paper: string | null; year: number | null;
    /** The picture's height in px at 960 px wide. */
    height?: number | null;
    /** Its public page, and the colour of the cloth it lies on (launch key card_table). */
    slug?: string | null;
    table?: string | null;
    /** The whole verse on a Christmas with Jesus Christ picture ("Read the verse"); not while it's sealed. */
    verse?: string | null;
    /** Their own signature beside FROM (GET /sent/:id only; also while it's sealed for the other person). */
    signature?: CardSignature | null };
}

/** A step of a sent card's trail: `at` an instant (shown by the sender's clock), `on` a day by theirs. */
export interface SentTrailStep {
  step: 'sealed' | 'emailed' | 'picked_up' | 'delivered' | 'opens' | 'joined' | 'returned';
  at?: string | null;
  on?: string | null;
  done: boolean;
  by_link?: boolean;
}

/** One card in Sent, with the sender's own note (also while it's sealed for them) and its trail. */
export interface SentPieceDetail extends SentPiece {
  note: string;
  trail: SentTrailStep[];
}

/** GET /api/mailbox/sent: newest first, `limit` at a time (25 unless asked); `next` is the cursor for the page after. */
export async function getSentCards(params?: { before?: string; limit?: number }): Promise<{ items: SentPiece[]; next: string | null }> {
  return get<{ items: SentPiece[]; next: string | null }>('/api/mailbox/sent', params);
}

/** GET /api/mailbox/sent/:id (its sender only). */
export async function getSentCard(id: string): Promise<{ item: SentPieceDetail }> {
  return get<{ item: SentPieceDetail }>(`/api/mailbox/sent/${encodeURIComponent(id)}`);
}

/** POST /api/mailbox/cards/shared (launch key card_table): which picture went where, for counts. The picture and note stay on the device. */
export async function recordHolidayCardShare(data: {
  design: string;
  kind: 'instagram' | 'facebook' | 'email' | 'link' | 'save' | 'more';
  format: 'story' | 'post' | 'link';
  with_note: boolean;
}): Promise<void> {
  await post<void>('/api/mailbox/cards/shared', data);
}

/** POST /api/mailbox/cards/:id/take-back: before the 7 a.m. pickup (by email: before they open it). */
export async function takeBackHolidayCard(cardId: string): Promise<{ taken_back: true }> {
  return post<{ taken_back: true }>(`/api/mailbox/cards/${encodeURIComponent(cardId)}/take-back`);
}
