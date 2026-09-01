// ============================================================
// MAIL COMPOSE TYPES
// Types for the Pantopus mail composer four-moment flow:
// Porch Call → Address It → Write It → Seal & Send
// ============================================================

import type { Mail } from './index';

// ─── Core Union Types ──────────────────────────────────────

/** Seven mail intents matching the design doc intent cards */
export type MailIntent =
  | 'personal_note'
  | 'household_notice'
  | 'bill_request'
  | 'offer_promotion'
  | 'document'
  | 'package_pickup'
  | 'certified_signature';

/** How the mail is routed */
export type DestinationMode = 'home' | 'person_at_home' | 'self_at_home';

/** Human-facing visibility choices — never expose backend field names */
export type VisibilityMode = 'private_to_recipient' | 'household_visible' | 'recipient_plus_admins';

/** Maps intent to ceremony tier grouping */
export type MailClass = 'personal' | 'operational' | 'formal';

/** Stationery ink palette — quiet row at canvas bottom */
export type InkSelection = 'ivory' | 'slate' | 'forest' | 'rose' | 'midnight';

/** Seasonal PNW stationery themes */
export type StationeryTheme = 'winter' | 'spring' | 'summer' | 'fall';

/** What should happen when this mail is opened */
export type OutcomeType =
  | 'just_read'
  | 'acknowledge'
  | 'pay_now'
  | 'sign_confirm'
  | 'save_to_records'
  | 'create_task'
  | 'remind_later';

/** Seal & Send animation register */
export type CeremonyTier = 'full' | 'clean' | 'formal';

/** Porch Call entry ritual intensity */
export type PorchCallTier = 'full' | 'compressed' | 'none';

// ─── Compose State ─────────────────────────────────────────

/** Content fields for the Write It canvas */
export interface ComposeContentDraft {
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  signature: string;
}

/** Single normalized state object that drives the entire compose flow */
export interface ComposeState {
  mailIntent: MailIntent | null;
  destinationMode: DestinationMode | null;
  destinationHomeId: string | null;
  destinationUserId: string | null;
  recipientName: string | null;
  recipientHomeMedia?: string | null;
  visibilityMode: VisibilityMode;
  mailClass: MailClass | null;
  contentDraft: ComposeContentDraft;
  voicePostscriptUri?: string | null;
  photoAttachments: string[];
  stationeryTheme: StationeryTheme;
  inkSelection: InkSelection;
  outcomes: OutcomeType[];
  routingHints: string[];
  isRecipientOnPantopus: boolean;
}

// ─── Computed Backend Payload ──────────────────────────────

/**
 * Shape that maps ComposeState into the StructuredMailSendPayload
 * accepted by POST /api/mailbox/send.
 *
 * Mirrors the backend Joi sendMailSchema and the frontend
 * StructuredMailSendPayload type in @pantopus/api.
 */
export interface ComputedBackendPayload {
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
    ackRequired?: boolean;
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
    ackRequired?: boolean;
  };
  tracking?: Record<string, unknown>;
}

// ─── Mail Type Configuration ───────────────────────────────

/** Configuration for each of the 7 mail types */
export interface MailTypeConfig {
  intent: MailIntent;
  icon: string;
  label: string;
  example: string;
  defaultOutcome: OutcomeType;
  mailClass: MailClass;
  ceremonyTier: CeremonyTier;
  defaultVisibility: VisibilityMode;
}

/** The 7 mail type configs from the design doc intent card table */
export const MAIL_TYPE_CONFIGS: MailTypeConfig[] = [
  {
    intent: 'personal_note',
    icon: '✉️',
    label: 'Personal Note',
    example: 'Just thinking of you',
    defaultOutcome: 'just_read',
    mailClass: 'personal',
    ceremonyTier: 'full',
    defaultVisibility: 'private_to_recipient',
  },
  {
    intent: 'household_notice',
    icon: '📋',
    label: 'Household Notice',
    example: 'The water is off Tuesday 2pm',
    defaultOutcome: 'acknowledge',
    mailClass: 'operational',
    ceremonyTier: 'clean',
    defaultVisibility: 'household_visible',
  },
  {
    intent: 'bill_request',
    icon: '💸',
    label: 'Bill / Request',
    example: 'You owe me $40 for dinner',
    defaultOutcome: 'pay_now',
    mailClass: 'operational',
    ceremonyTier: 'clean',
    defaultVisibility: 'private_to_recipient',
  },
  {
    intent: 'offer_promotion',
    icon: '🎁',
    label: 'Offer / Promotion',
    example: 'Free gutters this week only',
    defaultOutcome: 'just_read',
    mailClass: 'personal',
    ceremonyTier: 'full',
    defaultVisibility: 'household_visible',
  },
  {
    intent: 'document',
    icon: '📄',
    label: 'Document',
    example: 'Here is the lease agreement',
    defaultOutcome: 'save_to_records',
    mailClass: 'operational',
    ceremonyTier: 'clean',
    defaultVisibility: 'private_to_recipient',
  },
  {
    intent: 'package_pickup',
    icon: '📦',
    label: 'Package / Pickup',
    example: 'Your order arrives Thursday',
    defaultOutcome: 'create_task',
    mailClass: 'operational',
    ceremonyTier: 'clean',
    defaultVisibility: 'household_visible',
  },
  {
    intent: 'certified_signature',
    icon: '🔏',
    label: 'Certified / Signature',
    example: 'Please sign this before Friday',
    defaultOutcome: 'sign_confirm',
    mailClass: 'formal',
    ceremonyTier: 'formal',
    defaultVisibility: 'private_to_recipient',
  },
];

// ─── Helper Functions ──────────────────────────────────────

/** Map a mail intent to its MailClass (personal / operational / formal) */
export function getMailClass(intent: MailIntent): MailClass {
  switch (intent) {
    case 'personal_note':
    case 'offer_promotion':
      return 'personal';
    case 'household_notice':
    case 'bill_request':
    case 'document':
    case 'package_pickup':
      return 'operational';
    case 'certified_signature':
      return 'formal';
  }
}

/** Map a mail intent to its CeremonyTier (full / clean / formal) */
export function getCeremonyTier(intent: MailIntent): CeremonyTier {
  switch (intent) {
    case 'personal_note':
    case 'offer_promotion':
      return 'full';
    case 'household_notice':
    case 'bill_request':
    case 'document':
    case 'package_pickup':
      return 'clean';
    case 'certified_signature':
      return 'formal';
  }
}

/**
 * Determine the Porch Call tier based on the design doc tiering rules:
 *
 * Full (2s, non-skippable):
 *   - First-ever compose of the day for Personal Note
 *   - Personal Note when user hasn't sent one in 7+ days
 *
 * Compressed (0.5s, tap to skip):
 *   - Personal Note after the first daily send
 *
 * None (direct to Address It or Write It):
 *   - All non-personal mail types (operational & formal)
 */
export function getPorchCallTier(
  intent: MailIntent,
  isFirstComposeToday: boolean,
  daysSinceLastPersonalNote: number,
): PorchCallTier {
  // Only Personal Note gets a Porch Call
  if (intent !== 'personal_note') {
    return 'none';
  }

  // Full Porch Call: first compose today OR 7+ days since last personal note
  if (isFirstComposeToday || daysSinceLastPersonalNote >= 7) {
    return 'full';
  }

  // Compressed: subsequent personal notes on the same day
  return 'compressed';
}
