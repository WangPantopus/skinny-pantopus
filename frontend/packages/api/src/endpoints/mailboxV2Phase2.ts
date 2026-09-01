// ============================================================
// MAILBOX V2 PHASE 2 ENDPOINTS
// Booklets, Bundles, Certified, Party, Vault, Coupon, Anti-Gaming
// ============================================================

import { get, post, patch } from '../client';
import type { MailItemV2, EarnOffer } from './mailboxV2';

// ============ PHASE 2 TYPES ============

export type MailObjectTypeP2 = 'envelope' | 'postcard' | 'package' | 'booklet' | 'bundle';
export type BundleType = 'auto' | 'manual' | 'sender_grouped' | 'date_grouped';
export type RedemptionType = 'in_app_order' | 'code_reveal' | 'save' | 'in_store_qr';
export type RedemptionStatus = 'pending' | 'redeemed' | 'expired' | 'cancelled';
export type PartyStatus = 'pending' | 'active' | 'completed' | 'expired';
export type RiskAction = 'normal' | 'pending_review' | 'under_review' | 'suspended';

export interface BookletPage {
  id: string;
  mail_id: string;
  page_number: number;
  image_url?: string;
  text_content?: string;
}

export interface BookletMail extends MailItemV2 {
  mail_object_type: 'booklet';
  page_count: number;
  cover_image_url?: string;
  download_url?: string;
  download_size_bytes?: number;
  streaming_available: boolean;
}

export interface BundleMail extends MailItemV2 {
  mail_object_type: 'bundle';
  bundle_label: string;
  bundle_type: BundleType;
  bundle_item_count: number;
  collapsed_by_default: boolean;
}

export interface CertifiedMail extends MailItemV2 {
  certified: true;
  requires_acknowledgment: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  audit_trail: AuditEvent[];
  legal_timestamp?: string;
  sender_confirmation_url?: string;
}

export interface AuditEvent {
  event: 'delivered' | 'opened' | 'acknowledged' | 'forwarded' | 'rejected';
  timestamp: string;
  actor_id?: string;
  ip_hash?: string;
  signature?: string;
}

export interface MailPartySession {
  id: string;
  mail_id: string;
  home_id: string;
  initiated_by: string;
  status: PartyStatus;
  created_at: string;
  opened_at?: string;
  completed_at?: string;
  Mail?: MailItemV2;
}

export interface PartyParticipant {
  user_id: string;
  name?: string;
  joined_at?: string;
  present: boolean;
}

export interface VaultFolder {
  id: string;
  user_id: string;
  home_id?: string;
  drawer: string;
  label: string;
  icon?: string;
  color?: string;
  system: boolean;
  item_count: number;
  auto_file_rules: AutoFileRule[];
  last_item_preview?: string;
  sort_order: number;
}

export interface AutoFileRule {
  field: 'category' | 'sender_name' | 'sender_trust' | 'keyword';
  operator: 'equals' | 'contains' | 'starts_with';
  value: string;
}

export interface VaultSearchResult extends MailItemV2 {
  _matchField: string;
  _matchExcerpt: string;
}

export interface OfferRedemption {
  id: string;
  offer_id: string;
  user_id: string;
  merchant_id?: string;
  redemption_type: RedemptionType;
  order_id?: string;
  order_total?: number;
  discount_applied?: number;
  code?: string;
  code_revealed_at?: string;
  status: RedemptionStatus;
  created_at: string;
  redeemed_at?: string;
}

export interface RiskStatus {
  suspended: {
    reason: string;
    expiresAt: string;
    canAppeal: boolean;
  } | null;
  riskScore: number;
  underReviewCount: number;
}

export interface CouponOrderResult {
  orderId: string;
  subtotal: number;
  discount: number;
  total: number;
  receiptMailId?: string;
  earnPayoutReleased: boolean;
}

// ============ BOOKLET ENDPOINTS ============

export async function getBooklet(mailId: string): Promise<{ booklet: BookletMail; pages: BookletPage[] }> {
  return get(`/api/mailbox/v2/p2/booklet/${mailId}`);
}

