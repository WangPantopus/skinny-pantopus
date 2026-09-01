// ============================================================
// RELATIONSHIP / CONNECTION TYPES
// Based on backend Relationship table + API response shapes
// ============================================================

export type RelationshipStatus = 'pending' | 'accepted' | 'blocked';

export interface RelationshipUser {
  id: string;
  username: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface Relationship {
  id: string;
  status: RelationshipStatus;
  created_at: string;
  responded_at?: string | null;
  accepted_at?: string | null;
  blocked_by?: string | null;
  requester: RelationshipUser;
  addressee: RelationshipUser;
  other_user?: RelationshipUser;
  direction?: 'sent' | 'received';
}

export interface ConnectionRequest {
  id: string;
  status: string;
  created_at: string;
  requester?: RelationshipUser;
  addressee?: RelationshipUser;
}
