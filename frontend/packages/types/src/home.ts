// ============================================================
// HOME SUB-ENTITY TYPES
// Based on backend/database/schema.sql tables:
// HomeTask, HomeBill, HomePackage, HomePet, HomePoll,
// HomeDocument, HomeEmergency, HomeAccessSecret, HomeVendor,
// HomeAuditLog, HomeOccupancy, HomeGuestPass, HomeOwnershipClaim,
// HomeResidencyClaim, HomeMaintenance
// ============================================================

// ─── Visibility ─────────────────────────────────────────────

export type HomeRecordVisibility = 'public' | 'members' | 'managers' | 'sensitive';

// ─── HomeTask ───────────────────────────────────────────────

export type HomeTaskType = 'chore' | 'shopping' | 'project' | 'reminder' | 'repair';
export type HomeTaskStatus = 'open' | 'in_progress' | 'done' | 'canceled';
export type HomeTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface HomeTask {
  id: string;
  home_id: string;
  task_type: HomeTaskType;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  due_at?: string | null;
  recurrence_rule?: string | null;
  status: HomeTaskStatus;
  priority?: HomeTaskPriority;
  budget?: number | null;
  details?: Record<string, unknown>;
  completed_at?: string | null;
  linked_gig_id?: string | null;
  converted_to_gig_id?: string | null;
  mail_id?: string | null;
  visibility?: HomeRecordVisibility;
  viewer_user_ids?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomeBill ───────────────────────────────────────────────

export type HomeBillType =
  | 'rent' | 'mortgage' | 'electric' | 'gas' | 'water'
  | 'sewer' | 'trash' | 'internet' | 'cable' | 'hoa'
  | 'insurance' | 'subscription' | 'other';

export type HomeBillStatus = 'due' | 'paid' | 'overdue' | 'canceled';

export interface HomeBill {
  id: string;
  home_id: string;
  bill_type: HomeBillType;
  provider_name?: string | null;
  amount: number;
  currency?: string;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  status: HomeBillStatus;
  paid_at?: string | null;
  paid_by?: string | null;
  details?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomePackage ────────────────────────────────────────────

export type HomePackageStatus =
  | 'expected' | 'out_for_delivery' | 'delivered'
  | 'picked_up' | 'lost' | 'returned';

export interface HomePackage {
  id: string;
  home_id: string;
  carrier?: string | null;
  tracking_number?: string | null;
  vendor_name?: string | null;
  description?: string | null;
  delivery_instructions?: string | null;
  status: HomePackageStatus;
  expected_at?: string | null;
  delivered_at?: string | null;
  picked_up_by?: string | null;
  visibility?: HomeRecordVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomePet ────────────────────────────────────────────────

export type HomePetSpecies =
  | 'dog' | 'cat' | 'bird' | 'fish' | 'reptile'
  | 'rabbit' | 'hamster' | 'other';

export interface HomePet {
  id: string;
  home_id: string;
  name: string;
  species: HomePetSpecies;
  breed?: string | null;
  birthday?: string | null;
  age_years?: number | null;
  weight_lbs?: number | null;
  vet_name?: string | null;
  vet_phone?: string | null;
  vet_address?: string | null;
  vaccine_notes?: string | null;
  feeding_schedule?: string | null;
  medications?: string | null;
  microchip_id?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ─── HomePoll ───────────────────────────────────────────────

export type HomePollType = 'single_choice' | 'multiple_choice' | 'yes_no' | 'ranking';
export type HomePollStatus = 'open' | 'closed' | 'canceled';

export interface HomePollOption {
  label: string;
  votes?: number;
}

export interface HomePoll {
  id: string;
  home_id: string;
  title: string;
  description?: string | null;
  poll_type: HomePollType;
  options: HomePollOption[];
  status: HomePollStatus;
  closes_at?: string | null;
  visibility?: HomeRecordVisibility;
  created_by: string;
  created_at: string;
  updated_at?: string;
  // Client-side enrichments
  total_votes?: number;
  my_vote?: number | null;
}

// ─── HomeDocument ───────────────────────────────────────────

export type HomeDocumentType =
  | 'lease' | 'insurance' | 'warranty' | 'manual' | 'permit'
  | 'floor_plan' | 'receipt' | 'photo' | 'paint_color' | 'other';

export interface HomeDocument {
  id: string;
  home_id: string;
  file_id?: string | null;
  doc_type: HomeDocumentType;
  title: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  details?: Record<string, unknown>;
  visibility?: HomeRecordVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomeEmergency ──────────────────────────────────────────

export type HomeEmergencyType =
  | 'shutoff_water' | 'shutoff_gas' | 'shutoff_electric'
  | 'breaker_map' | 'extinguisher' | 'first_aid'
  | 'evac_plan' | 'emergency_contacts' | 'other';

export interface HomeEmergency {
  id: string;
  home_id: string;
  type: HomeEmergencyType;
  label: string;
  location?: string | null;
  details?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomeAccessSecret ───────────────────────────────────────

export type HomeAccessType =
  | 'wifi' | 'door_code' | 'gate_code' | 'lockbox'
  | 'garage' | 'alarm' | 'other';

export interface HomeAccessSecret {
  id?: string;
  home_id?: string;
  access_type: HomeAccessType;
  label: string;
  secret_value?: string | null;
  has_secret?: boolean;
  notes?: string | null;
  visibility?: HomeRecordVisibility;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── HomeVendor ─────────────────────────────────────────────

export interface HomeVendor {
  id: string;
  home_id: string;
  name: string;
  service_category?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  contact?: Record<string, unknown>;
  rating?: number | null;
  notes?: string | null;
  history?: Record<string, unknown>;
  trusted?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── HomeAuditLog ───────────────────────────────────────────

export interface HomeAuditLogEntry {
  id: string;
  home_id: string;
  actor_user_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  created_at: string;
  // Client-side enrichments
  actor?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string | null;
  };
}

// ─── HomeGuestPass ──────────────────────────────────────────

export type GuestPassKind = 'wifi_only' | 'guest' | 'airbnb' | 'vendor';

export interface HomeGuestPass {
  id: string;
  home_id: string;
  label: string;
  kind: GuestPassKind;
  token_hash?: string;
  role_base?: string;
  permissions?: Record<string, boolean>;
  start_at: string;
  end_at?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── HomeMember (occupant + user join) ──────────────────────

export type HomeRoleBase =
  | 'owner' | 'tenant' | 'member' | 'guest' | 'renter'
  | 'roommate' | 'family' | 'property_manager' | 'caregiver'
  | 'admin' | 'manager' | 'restricted_member'
  | 'lease_resident' | 'service_provider';

export type HomeAgeBand = 'adult' | 'teen' | 'child' | 'infant';

export interface HomeMember {
  id: string;
  home_id: string;
  user_id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
  role?: HomeRoleBase;
  role_base?: HomeRoleBase;
  age_band?: HomeAgeBand | null;
  start_at?: string | null;
  end_at?: string | null;
  is_active: boolean;
  can_manage_home?: boolean;
  can_manage_finance?: boolean;
  can_manage_access?: boolean;
  can_manage_tasks?: boolean;
  can_view_sensitive?: boolean;
  access_start_at?: string | null;
  access_end_at?: string | null;
  added_by_user_id?: string | null;
  created_at: string;
  updated_at?: string;
  // User fields from join
  user?: {
    id: string;
    username: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string | null;
    email?: string;
  };
}

// ─── HomeOwnershipClaim ─────────────────────────────────────

export type OwnershipClaimState =
  | 'draft' | 'submitted' | 'challenge_window'
  | 'approved' | 'rejected' | 'withdrawn';

export interface HomeOwnershipClaim {
  id: string;
  home_id: string;
  claimant_user_id: string;
  claim_type: 'owner' | 'admin' | 'resident';
  state: OwnershipClaimState;
  method?: string | null;
  risk_score?: number;
  challenge_window_ends_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at: string;
  // Client-side enrichments
  claimant?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string | null;
  };
}

// ─── HomeResidencyClaim ─────────────────────────────────────

export type ResidencyClaimStatus = 'pending' | 'approved' | 'rejected' | 'verified';

export interface HomeResidencyClaim {
  id: string;
  home_id?: string | null;
  user_id: string;
  claimed_address?: string | null;
  claimed_latitude?: number | null;
  claimed_longitude?: number | null;
  claimed_role?: string;
  status: ResidencyClaimStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at?: string;
  // Client-side enrichments
  user?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string | null;
  };
  claimant?: {
    id: string;
    username?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    profile_picture_url?: string | null;
  };
}

// ─── HomeMaintenance ────────────────────────────────────────

export type MaintenanceType =
  | 'hvac' | 'roof' | 'gutter' | 'appliance' | 'pest'
  | 'plumbing' | 'electrical' | 'landscaping' | 'pool' | 'other';

export type MaintenanceSeason = 'spring' | 'summer' | 'fall' | 'winter';

export interface HomeMaintenanceTemplate {
  id: string;
  home_id: string;
  title: string;
  maint_type?: MaintenanceType | null;
  interval_days?: number | null;
  season?: MaintenanceSeason | null;
  instructions?: string | null;
  default_cost?: number | null;
  created_by: string;
  created_at: string;
}

export interface HomeMaintenanceLog {
  id: string;
  home_id: string;
  template_id?: string | null;
  performed_at: string;
  performed_by?: string | null;
  vendor_id?: string | null;
  cost?: number | null;
  notes?: string | null;
  document_id?: string | null;
  created_at: string;
}

// ─── HomeDashboard (aggregate response) ─────────────────────

export interface HomeDashboard {
  members: HomeMember[];
  tasks: HomeTask[];
  issues: HomeIssue[];
  bills: HomeBill[];
  packages: HomePackage[];
  events: HomeCalendarEvent[];
}

// ─── HomeIssue ──────────────────────────────────────────────

export interface HomeIssue {
  id: string;
  home_id: string;
  title: string;
  description?: string | null;
  severity?: string;
  status?: string;
  assigned_vendor_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ─── HomeCalendarEvent ──────────────────────────────────────

export interface HomeCalendarEvent {
  id: string;
  home_id: string;
  event_type: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  created_by?: string;
  created_at: string;
}

// ─── Home Ownership State ──────────────────────────────────

export type HomeOwnershipState =
  | 'unknown'
  | 'unclaimed'
  | 'claim_pending'
  | 'owner_verified'
  | 'manager_controlled_no_owner'
  | 'disputed';