export async function getBookletPage(mailId: string, pageNumber: number): Promise<{ page: BookletPage }> {
  return get(`/api/mailbox/v2/p2/booklet/${mailId}/page/${pageNumber}`);
}

export async function downloadBooklet(mailId: string): Promise<{ downloadUrl: string; sizeBytes: number }> {
  return post(`/api/mailbox/v2/p2/booklet/${mailId}/download`);
}

// ============ BUNDLE ENDPOINTS ============

export async function getBundleItems(bundleId: string): Promise<{ bundle: BundleMail; items: MailItemV2[] }> {
  return get(`/api/mailbox/v2/p2/bundle/${bundleId}/items`);
}

export async function bundleAction(data: {
  bundleId: string;
  action: 'file_all' | 'open_all' | 'extract_item';
  folderId?: string;
  itemId?: string;
}): Promise<{ message: string; count?: number; remaining?: number }> {
  return post('/api/mailbox/v2/p2/bundle/action', data);
}

export async function triggerAutoBundle(): Promise<{ message: string; bundles: number }> {
  return post('/api/mailbox/v2/p2/bundle/auto-group');
}

// ============ CERTIFIED MAIL ENDPOINTS ============

export async function getCertifiedMail(mailId: string): Promise<{ mail: CertifiedMail }> {
  return get(`/api/mailbox/v2/p2/certified/${mailId}`);
}

export async function acknowledgeCertifiedMail(mailId: string): Promise<{
  message: string;
  acknowledgedAt: string;
  routedTo: string;
  auditTrail: AuditEvent[];
}> {
  return post('/api/mailbox/v2/p2/certified/acknowledge', { mailId });
}

export async function rejectCertifiedMail(mailId: string): Promise<{
  message: string;
  auditTrail: AuditEvent[];
}> {
  return post(`/api/mailbox/v2/p2/certified/${mailId}/reject`);
}

export async function getCertifiedProof(mailId: string): Promise<{ proof: Record<string, unknown> }> {
  return get(`/api/mailbox/v2/p2/certified/${mailId}/proof`);
}

// ============ MAIL PARTY ENDPOINTS ============

export async function createParty(mailId: string): Promise<{ session: MailPartySession; expiresIn: number }> {
  return post('/api/mailbox/v2/p2/party/create', { mailId });
}

export async function joinParty(sessionId: string): Promise<{ session: MailPartySession }> {
  return post('/api/mailbox/v2/p2/party/join', { sessionId });
}

export async function declineParty(sessionId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p2/party/decline', { sessionId });
}

export async function sendReaction(sessionId: string, reaction: string): Promise<{ reaction: string; ttl: number }> {
  return post('/api/mailbox/v2/p2/party/reaction', { sessionId, reaction });
}

export async function assignPartyItem(data: {
  sessionId: string;
  mailId: string;
  assignToUserId: string;
}): Promise<{ message: string; assignedTo: string }> {
  return post('/api/mailbox/v2/p2/party/assign', data);
}

export async function getActiveParties(): Promise<{ sessions: MailPartySession[] }> {
  return get('/api/mailbox/v2/p2/party/active');
}

// ============ VAULT ENDPOINTS ============

export async function getVaultFolders(drawer?: string): Promise<{
  folders: VaultFolder[];
  grouped: Record<string, VaultFolder[]>;
}> {
  return get('/api/mailbox/v2/p2/vault/folders', drawer ? { drawer } : undefined);
}

export async function createVaultFolder(data: {
  drawer: string;
  label: string;
  icon?: string;
  color?: string;
  autoFileRules?: AutoFileRule[];
}): Promise<{ folder: VaultFolder }> {
  return post('/api/mailbox/v2/p2/vault/folder', data);
}

export async function updateVaultFolder(folderId: string, data: {
  label?: string;
  icon?: string;
  color?: string;
  autoFileRules?: AutoFileRule[];
}): Promise<{ folder: VaultFolder }> {
  return patch(`/api/mailbox/v2/p2/vault/folder/${folderId}`, data);
}

