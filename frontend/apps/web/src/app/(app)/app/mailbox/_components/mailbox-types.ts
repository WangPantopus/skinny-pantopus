import type { ReactNode } from 'react';

export type MailItem = {
  id: string;
  type: string;
  subject: string;
  mail_type?: 'letter' | 'packet' | 'bill' | 'book' | 'notice' | 'promotion' | 'other';
  display_title?: string;
  preview_text?: string;
  primary_action?: 'open' | 'review' | 'read' | 'view_bill' | 'open_packet';
  action_required?: boolean;
  ack_required?: boolean;
  ack_status?: 'pending' | 'acknowledged' | null;
  content: string;
  sender_user_id?: string;
  sender_business_name?: string;
  sender_address?: string;
  viewed: boolean;
  viewed_at?: string;
  archived: boolean;
  starred: boolean;
  payout_amount?: number;
  payout_status?: string;
  category?: string;
  tags?: string[];
  priority: string;
  attachments?: string[];
  expires_at?: string;
  created_at: string;
  object_id?: string;
  content_format?: 'plain_text' | 'markdown' | 'html';
  total_read_time_ms?: number;
  view_count?: number;
  sender?: { username?: string; name?: string };
};

export type Summary = {
  total_mail: number;
  unread_count: number;
  ad_count: number;
  unread_ad_count: number;
  starred_count: number;
  total_earned: number;
  pending_earnings: number;
};

export type MailType = 'ad' | 'letter' | 'bill' | 'statement' | 'notice' | 'package' | 'newsletter' | 'promotion' | 'document' | 'other';
export type MailScope = 'personal' | 'home' | 'all';

export type ComposeMode = 'quick' | 'structured';
export type ObjectFormat = 'plain_text' | 'markdown' | 'html';
export type MailDeliveryVisibility = 'home_members' | 'attn_only' | 'attn_plus_admins';
export type QuickDestinationType = 'home' | 'person' | 'self';

export type QuickComposeForm = {
  destinationType: QuickDestinationType;
  destinationHomeId: string;
  recipientUserId: string;
  recipientQuery: string;
  visibility: MailDeliveryVisibility;
  attnLabel: string;
  type: MailType;
  subject: string;
  content: string;
};

export type StructuredComposeForm = {
  recipientMode: 'self' | 'user' | 'home';
  recipientUserId: string;
  recipientQuery: string;
  recipientHomeId: string;
  type: MailType;
  subject: string;
  content: string;
  objectFormat: ObjectFormat;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string;
  senderBusinessName: string;
  senderAddress: string;
  payoutAmount: string;
};

export type MailTypeConfig = { icon: ReactNode; label: string; color: string };

export type AvailableHome = { id: string; label: string; searchText: string };
