// ============================================================
// MAILBOX V2 ENDPOINTS
// Phase 1: Drawers, routing, packages, earn
// ============================================================

import { get, post } from '../client';
import { patch } from '../client';

// ============ TYPES ============

export type Drawer = 'personal' | 'home' | 'business' | 'earn';
export type Tab = 'incoming' | 'counter' | 'vault';
export type MailObjectType = 'envelope' | 'postcard' | 'package' | 'booklet' | 'bundle';
export type SenderTrust = 'verified_gov' | 'verified_utility' | 'verified_business' | 'pantopus_user' | 'unknown';
export type Urgency = 'none' | 'due_soon' | 'overdue' | 'time_sensitive';
export type Privacy = 'private_to_person' | 'shared_household' | 'business_team';
export type Lifecycle = 'delivered' | 'opened' | 'filed' | 'shredded' | 'forwarded' | 'claimed' | 'archived';
export type PackageStatus = 'pre_receipt' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';

export interface KeyFact {
  field: string;
  value: string;
  confidence: number;
}

/**
 * Set on a letter that was deleted (restorable until restorable_until) or
 * dismissed for the household; members who could see it can restore it.
 */
export interface MailRemovedInfo {
  action: 'deleted' | 'dismissed';
  at: string | null;
  by_name: string | null;
  restorable_until: string | null;
}

export interface MailItemV2 {
  id: string;
  drawer: Drawer;
  mail_object_type: MailObjectType;
  recipient_user_id?: string;
  recipient_home_id?: string;
  recipient_name?: string;
  recipient_address_id?: string;
  sender_display?: string;
  sender_business_name?: string | null;
  sender_logo_url?: string;
  sender_trust: SenderTrust;
  sender_user_id?: string;
  type: string;
  category?: string;
  urgency: Urgency;
  privacy: Privacy;
  lifecycle: Lifecycle;
  removed?: MailRemovedInfo | null;
  /** Who shredded it, while it can be brought back. */
  deleted_by?: string | null;
  subject?: string;
  content?: string;
  content_format?: 'plain_text' | 'markdown' | 'html';
  preview_text?: string;
  display_title?: string;
  key_facts: KeyFact[] | string;
  attachments?: string[];
  due_date?: string;
  created_at: string;
  opened_at?: string;
  viewed?: boolean;
  archived?: boolean;
  starred?: boolean;
  routing_confidence?: number;
  routing_method?: string;
  // Compose-flow metadata
  object_id?: string;
  mail_type?: string;
  primary_action?: string;
  ack_required?: boolean;
  object_payload?: Record<string, any> | null;
  // Package join
  package?: MailPackage | null;
  timeline?: PackageEvent[];
  // Mail tab build (contract v1, 2026-10-27): what the piece is and how it arrived.
  /** What to draw it as; an unknown value draws as a letter. */
  kind?: MailKind | string;
  /** When it went into the box (morning-round pieces: 7:00 a.m. in their mailbox's time zone). */
  delivered_at?: string;
  /** Arrived on its own, outside the morning round. */
  special_delivery?: boolean;
  /** Sent by Pantopus itself. */
  from_pantopus?: boolean;
  /** The sender's post office town and the date; a null town draws the date only. */
  postmark?: { town: string | null; date: string } | null;
  on_counter?: boolean;
  certified?: boolean;
  bundle_id?: string | null;
  bundle_label?: string | null;
  bundle_item_count?: number | null;
  /** "Pantopus read this for you": made once and kept; null means no note. */
  summary?: { text: string; key_facts: { label: string; value: string }[] } | null;
  /** Bills from business invoices; the status is read live from the invoice. */
  invoice?: {
    id: string;
    status: 'sent' | 'viewed' | 'paid' | 'void' | 'overdue';
    total_cents: number;
    currency: string;
    due_date: string | null;
    business_name: string | null;
  } | null;
  /** Detail only: what's in the envelope; fetch a short-lived link per enclosure. */
  enclosures?: { id: string; name: string; mime_type: string; size_bytes: number }[];
  vault_folder_id?: string | null;
  acknowledged_at?: string | null;
  first_opened_at?: string | null;
  sender_address?: string | null;
  page_count?: number | null;
  /** A Christmas card (launch key holiday_cards): its picture, caption and year, and whether it's still sealed. */
  card?: MailCard | null;
  /** Detail only: this load opened it (the first time). */
  just_opened?: boolean;
}

export type MailKind = 'letter' | 'bill' | 'notice' | 'postcard' | 'booklet' | 'parcel' | 'bundle';

/** A Christmas card on a piece. The apps carry the picture (by `design`) and print the caption, year and postmark. */
export interface MailCard {
  design: string;
  number: number | null;
  caption: string | null;
  paper: string;
  holiday: string;
  year: number;
  arrival: string | null;
  /** Sealed until Christmas morning: its note stays on the server until then. */
  sealed_until: string | null;
  sealed: boolean;
}

export interface MailPackage {
  id: string;
  mail_id: string;
  carrier?: string;
  tracking_id_masked?: string;
  weight_lbs?: number;
  dimensions_l?: number;
  dimensions_w?: number;
  dimensions_h?: number;
  fragile?: boolean;
  estimated_value?: number;
  eta_earliest?: string;
  eta_latest?: string;
  eta_confidence: 'high' | 'medium' | 'low';
  delivery_photo_url?: string;
  delivery_location_note?: string;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
}

