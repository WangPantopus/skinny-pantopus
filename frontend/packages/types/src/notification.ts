// ============================================================
// NOTIFICATION TYPES
// Shared between web, mobile, and API packages
// ============================================================

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  icon: string;
  link?: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
  context?: 'personal' | 'audience' | 'platform';
  context_type?: 'personal' | 'business';
  context_id?: string | null;
}
