// ============================================================
// MAILBOX TYPES — Single Source of Truth for Web
//
// Re-exports existing shared types from @pantopus/types and
// @pantopus/api where they are barrel-exported. Defines all
// remaining types for the full MailKit spec (Phases 1–3).
//
// Rules:
//   - No `any` types
//   - All IDs are `string`
//   - All timestamps are `string` (ISO 8601)
//   - Optional fields marked with `?`
//   - Everything exported
// ============================================================

// ── Re-exports from @pantopus/types ──────────────────────────

export type {
  Mail,
  MailLink,
  ApiResponse,
  PaginatedResponse,
} from '@pantopus/types';

// ── Re-exports from @pantopus/api barrel ─────────────────────
// Only types that the barrel actually re-exports.

// V2 Phase 1 (via barrel)
export type {
  Drawer as DrawerType,
  Tab,
  SenderTrust as TrustLevel,
  MailItemV2,
  MailPackage,
  PackageEvent,
  EarnOffer,
  EarnBalance,
  PendingRouting,
  MailDaySummaryV2 as MailDaySummaryV2Overview,
} from '@pantopus/api';

// V2 Phase 2 (via barrel)
export type {
  BookletPage,
  BookletMail,
  CertifiedMail,
  AuditEvent,
  VaultFolder,
  VaultSearchResult,
} from '@pantopus/api';

// V2 Phase 3 (via barrel)
export type {
  TranslationResult,
  CommunityMailItem,
  CommunityType,
  HomeAssetSummary,
  HomeMapPin,
  MapPinType,
  MailMemoryItem,
  YearInMail,
  MailDaySummary,
  MailDaySettings,
  AssetDetection,
  Stamp,
  SeasonalTheme,
  StampRarity,
  MailTask,
  VacationHold,
  HoldAction,
  PackageHoldAction,
  EarnWallet,
  WalletTransaction as EarnWalletTransaction,
  TopSender,
  MailAssetLink,
} from '@pantopus/api';

// ============================================================
// TYPES DEFINED LOCALLY
// Types from V2 endpoint modules that are not barrel-exported,
// plus net-new types from the MailKit spec.
// ============================================================

// ── Phase 1 types (not barrel-exported) ──────────────────────

export type MailObjectType = 'envelope' | 'postcard' | 'package' | 'booklet' | 'bundle';

export type UrgencyLevel = 'none' | 'due_soon' | 'overdue' | 'time_sensitive';

export type Privacy = 'private_to_person' | 'shared_household' | 'business_team';

export type Lifecycle = 'delivered' | 'opened' | 'filed' | 'shredded' | 'forwarded' | 'claimed' | 'archived';

export type PackageStatus = 'pre_receipt' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';

export interface KeyFact {
  field: string;
  value: string;
  confidence: number;
}

export interface RoutingResult {
  routed: boolean;
  drawer?: 'personal' | 'home' | 'business' | 'earn';
  method?: string;
  confidence?: number;
  bestMatchUserId?: string;
  bestMatchName?: string;
}

// ── Phase 2 types (not barrel-exported) ──────────────────────

export type MailObjectTypeP2 = 'envelope' | 'postcard' | 'package' | 'booklet' | 'bundle';

export type BundleType = 'auto' | 'manual' | 'sender_grouped' | 'date_grouped';

export type RedemptionType = 'in_app_order' | 'code_reveal' | 'save' | 'in_store_qr';

export type RedemptionStatus = 'pending' | 'redeemed' | 'expired' | 'cancelled';

export type PartyStatus = 'pending' | 'active' | 'completed' | 'expired';

export type RiskAction = 'normal' | 'pending_review' | 'under_review' | 'suspended';

export interface BundleMail {
  id: string;
  drawer: 'personal' | 'home' | 'business' | 'earn';
  mail_object_type: 'bundle';
  bundle_label: string;
  bundle_type: BundleType;
  bundle_item_count: number;
  collapsed_by_default: boolean;
  sender_display: string;
  sender_trust: 'verified_gov' | 'verified_utility' | 'verified_business' | 'pantopus_user' | 'unknown';
  urgency: UrgencyLevel;
  created_at: string;
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
}

export interface PartyParticipant {
  user_id: string;
  name?: string;
  joined_at?: string;
  present: boolean;
}

