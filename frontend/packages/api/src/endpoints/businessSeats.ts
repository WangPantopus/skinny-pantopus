// ============================================================
// BUSINESS SEATS ENDPOINTS — Identity Firewall
// Seat management, invite flow, and my-seats
// ============================================================

import { get, post, patch, del } from '../client';
import type {
  SeatListItem,
  SeatDetail,
  MySeat,
  InviteDetails,
  CreateSeatInvitePayload,
  AcceptInvitePayload,
  DeclineInvitePayload,
  UpdateSeatPayload,
  BusinessRoleBase,
} from '@pantopus/types';

// ---- List Seats ----

/**
 * List all seats at a business (caller's seat flagged with is_you)
 */
export async function getBusinessSeats(businessId: string): Promise<{ seats: SeatListItem[] }> {
  return get<{ seats: SeatListItem[] }>(`/api/businesses/${businessId}/seats`);
}

/**
 * Get a single seat's detail
 */
export async function getSeatDetail(businessId: string, seatId: string): Promise<SeatDetail> {
  return get<SeatDetail>(`/api/businesses/${businessId}/seats/${seatId}`);
}

// ---- My Seats (cross-business) ----

/**
 * Get all seats the current user holds across all businesses
 */
export async function getMySeats(): Promise<{ seats: MySeat[] }> {
  return get<{ seats: MySeat[] }>('/api/businesses/my-seats');
}

// ---- Invite Flow ----

/**
 * Create a seat and generate an invite token
 */
export async function createSeatInvite(
  businessId: string,
  data: CreateSeatInvitePayload,
): Promise<{
  message: string;
  seat: SeatListItem;
  invite_token: string;
}> {
  return post(`/api/businesses/${businessId}/seats/invite`, data);
}

/**
 * Preview invite details before accepting
 */
export async function getInviteDetails(token: string): Promise<InviteDetails> {
  return get<InviteDetails>('/api/businesses/seats/invite-details', { token });
}

/**
 * Accept an invitation via token
 */
export async function acceptInvite(data: AcceptInvitePayload): Promise<{
  message: string;
  seat_id: string;
  business_user_id: string;
  role_base: BusinessRoleBase;
}> {
  return post('/api/businesses/seats/accept-invite', data);
}

/**
 * Decline an invitation via token
 */
export async function declineInvite(data: DeclineInvitePayload): Promise<{ message: string }> {
  return post('/api/businesses/seats/decline-invite', data);
}

// ---- Seat Management ----

/**
 * Update seat attributes (display_name, role, contact_method, notes)
 */
export async function updateSeat(
  businessId: string,
  seatId: string,
  data: UpdateSeatPayload,
): Promise<{ message: string; seat: SeatDetail }> {
  return patch(`/api/businesses/${businessId}/seats/${seatId}`, data);
}

/**
 * Deactivate (soft-delete) a seat
 */
export async function removeSeat(
  businessId: string,
  seatId: string,
): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/seats/${seatId}`);
}
