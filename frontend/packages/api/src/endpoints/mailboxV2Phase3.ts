// ============================================================
// MAILBOX V2 PHASE 3 ENDPOINTS
// Records, Map, Community, Tasks, MailDay, Stamps, Memory,
// Wallet, Vacation, Translation
// ============================================================

import { get, post, patch, del } from '../client';
import type { MailItemV2 } from './mailboxV2';

// ============ PHASE 3 TYPES ============

// ── Mail → Records ──
export interface MailAssetLink {
  id: string;
  mail_id: string;
  asset_id: string;
  linked_by: string;
  link_type: 'manual' | 'auto_detected' | 'warranty' | 'receipt' | 'repair';
  confidence: number;
  created_at: string;
}

export interface HomeAssetSummary {
  id: string;
  name: string;
  category: 'appliance' | 'structure' | 'system' | 'vehicle' | 'other';
  room?: string;
  manufacturer?: string;
  model_number?: string;
  purchased_at?: string;
  warranty_expires?: string;
  warranty_status: 'active' | 'expiring_soon' | 'expired' | 'none';
  linked_mail_count: number;
  linked_gig_count: number;
  photo_url?: string;
}

export interface AssetPhoto {
  id: string;
  asset_id: string;
  url: string;
  caption?: string;
  taken_at: string;
}

export interface AssetDetection {
  candidate_name: string;
  candidate_brand?: string;
  candidate_model?: string;
  confidence: number;
  source_mail_id: string;
  source_field: string;
}

// ── Mail → Map ──
export type MapPinType = 'permit' | 'delivery' | 'notice' | 'civic' | 'utility_work' | 'community';
export type PinVisibility = 'personal' | 'household' | 'neighborhood' | 'public';

export interface HomeMapPin {
  id: string;
  home_id: string;
  mail_id?: string;
  created_by: string;
  pin_type: MapPinType;
  title: string;
  body?: string;
  lat: number;
  lng: number;
  radius_meters?: number;
  visible_to: PinVisibility;
  expires_at?: string;
  created_at: string;
  // Populated on detail
  linked_mail?: MailItemV2;
  sender_display?: string;
  sender_trust?: string;
}

// ── Mail → Community ──
export type CommunityType = 'civic_notice' | 'neighborhood_event' | 'local_business' | 'building_announcement';
export type ReactionType = 'acknowledged' | 'will_attend' | 'concerned' | 'thumbs_up';

export interface CommunityMailItem {
  id: string;
  mail_id?: string;
  published_by: string;
  home_id: string;
  community_type: CommunityType;
  published_to: 'building' | 'neighborhood' | 'city';
  title: string;
  body?: string;
  sender_display?: string;
  sender_trust?: string;
  category?: string;
  verified_sender: boolean;
  event_date?: string;
  rsvp_deadline?: string;
  map_pin_id?: string;
  views: number;
  neighbors_received: number;
  rsvp_count: number;
  created_at: string;
  reactions: CommunityReactionCount[];
  user_reactions: string[];
}

export interface CommunityReactionCount {
  reaction_type: ReactionType;
  count: number;
}

// ── Mail → Task ──
export interface MailTask {
  id: string;
  home_id: string;
  mail_id?: string;
  title: string;
  description?: string;
  due_at?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
  converted_to_gig_id?: string;
  created_at: string;
  mail_preview?: string;
  mail_sender?: string;
}

// ── Mail Day ──
export interface MailDaySettings {
  delivery_time: string;
  timezone: string;
  enabled: boolean;
  sound_enabled: boolean;
  sound_type: 'off' | 'soft' | 'classic';
  haptics_enabled: boolean;
  include_personal: boolean;
  include_home: boolean;
  include_business: boolean;
  include_earn_count: boolean;
  include_community: boolean;
  interrupt_time_sensitive: boolean;
  interrupt_packages_otd: boolean;
  interrupt_certified: boolean;
  current_theme: string;
}

