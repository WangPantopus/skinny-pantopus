// ============================================================
// SUPPORT TRAIN ENDPOINTS
// Community support coordination — meals, groceries, gift funds
// ============================================================

import { get, post, put, patch, del } from '../client';
import type {
  SupportTrain,
  SupportTrainSlot,
  SupportTrainReservation,
  SupportTrainOrganizer,
  SupportTrainRecipientProfile,
  SupportTrainUpdate,
  SupportTrainFundContribution,
  DraftFromStoryRequest,
  DraftFromStoryResponse,
  CreateSupportTrainRequest,
  UpdateSupportTrainRequest,
  GenerateSlotsRequest,
  ReserveSlotRequest,
  CancelReservationRequest,
  RevealSupportTrainAddressResponse,
  SharingMode,
  SlotLabel,
  SupportMode,
  OrganizerRole,
  NearbySupportTrainListItem,
} from '@pantopus/types';

const BASE = '/api/activities/support-trains';

// ─── AI Draft ───────────────────────────────────────────────────────────

export function draftFromStory(data: DraftFromStoryRequest) {
  return post<DraftFromStoryResponse>(`${BASE}/draft-from-story`, data);
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export function createSupportTrain(data: CreateSupportTrainRequest) {
  return post<{ support_train_id: string; activity_id: string; status: string }>(`${BASE}`, data);
}

export function getSupportTrain(id: string) {
  return get<Record<string, unknown>>(`${BASE}/${id}`);
}

export function updateSupportTrain(id: string, data: UpdateSupportTrainRequest) {
  return patch<Record<string, unknown>>(`${BASE}/${id}`, data);
}

// ─── Lifecycle ──────────────────────────────────────────────────────────

export function publishSupportTrain(id: string) {
  return post<Record<string, unknown>>(`${BASE}/${id}/publish`);
}

export function unpublishSupportTrain(id: string) {
  return post<{ id: string; status: string }>(`${BASE}/${id}/unpublish`);
}

export function pauseSupportTrain(id: string) {
  return post<{ id: string; status: string }>(`${BASE}/${id}/pause`);
}

export function resumeSupportTrain(id: string) {
  return post<{ id: string; status: string }>(`${BASE}/${id}/resume`);
}

export function completeSupportTrain(id: string) {
  return post<{ id: string; status: string }>(`${BASE}/${id}/complete`);
}

export function archiveSupportTrain(id: string) {
  return post<{ id: string; status: string }>(`${BASE}/${id}/archive`);
}

export function deleteSupportTrain(id: string) {
  return del<{ id: string; deleted: true }>(`${BASE}/${id}`);
}

// ─── Recipient Profile ──────────────────────────────────────────────────

export function upsertRecipientProfile(id: string, data: Partial<SupportTrainRecipientProfile>) {
  return put<SupportTrainRecipientProfile>(`${BASE}/${id}/recipient-profile`, data);
}

// ─── Slots ──────────────────────────────────────────────────────────────

export function generateSlots(id: string, data: GenerateSlotsRequest) {
  return post<{ slots: SupportTrainSlot[]; count: number }>(`${BASE}/${id}/generate-slots`, data);
}

export function addCustomSlot(
  id: string,
  data: {
    slot_date: string;
    slot_label: SlotLabel;
    support_mode: SupportMode;
    start_time?: string | null;
    end_time?: string | null;
    capacity?: number;
    notes?: string | null;
  }
) {
  return post<SupportTrainSlot>(`${BASE}/${id}/slots`, data);
}

export function updateSlot(
  id: string,
  slotId: string,
  data: {
    slot_label?: SlotLabel;
    support_mode?: SupportMode;
    slot_date?: string;
    start_time?: string | null;
    end_time?: string | null;
    capacity?: number;
    notes?: string | null;
    status?: 'open' | 'canceled';
  }
) {
  return patch<SupportTrainSlot>(`${BASE}/${id}/slots/${slotId}`, data);
}

// ─── Organizers ─────────────────────────────────────────────────────────

export function addOrganizer(id: string, data: { user_id: string; role: OrganizerRole }) {
  return post<SupportTrainOrganizer>(`${BASE}/${id}/organizers`, data);
}

export function removeOrganizer(id: string, userId: string) {
  return del<void>(`${BASE}/${id}/organizers/${userId}`);
}

export function listOrganizers(id: string) {
  return get<{
    organizers: Array<
      SupportTrainOrganizer & {
        user: {
          id: string;
          username: string;
          name: string;
          profile_picture_url: string | null;
        } | null;
      }
    >;
  }>(`${BASE}/${id}/organizers`);
}

// ─── Updates ────────────────────────────────────────────────────────────

export function postUpdate(id: string, data: { body: string; media_urls?: string[] }) {
  return post<SupportTrainUpdate>(`${BASE}/${id}/updates`, data);
}

export function listUpdates(id: string) {
  return get<{
    updates: Array<
      SupportTrainUpdate & {
        author: {
          id: string;
          username: string;
          name: string;
          profile_picture_url: string | null;
        } | null;
      }
    >;
  }>(`${BASE}/${id}/updates`);
}

// ─── Reservations ───────────────────────────────────────────────────────

export function reserveSlot(id: string, slotId: string, data: ReserveSlotRequest) {
  return post<SupportTrainReservation>(`${BASE}/${id}/slots/${slotId}/reserve`, data);
}

export function cancelReservation(
  id: string,
  reservationId: string,
  data?: CancelReservationRequest
) {
  return post<SupportTrainReservation>(
    `${BASE}/${id}/reservations/${reservationId}/cancel`,
    data || {}
  );
}

export function revealReservationAddress(id: string, reservationId: string) {
  return post<RevealSupportTrainAddressResponse>(
    `${BASE}/${id}/reservations/${reservationId}/reveal-address`
  );
}

export function markDelivered(id: string, reservationId: string) {
  return post<SupportTrainReservation>(`${BASE}/${id}/reservations/${reservationId}/deliver`);
}

export function confirmDelivered(id: string, reservationId: string) {
  return post<SupportTrainReservation>(`${BASE}/${id}/reservations/${reservationId}/confirm`);
}

export function listReservations(id: string) {
  return get<{ reservations: SupportTrainReservation[]; viewer_role: string }>(
    `${BASE}/${id}/reservations`
  );
}

// ─── My Support Trains ──────────────────────────────────────────────────

export function listMySupportTrains(params?: {
  role?: 'organizer' | 'helper';
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return get<{
    support_trains: Array<{
      id: string;
      title: string | null;
      status: string;
      published_at: string | null;
      created_at: string;
      my_role: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>(`${BASE}/me/support-trains`, params);
}

/** Published/active trains in radius (Activity visibility nearby/public; requires recipient or activity home with coordinates). */
export function listNearbySupportTrains(params: {
  latitude: number;
  longitude: number;
  radius_meters: number;
  limit?: number;
}) {
  return get<{ support_trains: NearbySupportTrainListItem[] }>(`${BASE}/nearby`, params);
}

// ─── Gift Funds ─────────────────────────────────────────────────────────

export function enableFund(id: string, data?: { goal_amount?: number }) {
  return post<Record<string, unknown>>(`${BASE}/${id}/fund/enable`, data || {});
}

export function disableFund(id: string) {
  return post<Record<string, unknown>>(`${BASE}/${id}/fund/disable`);
}

export function getFund(id: string) {
  return get<{
    enabled: boolean;
    currency: string;
    goal_amount: number | null;
    total_amount: number;
    contribution_count: number;
  }>(`${BASE}/${id}/fund`);
}

export function contributeToFund(
  id: string,
  data: { amount: number; note?: string | null; is_anonymous?: boolean; payment_method_id?: string }
) {
  return post<{
    client_secret: string;
    payment_intent_id: string;
    payment_id: string;
    contribution_id: string | null;
    amount: number;
    fee_cents: number;
    net_to_recipient: number;
  }>(`${BASE}/${id}/fund/contributions`, data);
}

export function listContributions(id: string, params?: { limit?: number; offset?: number }) {
  return get<{
    contributions: Array<
      SupportTrainFundContribution & {
        contributor:
          | { id: string; username: string; name: string; profile_picture_url: string | null }
          | { name: 'Anonymous' }
          | null;
      }
    >;
    total: number;
    limit: number;
    offset: number;
  }>(`${BASE}/${id}/fund/contributions`, params);
}

// ─── Invites ────────────────────────────────────────────────

export function createInvite(
  id: string,
  data: { invitee_user_id?: string; invitee_email?: string }
) {
  return post<Record<string, unknown>>(`${BASE}/${id}/invites`, data);
}

export function listInvites(id: string) {
  return get<{ invites: Array<Record<string, unknown>> }>(`${BASE}/${id}/invites`);
}

// ─── Nudges ─────────────────────────────────────────────────────────────

export function draftOpenSlotsNudge(id: string) {
  return post<{ message: string }>(`${BASE}/${id}/nudges/draft`);
}

export function sendNudge(id: string, data: { message: string }) {
  return post<{ id: string; room_id: string; message: string; created_at: string }>(
    `${BASE}/${id}/nudges/send`,
    data
  );
}