export interface AutoFileRule {
  field: 'category' | 'sender_name' | 'sender_trust' | 'keyword';
  operator: 'equals' | 'contains' | 'starts_with';
  value: string;
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

// ── Phase 3 types (not barrel-exported) ──────────────────────

export interface AssetPhoto {
  id: string;
  asset_id: string;
  url: string;
  caption?: string;
  taken_at: string;
}

export type PinVisibility = 'personal' | 'household' | 'neighborhood' | 'public';

export type ReactionType = 'acknowledged' | 'will_attend' | 'concerned' | 'thumbs_up';

export interface CommunityReactionCount {
  reaction_type: ReactionType;
  count: number;
}

export type TxType = 'earn' | 'bonus' | 'withdrawal' | 'expired' | 'rejected' | 'coupon_saving';

export type TxSource = 'offer_engagement' | 'offer_conversion' | 'milestone_bonus' | 'referral' | 'withdrawal' | 'coupon';

// ============================================================
// NET-NEW TYPES — MailKit Spec
// ============================================================

// ── Drawer Metadata ──────────────────────────────────────────

export interface DrawerMeta {
  drawer: 'personal' | 'home' | 'business' | 'earn';
  display_name: string;
  icon: string;
  unread_count: number;
  urgent_count: number;
  last_item_at: string | null;
}

// ── Mail Wrapper / Envelope ──────────────────────────────────

export interface MailWrapper {
  id: string;
  drawer: 'personal' | 'home' | 'business' | 'earn';
  mail_object_type: MailObjectType;
  sender_display: string;
  sender_logo_url?: string;
  sender_trust: 'verified_gov' | 'verified_utility' | 'verified_business' | 'pantopus_user' | 'unknown';
  sender_user_id?: string;
  recipient_user_id?: string;
  recipient_home_id?: string;
  recipient_name?: string;
  routing_preview?: RoutingPreview;
  outside_title: string;
  preview_text?: string;
  urgency: UrgencyLevel;
  privacy: Privacy;
  lifecycle: Lifecycle;
  category?: MailCategory;
  starred: boolean;
  created_at: string;
  opened_at?: string;
}

// ── Mail Inside ──────────────────────────────────────────────

export interface MailInside {
  mail_id: string;
  blocks: InsideBlock[];
  actions: MailAction[];
  key_facts: KeyFactEntry[];
  attachments: MailAttachment[];
  ai_elf_summary?: string;
}

// ── Inside Block (discriminated union on `type`) ─────────────

export type InsideBlock =
  | TextBlock
  | ImageBlock
  | TableBlock
  | AmountDueBlock
  | TrackingBlock
  | ActionPromptBlock
  | DocumentBlock
  | RichContentBlock;

interface BaseBlock {
  id: string;
  order: number;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  format: 'plain' | 'markdown' | 'html';
  content: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface AmountDueBlock extends BaseBlock {
  type: 'amount_due';
  amount: number;
  currency: string;
  due_date?: string;
  payee?: string;
  account_number_masked?: string;
}

export interface TrackingBlock extends BaseBlock {
  type: 'tracking';
  carrier: string;
  tracking_id_masked: string;
  status: string;
  eta_earliest?: string;
  eta_latest?: string;
}

export interface ActionPromptBlock extends BaseBlock {
  type: 'action_prompt';
  prompt_text: string;
  action: MailAction;
}

export interface DocumentBlock extends BaseBlock {
  type: 'document';
  document_url: string;
  document_type: string;
  page_count?: number;
  file_size_bytes?: number;
}

export interface RichContentBlock extends BaseBlock {
  type: 'rich_content';
  html: string;
}

// ── Mail Action ──────────────────────────────────────────────

export interface MailAction {
  id: string;
  label: string;
  action_type:
    | 'pay_bill'
    | 'acknowledge'
    | 'file_to_vault'
    | 'create_task'
    | 'create_gig'
    | 'forward'
    | 'translate'
    | 'link_to_asset'
    | 'open_offer'
    | 'rsvp'
    | 'view_on_map'
    | 'share_to_community'
    | 'download'
    | 'shred'
    | 'archive'
    | 'custom';
  icon?: string;
  destructive: boolean;
  requires_confirmation: boolean;
  payload?: Record<string, string>;
}

// ── Mail Recipient ───────────────────────────────────────────

export interface MailRecipient {
  user_id?: string;
  home_id?: string;
  name: string;
  address_line?: string;
  recipient_type: 'user' | 'home' | 'business';
}

// ── Routing Preview ──────────────────────────────────────────

export interface RoutingPreview {
  suggested_drawer: 'personal' | 'home' | 'business' | 'earn';
  confidence: number;
  method: string;
  matched_user_id?: string;
  matched_user_name?: string;
  needs_resolution: boolean;
}

// ── Mail Policy ──────────────────────────────────────────────

export interface MailPolicy {
  payout_amount?: number;
  requires_acknowledgment: boolean;
  certified: boolean;
  expires_at?: string;
  retention_days?: number;
  auto_file_folder_id?: string;
}

// ── Mail Category ────────────────────────────────────────────

export type MailCategory =
  | 'bill'
  | 'statement'
  | 'notice'
  | 'letter'
  | 'package'
  | 'newsletter'
  | 'promotion'
  | 'document'
  | 'legal'
  | 'government'
  | 'medical'
  | 'financial'
  | 'insurance'
  | 'utility'
  | 'subscription'
  | 'personal'
  | 'other';

// ── Form Type ────────────────────────────────────────────────

export type FormType =
  | 'tax_form'
  | 'insurance_claim'
  | 'permit_application'
  | 'lease_agreement'
  | 'utility_signup'
  | 'government_form'
  | 'medical_form'
  | 'other';

// ── Key Facts (AI Elf strip) ─────────────────────────────────

export interface KeyFactEntry {
  field: string;
  value: string;
  confidence: number;
}

// ── Attachments ──────────────────────────────────────────────

export interface MailAttachment {
  id: string;
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
}

// ── Booklet (Phase 2 — web-specific view model) ──────────────

export interface BookletItem {
  mail_id: string;
  page_count: number;
  cover_image_url?: string;
  download_url?: string;
  download_size_bytes?: number;
  streaming_available: boolean;
  pages: BookletPageEntry[];
}

export interface BookletPageEntry {
  page_number: number;
  image_url?: string;
  text_content?: string;
}

// ── Bundle (Phase 2 — web-specific view model) ───────────────

export interface BundleItem {
  bundle_id: string;
  bundle_label: string;
  bundle_type: BundleType;
  item_count: number;
  collapsed_by_default: boolean;
  items: MailWrapper[];
}

// ── Offer Envelope (Earn lane) ───────────────────────────────

export interface OfferEnvelope {
  id: string;
  advertiser_id: string;
  business_name: string;
  business_logo_url?: string;
  offer_title: string;
  offer_subtitle?: string;
  offer_code?: string;
  payout_amount: number;
  expires_at?: string;
  status: 'available' | 'opened' | 'engaged' | 'redeemed' | 'expired' | 'capped';
  opened: boolean;
  engagement_dwell_ms?: number;
}

// ── Home Asset (Phase 3 — full detail) ───────────────────────

export interface HomeAsset {
  id: string;
  home_id: string;
  name: string;
  category: 'appliance' | 'structure' | 'system' | 'vehicle' | 'other';
  room?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  purchased_at?: string;
  purchase_price?: number;
  warranty_expires?: string;
  warranty_status: 'active' | 'expiring_soon' | 'expired' | 'none';
  notes?: string;
  photos: AssetPhotoEntry[];
  linked_mail_count: number;
  linked_gig_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssetPhotoEntry {
  id: string;
  url: string;
  caption?: string;
  taken_at: string;
}

// ── Community Reaction (Phase 3) ─────────────────────────────

export interface CommunityReaction {
  id: string;
  community_item_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

// ── Stamp Type (Phase 3) ─────────────────────────────────────

export type StampType =
  | 'first_mail'
  | 'hundred_mails'
  | 'first_earn'
  | 'vault_organizer'
  | 'community_contributor'
  | 'package_pro'
  | 'certified_handler'
  | 'seasonal'
  | 'milestone'
  | 'custom';

// ── Mail Memory (Phase 3 — extended) ─────────────────────────

export interface MailMemory {
  id: string;
  user_id: string;
  memory_type: 'on_this_day' | 'year_in_mail' | 'first_mail_from_sender';
  reference_date: string;
  headline: string;
  body?: string;
  mail_ids: string[];
  dismissed: boolean;
  created_at: string;
}

// ── Wallet Transaction (earn-specific) ───────────────────────

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

// ── Counter (action-required items) ──────────────────────────

export interface CounterItem {
  mail_id: string;
  action_type: string;
  urgency: UrgencyLevel;
  due_date?: string;
  title: string;
  sender_display?: string;
  drawer: 'personal' | 'home' | 'business' | 'earn';
}

export interface CounterSummary {
  total: number;
  by_drawer: Record<string, number>;
  items: CounterItem[];
}

// ── Mailbox API Response Wrappers ────────────────────────────

export interface MailboxPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  has_more: boolean;
}

export interface MailboxApiResponse<T> {
  data: T;
  error?: string;
}

// ── Composite Response Types ─────────────────────────────────

export interface DrawerListResponse {
  drawers: DrawerMeta[];
}

export interface DrawerItemsResponse {
  items: MailWrapper[];
  total: number;
  page: number;
  has_more: boolean;
  drawer: 'personal' | 'home' | 'business' | 'earn';
}

export interface MailItemDetailResponse {
  wrapper: MailWrapper;
  inside: MailInside;
  policy: MailPolicy;
}