export interface MailDaySummary {
  greeting: string;
  total_new: number;
  arrivals: MailItemV2[];
  needs_attention: MailItemV2[];
  earn_count: number;
  community_count: number;
  memory?: MailMemoryItem;
}

// ── Stamps ──
export type StampRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Stamp {
  id: string;
  user_id: string;
  stamp_type: string;
  rarity: StampRarity;
  earned_at: string;
  earned_by: string;
  name: string;
  description?: string;
  visual_url?: string;
  color_palette: string[];
  displayed_in_gallery: boolean;
}

export interface SeasonalTheme {
  id: string;
  name: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'custom';
  accent_color: string;
  auto_apply: boolean;
  active_from?: string;
  active_until?: string;
  unlock_condition: 'default' | 'stamp_milestone' | 'earned' | 'seasonal_auto' | 'premium';
  unlocked: boolean;
}

// ── Memory ──
export interface MailMemoryItem {
  id: string;
  memory_type: 'on_this_day' | 'year_in_mail' | 'first_mail_from_sender';
  reference_date: string;
  headline: string;
  body?: string;
  mail_items: MailItemV2[];
  dismissed: boolean;
}

export interface YearInMail {
  year: number;
  total_items: number;
  by_drawer: Record<string, number>;
  by_type: Record<string, number>;
  top_senders: TopSender[];
  total_packages: number;
  total_earned: number;
  total_saved: number;
  first_mail_date?: string;
  most_active_month?: string;
  share_card_url?: string;
}

export interface TopSender {
  sender_display: string;
  sender_trust: string;
  item_count: number;
  category: string;
}

// ── Wallet ──
export type TxType = 'earn' | 'bonus' | 'withdrawal' | 'expired' | 'rejected' | 'coupon_saving';
export type TxSource = 'offer_engagement' | 'offer_conversion' | 'milestone_bonus' | 'referral' | 'withdrawal' | 'coupon';

export interface EarnWallet {
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_saved: number;
  withdrawal_method?: 'pantopus_credit' | 'bank_transfer' | 'gift_card';
  withdrawal_threshold: number;
}

export interface WalletTransaction {
  id: string;
  type: TxType;
  amount: number;
  source?: TxSource;
  source_item_id?: string;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
  created_at: string;
}

// ── Vacation ──
export type HoldAction = 'hold_in_vault' | 'forward_to_household' | 'notify_urgent_only';
export type PackageHoldAction = 'hold_at_carrier' | 'ask_neighbor' | 'locker';

export interface VacationHold {
  id: string;
  user_id: string;
  home_id: string;
  start_date: string;
  end_date: string;
  hold_action: HoldAction;
  package_action: PackageHoldAction;
  auto_neighbor_request: boolean;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  items_held_count: number;
}

// ── Translation ──
export interface TranslationResult {
  translated_text: string;
  from_language: string;
  to_language: string;
  cached: boolean;
}

// ============ RECORDS ENDPOINTS ============

export async function getLinkedAssets(homeId: string): Promise<{
  assets: HomeAssetSummary[];
  rooms: string[];
}> {
  return get(`/api/mailbox/v2/p3/records/assets`, { homeId });
}

export async function getAssetMail(assetId: string): Promise<{
  asset: HomeAssetSummary;
  mail: MailItemV2[];
  gigs: Array<{ id: string; title: string; status: string; created_at: string }>;
  photos: AssetPhoto[];
}> {
  return get(`/api/mailbox/v2/p3/records/asset/${assetId}/mail`);
}

export async function linkMailToAsset(data: {
  mailId: string;
  assetId: string;
  linkType?: string;
}): Promise<{ link: MailAssetLink }> {
  return post('/api/mailbox/v2/p3/records/link', data);
}

export async function unlinkMailFromAsset(linkId: string): Promise<{ message: string }> {
  return del(`/api/mailbox/v2/p3/records/unlink/${linkId}`);
}

export async function autoDetectAssets(homeId: string): Promise<{
  detections: AssetDetection[];
  count: number;
}> {
  return post('/api/mailbox/v2/p3/records/auto-detect', { homeId });
}