export async function getVaultFolderItems(folderId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: MailItemV2[]; total: number }> {
  return get(`/api/mailbox/v2/p2/vault/folder/${folderId}/items`, params);
}

export async function fileToVault(mailId: string, folderId: string): Promise<{ message: string; folderId: string }> {
  return post('/api/mailbox/v2/p2/vault/file', { mailId, folderId });
}

export async function runAutoFile(): Promise<{ message: string; filed: number }> {
  return post('/api/mailbox/v2/p2/vault/auto-file');
}

export async function searchVault(params: {
  q: string;
  drawer?: string;
  folderId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: VaultSearchResult[]; total: number; query: string }> {
  return get('/api/mailbox/v2/p2/vault/search', params);
}

// ============ PACKAGE PHASE 2 ENDPOINTS ============

export async function recordUnboxing(mailId: string, data: {
  conditionPhotoUrl?: string;
  unboxingVideoUrl?: string;
  skip?: boolean;
}): Promise<{ message: string }> {
  return post(`/api/mailbox/v2/p2/package/${mailId}/unboxing`, data);
}

export async function saveWarranty(mailId: string, type: 'warranty' | 'manual'): Promise<{
  message: string;
  folder?: string;
}> {
  return post(`/api/mailbox/v2/p2/package/${mailId}/save-warranty`, { type });
}

export async function createPackageGig(mailId: string, data: {
  gigType: 'hold' | 'inside' | 'sign' | 'custom' | 'assembly';
  title?: string;
  description?: string;
  suggestedStart?: string;
  compensation?: number;
}): Promise<{ message: string; gigId: string; title: string; preDelivery: boolean }> {
  return post(`/api/mailbox/v2/p2/package/${mailId}/gig`, data);
}

export async function markGigAccepted(mailId: string, data: {
  neighborId: string;
  neighborName: string;
}): Promise<{ message: string }> {
  return post(`/api/mailbox/v2/p2/package/${mailId}/gig-accepted`, data);
}

// ============ COUPON → ORDER PIPELINE ============

export async function initiateBrowse(offerId: string): Promise<{
  offer: EarnOffer;
  merchantOnPantopus: boolean;
  discountType: string;
  discountValue: number;
}> {
  return post('/api/mailbox/v2/p2/coupon/browse', { offerId });
}

export async function placeCouponOrder(data: {
  offerId: string;
  items: Array<{ name: string; price: number; quantity?: number }>;
}): Promise<CouponOrderResult> {
  return post('/api/mailbox/v2/p2/coupon/order', data);
}

export async function saveCouponForLater(offerId: string): Promise<{ message: string }> {
  return post('/api/mailbox/v2/p2/coupon/save', { offerId });
}

export async function getCouponQR(offerId: string): Promise<{ qrCodeUrl?: string; code?: string }> {
  return get(`/api/mailbox/v2/p2/coupon/qr/${offerId}`);
}

// ============ ADVANCED ANTI-GAMING ============

export async function getEarnRiskStatus(): Promise<RiskStatus> {
  return get('/api/mailbox/v2/p2/earn/risk-status');
}

export async function updateRiskSession(data: {
  sessionId?: string;
  offerId?: string;
  dwellMs?: number;
  advertiserId?: string;
  saved?: boolean;
  revealed?: boolean;
}): Promise<{ sessionId: string; riskScore: number; action: RiskAction }> {
  return post('/api/mailbox/v2/p2/earn/update-risk', data);
}

export async function submitAppeal(appealText: string): Promise<{ message: string; suspensionId: string }> {
  return post('/api/mailbox/v2/p2/earn/appeal', { appealText });
}

// ============ SEED (dev) ============

export async function seedPhase2Data(): Promise<{
  message: string;
  booklet?: string;
  certified?: string;
  bundleItems: number;
}> {
  return post('/api/mailbox/v2/p2/seed-p2');
}
