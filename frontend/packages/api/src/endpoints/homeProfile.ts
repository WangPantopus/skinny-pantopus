// ============================================================
// HOME PROFILE ENDPOINTS
// Dashboard data: tasks, issues, bills, packages, members, etc.
// Maps to the new Home Profile tables (HomeTask, HomeBill, etc.)
// ============================================================

import { get, post, put, patch, del } from '../client';

// ---- HomeTask ----

export async function getHomeTasks(homeId: string, params?: {
  status?: string;
  limit?: number;
}) {
  return get<{ tasks: any[] }>(`/api/homes/${homeId}/tasks`, params);
}

export async function createHomeTask(homeId: string, data: {
  task_type: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_at?: string;
  priority?: string;
  budget?: number;
}) {
  return post<{ task: any }>(`/api/homes/${homeId}/tasks`, data);
}

export async function updateHomeTask(homeId: string, taskId: string, data: Partial<{
  title: string;
  description: string;
  status: string;
  assigned_to: string;
  priority: string;
  due_at: string;
}>) {
  return put<{ task: any }>(`/api/homes/${homeId}/tasks/${taskId}`, data);
}

export async function deleteHomeTask(homeId: string, taskId: string) {
  return del(`/api/homes/${homeId}/tasks/${taskId}`);
}

// ---- Home Gigs (posted from this home) ----

export async function getHomeGigs(homeId: string, params?: {
  status?: string;
  limit?: number;
}) {
  return get<{ gigs: any[] }>(`/api/homes/${homeId}/gigs`, params);
}

// ---- Nearby Gigs ----

export async function getNearbyGigs(homeId: string, params?: {
  limit?: number;
  radius?: number;
}) {
  return get<{ gigs: any[] }>(`/api/homes/${homeId}/nearby-gigs`, params);
}

// ---- HomeIssue ----

export async function getHomeIssues(homeId: string, params?: {
  status?: string;
  severity?: string;
}) {
  return get<{ issues: any[] }>(`/api/homes/${homeId}/issues`, params);
}

export async function createHomeIssue(homeId: string, data: {
  title: string;
  description?: string;
  severity?: string;
}) {
  return post<{ issue: any }>(`/api/homes/${homeId}/issues`, data);
}

export async function updateHomeIssue(homeId: string, issueId: string, data: Partial<{
  title: string;
  description: string;
  status: string;
  severity: string;
  assigned_vendor_id: string;
}>) {
  return put<{ issue: any }>(`/api/homes/${homeId}/issues/${issueId}`, data);
}

// ---- HomeBill + HomeBillSplit ----

export async function getHomeBills(homeId: string, params?: {
  status?: string;
}) {
  return get<{ bills: any[] }>(`/api/homes/${homeId}/bills`, params);
}

export async function createHomeBill(homeId: string, data: {
  bill_type: string;
  provider_name?: string;
  amount: number;
  due_date?: string;
  period_start?: string;
  period_end?: string;
}) {
  return post<{ bill: any }>(`/api/homes/${homeId}/bills`, data);
}

export async function updateHomeBill(homeId: string, billId: string, data: Partial<{
  status: string;
  paid_at: string;
  amount: number;
}>) {
  return put<{ bill: any }>(`/api/homes/${homeId}/bills/${billId}`, data);
}

export async function getHomeBillSplits(homeId: string, billId: string) {
  return get<{ splits: any[] }>(`/api/homes/${homeId}/bills/${billId}/splits`);
}

// ---- HomePackage ----

export async function getHomePackages(homeId: string, params?: {
  status?: string;
}) {
  return get<{ packages: any[] }>(`/api/homes/${homeId}/packages`, params);
}

export async function createHomePackage(homeId: string, data: {
  carrier?: string;
  tracking_number?: string;
  vendor_name?: string;
  description?: string;
  expected_at?: string;
}) {
  return post<{ package: any }>(`/api/homes/${homeId}/packages`, data);
}

export async function updateHomePackage(homeId: string, packageId: string, data: Partial<{
  status: string;
  delivered_at: string;
}>) {
  return put<{ package: any }>(`/api/homes/${homeId}/packages/${packageId}`, data);
}

// ---- HomeCalendarEvent ----

export async function getHomeEvents(homeId: string, params?: {
  start_after?: string;
  start_before?: string;
}) {
  return get<{ events: any[] }>(`/api/homes/${homeId}/events`, params);
}

export async function createHomeEvent(homeId: string, data: {
  event_type: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
}) {
  return post<{ event: any }>(`/api/homes/${homeId}/events`, data);
}

// ---- HomeDocument ----

export async function getHomeDocuments(homeId: string) {
  return get<{ documents: any[] }>(`/api/homes/${homeId}/documents`);
}

// ---- HomeVendor ----