export async function getAssetSuggestions(homeId: string): Promise<{
  suggestions: Array<{
    mail: MailItemV2;
    detections: AssetDetection[];
  }>;
}> {
  return get('/api/mailbox/v2/p3/records/suggestions', { homeId });
}

// ============ MAP ENDPOINTS ============

export async function getMapPins(params: {
  homeId: string;
  type?: MapPinType;
  bounds?: { north: number; south: number; east: number; west: number };
}): Promise<{ pins: HomeMapPin[] }> {
  return get('/api/mailbox/v2/p3/map/pins', params);
}

export async function createMapPin(data: {
  homeId: string;
  mailId?: string;
  pinType: MapPinType;
  title: string;
  body?: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  visibleTo?: PinVisibility;
  expiresAt?: string;
}): Promise<{ pin: HomeMapPin }> {
  return post('/api/mailbox/v2/p3/map/pin', data);
}

export async function getMapPinDetail(pinId: string): Promise<{
  pin: HomeMapPin;
}> {
  return get(`/api/mailbox/v2/p3/map/pin/${pinId}`);
}

export async function deleteMapPin(pinId: string): Promise<{ message: string }> {
  return del(`/api/mailbox/v2/p3/map/pin/${pinId}`);
}

// ============ COMMUNITY ENDPOINTS ============

export async function getCommunityFeed(params?: {
  homeId?: string;
  type?: CommunityType;
  limit?: number;
  offset?: number;
}): Promise<{ items: CommunityMailItem[]; total: number }> {
  return get('/api/mailbox/v2/p3/community/feed', params);
}

export async function publishToCommunity(data: {
  mailId: string;
  commentary?: string;
  publishedTo?: 'building' | 'neighborhood' | 'city';
}): Promise<{ item: CommunityMailItem; reach: number }> {
  return post('/api/mailbox/v2/p3/community/publish', data);
}

export async function reactToCommunity(data: {
  communityItemId: string;
  reactionType: ReactionType;
}): Promise<{ message: string; reactions: CommunityReactionCount[] }> {
  return post('/api/mailbox/v2/p3/community/react', data);
}

export async function rsvpToCommunity(communityItemId: string): Promise<{
  message: string;
  rsvpCount: number;
}> {
  return post('/api/mailbox/v2/p3/community/rsvp', { communityItemId });
}

export async function flagCommunityItem(communityItemId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p3/community/flag', { communityItemId });
}

// ============ TASK ENDPOINTS ============

export async function getMailTasks(homeId?: string): Promise<{
  active: MailTask[];
  completed: MailTask[];
}> {
  return get('/api/mailbox/v2/p3/tasks', homeId ? { homeId } : undefined);
}

export async function createTaskFromMail(data: {
  mailId: string;
  homeId: string;
  title: string;
  description?: string;
  dueAt?: string;
  priority?: 'low' | 'medium' | 'high';
}): Promise<{ task: MailTask }> {
  return post('/api/mailbox/v2/p3/tasks/from-mail', data);
}

export async function updateMailTask(taskId: string, data: {
  status?: string;
  title?: string;
  priority?: string;
  dueAt?: string;
}): Promise<{ task: MailTask }> {
  return patch(`/api/mailbox/v2/p3/tasks/${taskId}`, data);
}

export async function convertTaskToGig(taskId: string, data?: {
  title?: string;
  description?: string;
  compensation?: number;
}): Promise<{ gigId: string; title: string }> {
  return post(`/api/mailbox/v2/p3/tasks/${taskId}/to-gig`, data || {});
}

// ============ MAIL DAY ENDPOINTS ============

export async function getMailDaySummary(): Promise<MailDaySummary> {
  return get('/api/mailbox/v2/p3/mailday/summary');
}

export async function getMailDaySettings(): Promise<MailDaySettings> {
  return get('/api/mailbox/v2/p3/mailday/settings');
}

