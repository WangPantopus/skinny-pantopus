import type { ReactNode } from 'react';

export type MailLink = {
  id: string;
  mail_item_id: string;
  target_type: 'bill' | 'issue' | 'package' | 'document';
  target_id: string;
  created_by: 'system' | 'user';
  status: 'active' | 'undone';
  created_at: string;
  updated_at: string;
};

export type MailItem = {
  id: string;
  type: string;
  subject?: string;
  content: string;
  attachments?: string[];
  viewed: boolean;
  viewed_at?: string | null;
  archived: boolean;
  starred: boolean;
  created_at: string;
  sender_business_name?: string | null;
  sender_address?: string | null;
  sender?: { id?: string; username?: string; name?: string } | null;
  object_id?: string | null;
  content_format?: 'plain_text' | 'markdown' | 'html';
  mail_type?: 'letter' | 'packet' | 'bill' | 'book' | 'notice' | 'promotion' | 'other';
  display_title?: string | null;
  preview_text?: string | null;
  primary_action?: 'open' | 'review' | 'read' | 'view_bill' | 'open_packet' | null;
  action_required?: boolean;
  ack_required?: boolean;
  ack_status?: 'pending' | 'acknowledged' | null;
  recipient_user_id?: string | null;
  recipient_home_id?: string | null;
  recipient_type?: 'user' | 'home' | null;
  recipient_id?: string | null;
  delivery_target_type?: 'home' | 'user' | null;
  delivery_target_id?: string | null;
  address_home_id?: string | null;
  address_id?: string | null;
  attn_user_id?: string | null;
  attn_label?: string | null;
  delivery_visibility?: 'home_members' | 'attn_only' | 'attn_plus_admins' | null;
  payout_amount?: number | null;
  payout_status?: string | null;
  total_read_time_ms?: number | null;
  view_count?: number | null;
  mail_extracted?: Record<string, any> | null;
  links?: MailLink[];
};

export type LinkedTargetPreview = {
  title: string;
  subtitle?: string;
  href?: string;
};

export type DeliverableType = 'letter' | 'packet' | 'bill' | 'book' | 'notice' | 'promotion' | 'other';

export type DeliverableMeta = { label: string; badge: string };

export type TargetTypeMeta = { label: string; icon: ReactNode };
