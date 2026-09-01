import type { ReactNode } from 'react';

// ─── Action / Status types ──────────────────────────────────
export type ActionItemSeverity = 'info' | 'warning' | 'critical';
export type ActionItemType =
  | 'chat_unread' | 'mail_new' | 'bill_due' | 'task_due'
  | 'gig_update' | 'package_update' | 'business_order' | 'system_alert';

export interface ActionItem {
  id: string;
  type: ActionItemType;
  pillar: 'personal' | 'home' | 'business';
  title: string;
  subtitle?: string;
  severity: ActionItemSeverity;
  count?: number;
  dueAt?: string;
  route: string;
  entityRef?: { kind: string; id: string };
}

// ─── Setup ──────────────────────────────────────────────────
export interface SetupStep { key: string; done: boolean; }

export interface ProfileCompleteness {
  score: number; // 0-100
  checks: Record<string, boolean>;
  missingFields: string[];
}

// ─── Entities ───────────────────────────────────────────────
export interface HubHome {
  id: string;
  name: string;
  addressShort: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary: boolean;
  roleBase: string;
}
export interface HubBusiness { id: string; name: string; username: string; roleBase: string; }
export interface HubBillDue { id: string; name: string; amount: number; dueAt: string; }
export interface HubTaskDue { id: string; title: string; dueAt: string; }

// ─── Card data ──────────────────────────────────────────────
export interface HubPersonalCard {
  unreadChats: number;
  earnings?: number;
  gigsNearby?: number;
  rating?: number;
  reviewCount?: number;
}
export interface HubHomeCard {
  newMail: number;
  billsDue: HubBillDue[];
  tasksDue: HubTaskDue[];
  memberCount?: number;
}
export interface HubBusinessCard { newOrders: number; unreadThreads: number; pendingPayout: number; }

// ─── Activity / Jump-back-in ────────────────────────────────
export interface JumpBackInItem { title: string; route: string; icon?: ReactNode | string; }
export interface ActivityItem { id: string; pillar: 'personal' | 'home' | 'business'; title: string; at: string; read: boolean; route: string; }

// ─── Payload ────────────────────────────────────────────────
export interface HubPayload {
  user: {
    id: string;
    name: string;
    firstName?: string | null;
    username: string;
    avatarUrl: string | null;
    email: string;
  };
  context: { activeHomeId: string | null; activePersona: Persona; };
  availability: { hasHome: boolean; hasBusiness: boolean; hasPayoutMethod?: boolean; };
  homes: HubHome[];
  businesses: HubBusiness[];
  setup: { steps: SetupStep[]; allDone: boolean; profileCompleteness: ProfileCompleteness; };
  statusItems: ActionItem[];
  cards: { personal: HubPersonalCard; home?: HubHomeCard; business?: HubBusinessCard; };
  jumpBackIn: JumpBackInItem[];
  activity: ActivityItem[];
}

// ─── Persona ────────────────────────────────────────────────
export type Persona = { type: 'personal' } | { type: 'business'; businessId: string };