export async function updateMailDaySettings(data: Partial<MailDaySettings>): Promise<{
  settings: MailDaySettings;
}> {
  return patch('/api/mailbox/v2/p3/mailday/settings', data);
}

// ============ STAMP ENDPOINTS ============

export async function getStamps(): Promise<{
  earned: Stamp[];
  locked: Array<{ stamp_type: string; name: string; description: string; rarity: StampRarity; progress?: number; target?: number }>;
  total_earned: number;
  total_available: number;
}> {
  return get('/api/mailbox/v2/p3/stamps');
}

export async function getThemes(): Promise<{
  themes: SeasonalTheme[];
  active: string;
}> {
  return get('/api/mailbox/v2/p3/themes');
}

export async function applyTheme(themeId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p3/themes/apply', { themeId });
}

// ============ MEMORY ENDPOINTS ============

export async function getOnThisDay(): Promise<{
  memories: MailMemoryItem[];
}> {
  return get('/api/mailbox/v2/p3/memory/on-this-day');
}

export async function getYearInMail(year: number): Promise<YearInMail> {
  return get(`/api/mailbox/v2/p3/memory/year/${year}`);
}

export async function dismissMemory(memoryId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p3/memory/dismiss', { memoryId });
}

export async function shareYearInMail(year: number): Promise<{ shareCardUrl: string }> {
  return post(`/api/mailbox/v2/p3/memory/year/${year}/share`);
}

// ============ WALLET ENDPOINTS ============
// Rewired to canonical /api/wallet/* (cents-based Wallet table).
// EarnWallet interface is preserved for backward compatibility;
// cents are converted to dollars in the adapter layer.

export async function getWalletBalance(): Promise<EarnWallet> {
  const res = await get<{ wallet: { balance: number; lifetime_withdrawals: number; lifetime_received: number } }>('/api/wallet');
  return {
    available_balance: res.wallet.balance / 100,
    pending_balance: 0,
    lifetime_earned: res.wallet.lifetime_received / 100,
    lifetime_saved: 0,
    withdrawal_threshold: 1,
  };
}

export async function getWalletTransactions(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const res = await get<{ transactions: Array<WalletTransaction & { direction?: string }>; total: number }>(
    '/api/wallet/transactions',
    params,
  );
  return {
    transactions: res.transactions.map(tx => ({
      ...tx,
      // Canonical wallet stores cents; convert to dollars for legacy consumers
      amount: (tx.direction === 'debit' ? -1 : 1) * (tx.amount / 100),
    })),
    total: res.total,
  };
}

export async function initiateWithdrawal(data: {
  amount: number;
  method: 'pantopus_credit' | 'bank_transfer' | 'gift_card';
}): Promise<{ transaction: WalletTransaction; message: string }> {
  // Canonical wallet expects cents; legacy callers send dollars
  const amountCents = Math.round(data.amount * 100);
  return post('/api/wallet/withdraw', { amount: amountCents });
}

// ============ VACATION ENDPOINTS ============

export async function getVacationStatus(): Promise<{
  active: VacationHold | null;
  upcoming: VacationHold | null;
}> {
  return get('/api/mailbox/v2/p3/vacation/status');
}

export async function startVacation(data: {
  homeId: string;
  startDate: string;
  endDate: string;
  holdAction: HoldAction;
  packageAction: PackageHoldAction;
  autoNeighborRequest?: boolean;
}): Promise<{ hold: VacationHold }> {
  return post('/api/mailbox/v2/p3/vacation/start', data);
}

export async function cancelVacation(holdId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p3/vacation/cancel', { holdId });
}

// ============ TRANSLATION ENDPOINTS ============

export async function translateMail(mailId: string, targetLang?: string): Promise<TranslationResult> {
  return post('/api/mailbox/v2/p3/translate', { mailId, targetLang });
}

// ============ SEED (dev) ============

export async function seedPhase3Data(): Promise<{
  message: string;
  assets: number;
  pins: number;
  community: number;
  stamps: number;
}> {
  return post('/api/mailbox/v2/p3/seed-p3');
}