export async function getHomeVendors(homeId: string) {
  return get<{ vendors: any[] }>(`/api/homes/${homeId}/vendors`);
}

export async function createHomeVendor(homeId: string, data: {
  name: string;
  service_category?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  notes?: string;
}) {
  return post<{ vendor: any }>(`/api/homes/${homeId}/vendors`, data);
}

export async function updateHomeVendor(homeId: string, vendorId: string, data: Partial<{
  name: string;
  service_category: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  notes: string;
  trusted: boolean;
}>) {
  return put<{ vendor: any }>(`/api/homes/${homeId}/vendors/${vendorId}`, data);
}

// ---- HomeBusinessLink (linked businesses) ----

export interface HomeBusinessLink {
  id: string;
  home_id: string;
  business_user_id: string;
  kind: 'favorite' | 'vendor' | 'building_amenity' | 'recommended' | 'blocked';
  notes?: string;
  created_by: string;
  created_at: string;
  business?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
    average_rating?: number;
    review_count?: number;
  };
  profile?: {
    business_user_id: string;
    categories?: string[];
    business_type?: string;
    public_phone?: string;
    website?: string;
    is_published?: boolean;
  };
}

export async function getHomeBusinessLinks(homeId: string) {
  return get<{ links: HomeBusinessLink[] }>(`/api/homes/${homeId}/businesses`);
}

export async function searchBusinesses(homeId: string, query: string) {
  return get<{ results: any[] }>(`/api/homes/${homeId}/businesses/search`, { q: query });
}

export async function linkBusiness(homeId: string, data: {
  business_user_id?: string;
  username?: string;
  kind?: 'favorite' | 'vendor' | 'building_amenity' | 'recommended' | 'blocked';
  notes?: string;
}) {
  return post<{ link: HomeBusinessLink }>(`/api/homes/${homeId}/businesses`, data);
}

export async function updateBusinessLink(homeId: string, linkId: string, data: {
  kind?: string;
  notes?: string;
}) {
  return patch<{ link: HomeBusinessLink }>(`/api/homes/${homeId}/businesses/${linkId}`, data);
}

export async function removeBusinessLink(homeId: string, linkId: string) {
  return del<{ message: string }>(`/api/homes/${homeId}/businesses/${linkId}`);
}

// ---- HomeEmergency ----

export async function getHomeEmergencies(homeId: string) {
  return get<{ emergencies: any[] }>(`/api/homes/${homeId}/emergencies`);
}

// ---- HomeAccessSecret ----

export async function getHomeAccessSecrets(homeId: string) {
  return get<{ secrets: any[] }>(`/api/homes/${homeId}/access`);
}

export async function createHomeAccessSecret(
  homeId: string,
  data: { access_type: string; label: string; secret_value: string; notes?: string; visibility?: string },
) {
  return post<{ secret: any }>(`/api/homes/${homeId}/access`, data);
}

export async function updateHomeAccessSecret(
  homeId: string,
  secretId: string,
  data: { access_type?: string; label?: string; secret_value?: string; notes?: string; visibility?: string },
) {
  return put<{ secret: any }>(`/api/homes/${homeId}/access/${secretId}`, data);
}

export async function deleteHomeAccessSecret(homeId: string, secretId: string) {
  return del<{ message: string }>(`/api/homes/${homeId}/access/${secretId}`);
}

// ---- Members (HomeOccupancy + User join) ----

export async function getHomeMembers(homeId: string) {
  return get<{ members: any[] }>(`/api/homes/${homeId}/occupants`);
}

// ---- Dashboard aggregate ----

export async function getHomeDashboard(homeId: string, params?: {
  include_health_score?: boolean;
}) {
  return get<{
    home: any;
    members: any[];
    tasks: any[];
    issues: any[];
    bills: any[];
    packages: any[];
    events: any[];
    health_score?: any;
  }>(`/api/homes/${homeId}/dashboard`, params);
}

// ---- Pets ----

export async function getHomePets(homeId: string) {
  return get<{ pets: any[] }>(`/api/homes/${homeId}/pets`);
}

export async function createHomePet(homeId: string, data: {
  name: string;
  species?: string;
  breed?: string;
  weight_lbs?: number;
  birthday?: string;
  microchip_id?: string;
  vet_name?: string;
  vet_phone?: string;
  notes?: string;
}) {
  return post<{ pet: any }>(`/api/homes/${homeId}/pets`, data);
}

export async function updateHomePet(homeId: string, petId: string, data: Partial<{
  name: string;
  species: string;
  breed: string;
  weight_lbs: number;
  birthday: string;
  microchip_id: string;
  vet_name: string;
  vet_phone: string;
  notes: string;
}>) {
  return put<{ pet: any }>(`/api/homes/${homeId}/pets/${petId}`, data);
}