export interface PackageEvent {
  id: string;
  package_id: string;
  status: string;
  location?: string;
  occurred_at: string;
  photo_url?: string;
}

export interface EarnOffer {
  id: string;
  advertiser_id: string;
  business_name: string;
  business_init?: string;
  business_color?: string;
  offer_title: string;
  offer_subtitle?: string;
  offer_code?: string;
  payout_amount: number;
  expires_at?: string;
  status: string;
  // Enriched
  opened?: boolean;
  transaction?: {
    offer_id: string;
    status: string;
    dwell_ms: number;
    amount: number;
  } | null;
}

export interface EarnBalance {
  total: number;
  available: number;
  pending: number;
}

export interface RoutingResult {
  routed: boolean;
  drawer?: Drawer;
  method?: string;
  confidence?: number;
  bestMatchUserId?: string;
  bestMatchName?: string;
}

export interface PendingRouting {
  id: string;
  mail_id: string;
  home_id: string;
  recipient_name_raw: string;
  best_match_user_id?: string;
  best_match_confidence?: number;
  Mail: MailItemV2;
}

export interface MailDaySummary {
  summary: {
    personal: { total: number; bills: number; packages: number; urgent: number };
    home: { total: number; bills: number; packages: number; urgent: number };
    business: { total: number; bills: number; packages: number; urgent: number };
    earn: { offers: number };
  };
  mostUrgentDrawer: Drawer;
}

// ============ DRAWER ENDPOINTS ============

export async function getDrawerMail(drawer: Drawer, params?: {
  tab?: Tab;
  limit?: number;
  offset?: number;
}): Promise<{ mail: MailItemV2[]; total: number; drawer: Drawer }> {
  return get(`/api/mailbox/v2/drawer/${drawer}`, params);
}

export async function getMailItem(mailId: string): Promise<{ mail: MailItemV2 }> {
  return get(`/api/mailbox/v2/item/${mailId}`);
}

export async function performMailAction(mailId: string, action: string): Promise<{ message: string; action: string }> {
  return post(`/api/mailbox/v2/item/${mailId}/action`, { action });
}

// ============ ROUTING ============

export async function routeMail(mailId: string): Promise<RoutingResult> {
  return post('/api/mailbox/v2/route', { mailId });
}

export async function resolveRouting(data: {
  mailId: string;
  drawer: 'personal' | 'home' | 'business';
  addAlias?: boolean;
  aliasString?: string;
}): Promise<{ message: string; drawer: string }> {
  return post('/api/mailbox/v2/resolve', data);
}

export async function getPendingRouting(): Promise<{ pending: PendingRouting[] }> {
  return get('/api/mailbox/v2/pending');
}

// ============ PACKAGE ============

export async function getPackageDashboard(mailId: string): Promise<{
  package: MailPackage;
  timeline: PackageEvent[];
  sender: { display: string; trust: string } | null;
}> {
  return get(`/api/mailbox/v2/package/${mailId}`);
}

export async function updatePackageStatus(mailId: string, data: {
  status: PackageStatus;
  location?: string;
  photoUrl?: string;
  deliveryLocationNote?: string;
}): Promise<{ message: string; status: string; previousStatus: string }> {
  return patch(`/api/mailbox/v2/package/${mailId}/status`, data);
}

export async function sharePackageEta(mailId: string): Promise<{ message: string; notified: number }> {
  return post(`/api/mailbox/v2/package/${mailId}/share-eta`);
}

export async function createNeighborGig(mailId: string): Promise<{ message: string; gigId: string | null }> {
  return post(`/api/mailbox/v2/package/${mailId}/neighbor-gig`);
}

// ============ EARN ============

export async function getEarnOffers(): Promise<{ offers: EarnOffer[] }> {
  return get('/api/mailbox/v2/earn/offers');
}

export async function getEarnBalance(): Promise<{ balance: EarnBalance }> {
  return get('/api/mailbox/v2/earn/balance');
}

export async function openOffer(offerId: string): Promise<{
  message: string;
  amount?: number;
  status?: string;
  alreadyOpened?: boolean;
  capped?: boolean;
}> {
  return post('/api/mailbox/v2/earn/open', { offerId });
}

export async function closeOffer(offerId: string, dwellMs: number): Promise<{
  consumed: boolean;
  dwellMs: number;
  status: string;
}> {
  return post(`/api/mailbox/v2/earn/close/${offerId}`, { dwellMs });
}

export async function saveOffer(offerId: string): Promise<{ message: string }> {
  return post(`/api/mailbox/v2/earn/save/${offerId}`);
}

export async function revealOfferCode(offerId: string): Promise<{ code: string | null }> {
  return post(`/api/mailbox/v2/earn/reveal/${offerId}`);
}

// ============ EVENT LOGGING ============

export async function logEvent(eventType: string, mailId?: string | null, metadata?: Record<string, unknown>): Promise<{ logged: boolean }> {
  return post('/api/mailbox/v2/event', { eventType, mailId: mailId || null, metadata: metadata || {} });
}

// ============ SUMMARY ============

export async function getMailDaySummary(): Promise<MailDaySummary> {
  return get('/api/mailbox/v2/summary');
}

// ============ SEED (dev) ============

export async function seedTestData(): Promise<{ message: string; mail: number; packages: number; offers: number }> {
  return post('/api/mailbox/v2/seed');
}