export async function deleteHomePet(homeId: string, petId: string) {
  return del<{ message: string }>(`/api/homes/${homeId}/pets/${petId}`);
}

// ---- Polls ----

export async function getHomePolls(homeId: string) {
  return get<{ polls: any[] }>(`/api/homes/${homeId}/polls`);
}

export async function createHomePoll(homeId: string, data: {
  question: string;
  poll_type?: string;
  options?: string[];
  closes_at?: string;
}) {
  return post<{ poll: any }>(`/api/homes/${homeId}/polls`, data);
}

export async function voteOnPoll(homeId: string, pollId: string, data: {
  option_index: number;
}) {
  return post<{ vote: any }>(`/api/homes/${homeId}/polls/${pollId}/vote`, data);
}

export async function updateHomePoll(homeId: string, pollId: string, data: Partial<{
  question: string;
  closes_at: string;
  status: string;
}>) {
  return put<{ poll: any }>(`/api/homes/${homeId}/polls/${pollId}`, data);
}

// ---- Activity Log ----

export async function getHomeActivity(homeId: string, params?: {
  page?: number;
  limit?: number;
}) {
  return get<{ activity: any[]; pagination: any }>(`/api/homes/${homeId}/activity`, params);
}

// ---- Settings ----

export async function getHomeSettings(homeId: string) {
  return get<{
    home: {
      name: string;
      home_type: string;
      visibility: string;
      trash_day: string | null;
      house_rules: string | null;
      local_tips: string | null;
      guest_welcome_message: string | null;
      entry_instructions: string | null;
      parking_instructions: string | null;
      default_visibility: string | null;
      default_guest_pass_hours: number | null;
      lockdown_enabled: boolean;
    };
    preferences: Record<string, string>;
  }>(`/api/homes/${homeId}/settings`);
}

export async function updateHomeSettings(homeId: string, data: Partial<{
  trash_day: string;
  house_rules: string;
  local_tips: string;
  guest_welcome_message: string;
  entry_instructions: string;
  parking_instructions: string;
  default_visibility: string;
  default_guest_pass_hours: number;
  preferences: Record<string, any>;
}>) {
  return patch<{ message: string }>(`/api/homes/${homeId}/settings`, data);
}

// ---- Lockdown ----

export async function enableLockdown(homeId: string) {
  return post<{ message: string; home: any; guest_passes_revoked: number }>(`/api/homes/${homeId}/lockdown`);
}

export async function disableLockdown(homeId: string) {
  return del<{ message: string; home: any }>(`/api/homes/${homeId}/lockdown`);
}

// ---- Admin Transfer ----

export async function transferAdmin(homeId: string, data: {
  new_admin_user_id: string;
}) {
  return post<{ message: string; previous_owner: string; new_owner: string }>(`/api/homes/${homeId}/transfer-admin`, data);
}

// ---- Home Intelligence ----

import type { HomeHealthScore, SeasonalChecklist, SeasonalChecklistItem, SeasonalChecklistHistory, BillTrendData, PropertyValueData, HomeTimelineItem } from '@pantopus/types';

export async function getHomeHealthScore(homeId: string, params?: { force?: boolean }) {
  const force = params?.force === true;
  const query = force
    ? { force: 'true' as const, _ts: String(Date.now()) }
    : undefined;
  return get<HomeHealthScore>(
    `/api/homes/${homeId}/health-score`,
    query,
    force
      ? {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        }
      : undefined,
  );
}

export async function getSeasonalChecklist(homeId: string) {
  return get<SeasonalChecklist>(`/api/homes/${homeId}/seasonal-checklist`);
}

export async function updateChecklistItem(homeId: string, itemId: string, status: string) {
  return patch<SeasonalChecklistItem>(`/api/homes/${homeId}/seasonal-checklist/${itemId}`, { status });
}

export async function getSeasonalChecklistHistory(homeId: string) {
  return get<SeasonalChecklistHistory>(`/api/homes/${homeId}/seasonal-checklist/history`);
}

export async function getBillTrends(homeId: string) {
  return get<BillTrendData>(`/api/homes/${homeId}/bill-trends`);
}

export async function setBillBenchmarkOptIn(homeId: string, optedIn: boolean) {
  return patch<{ message: string }>(`/api/homes/${homeId}/settings`, {
    preferences: { bill_benchmark_opt_in: String(optedIn) },
  });
}

export async function getHomeTimeline(homeId: string, page?: number, limit?: number) {
  return get<{ items: HomeTimelineItem[]; total: number; page: number; hasMore: boolean }>(`/api/homes/${homeId}/timeline`, { page, limit });
}

export async function getPropertyValue(homeId: string) {
  return get<PropertyValueData>(`/api/homes/${homeId}/property-value`);
}
