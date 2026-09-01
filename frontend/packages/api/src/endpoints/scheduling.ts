// ============================================================
// CALENDARLY SCHEDULING ENDPOINTS (host / authed)
// Mounted at /api/scheduling (personal & business) and
// /api/homes/:homeId/scheduling (home alias).
//
// Every function accepts an optional `owner?: SchedulingOwnerRef` and
// routes per the GLOBAL WIRING CONTRACT:
//   personal → /api/scheduling, no owner fields
//   business → /api/scheduling + owner_type:'business' + owner_id
//              (query on GET, body on writes)
//   home     → /api/homes/:homeId/scheduling alias (+ owner_type:'home'
//              + owner_id mirrored, which the backend resolves/strips)
//
// See reference/calendarly-backend-api.md for exact request/response shapes.
// ============================================================

import { get, post, put, del } from "../client";
import type {
  SchedulingOwnerRef,
  BookingPage,
  BookingPageInput,
  SlugCheckResult,
  OneOffLink,
  OneOffLinkInput,
  EventType,
  EventTypeDetail,
  EventTypeInput,
  EventTypeAssignee,
  IntakeQuestion,
  AvailabilityBundle,
  AvailabilitySchedule,
  AvailabilityRule,
  AvailabilityOverride,
  AvailabilityBlock,
  NotificationPreferences,
  Booking,
  BookingDetail,
  BookingsSummary,
  BookingCreateInput,
  BookingSlot,
  BookingStatus,
  RsvpStatus,
  Workflow,
  WorkflowInput,
  MessageTemplate,
  MessageTemplateInput,
  MessageTemplatePreview,
  PaymentsStatus,
  ConnectedCalendar,
  Package,
  PackageInput,
  MyPackageCredit,
  BuyPackageResult,
  Invoice,
  Resource,
  ResourceInput,
  ResourceBookingInput,
  Visit,
  VisitInput,
  FindATime,
  FindATimeQuery,
  WhosFree,
  TeamAvailability,
  Poll,
  PollDetail,
  PollInput,
  WaitlistEntry,
  NoShowInsights,
  TeamInsights,
} from "@pantopus/types";

const BASE = "/api/scheduling";

/** Base path for the owner (home routes to the /api/homes/:homeId/scheduling alias). */
function ownerBase(owner?: SchedulingOwnerRef): string {
  if (owner?.ownerType === "home" && owner.homeId) {
    return `/api/homes/${encodeURIComponent(owner.homeId)}/scheduling`;
  }
  return BASE;
}

/**
 * Owner identity params shared by query (GET) and body (writes).
 * Personal → none; business → owner_type/owner_id; home → mirrored (backend
 * resolves the real owner from :homeId and strips these where unused).
 */
function ownerParams(owner?: SchedulingOwnerRef): Record<string, string> {
  if (owner?.ownerType === "business" && owner.ownerId) {
    return { owner_type: "business", owner_id: owner.ownerId };
  }
  if (owner?.ownerType === "home" && owner.homeId) {
    return { owner_type: "home", owner_id: owner.homeId };
  }
  return {};
}

// ─── Booking page ───────────────────────────────────────────

export function getBookingPage(owner?: SchedulingOwnerRef) {
  return get<{ page: BookingPage }>(
    `${ownerBase(owner)}/booking-page`,
    ownerParams(owner),
  );
}

export function updateBookingPage(
  data: BookingPageInput,
  owner?: SchedulingOwnerRef,
) {
  return put<{ page: BookingPage }>(`${ownerBase(owner)}/booking-page`, {
    ...ownerParams(owner),
    ...data,
  });
}

export function updateBookingPageSlug(
  slug: string,
  owner?: SchedulingOwnerRef,
) {
  return put<{ page: BookingPage }>(`${ownerBase(owner)}/booking-page/slug`, {
    ...ownerParams(owner),
    slug,
  });
}

export function checkSlug(slug: string, owner?: SchedulingOwnerRef) {
  return get<SlugCheckResult>(`${ownerBase(owner)}/booking-page/check-slug`, {
    ...ownerParams(owner),
    slug,
  });
}

export function resetSlug(owner?: SchedulingOwnerRef) {
  return post<{ page: BookingPage }>(
    `${ownerBase(owner)}/booking-page/reset-slug`,
    {
      ...ownerParams(owner),
    },
  );
}

export function disableBookingPage(owner?: SchedulingOwnerRef) {
  return post<{ page: BookingPage }>(
    `${ownerBase(owner)}/booking-page/disable`,
    {
      ...ownerParams(owner),
    },
  );
}

export function createOneOffLink(
  data: OneOffLinkInput,
  owner?: SchedulingOwnerRef,
) {
  return post<OneOffLink>(`${ownerBase(owner)}/booking-page/one-off-links`, {
    ...ownerParams(owner),
    ...data,
  });
}

// ─── Event types ────────────────────────────────────────────

export function listEventTypes(owner?: SchedulingOwnerRef) {
  return get<{ eventTypes: EventType[] }>(
    `${ownerBase(owner)}/event-types`,
    ownerParams(owner),
  );
}

export function createEventType(
  data: EventTypeInput,
  owner?: SchedulingOwnerRef,
) {
  return post<{ eventType: EventType }>(`${ownerBase(owner)}/event-types`, {
    ...ownerParams(owner),
    ...data,
  });
}

export function getEventType(id: string, owner?: SchedulingOwnerRef) {
  return get<EventTypeDetail>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(id)}`,
    ownerParams(owner),
  );
}

export function updateEventType(
  id: string,
  data: Partial<EventTypeInput>,
  owner?: SchedulingOwnerRef,
) {
  return put<{ eventType: EventType }>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function deleteEventType(id: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
    },
  );
}

/** Replaces the entire assignee set (DELETE then INSERT). */
export function updateAssignees(
  id: string,
  assignees: EventTypeAssignee[],
  owner?: SchedulingOwnerRef,
) {
  return put<{ assignees: EventTypeAssignee[] }>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(id)}/assignees`,
    { ...ownerParams(owner), assignees },
  );
}

/** Replaces the entire question set. */
export function updateQuestions(
  id: string,
  questions: IntakeQuestion[],
  owner?: SchedulingOwnerRef,
) {
  return put<{ questions: IntakeQuestion[] }>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(id)}/questions`,
    { ...ownerParams(owner), questions },
  );
}

// ─── Availability ───────────────────────────────────────────
// Availability is ALWAYS personal (req.user); owner only selects the
// route base so the home alias (F8) works. No owner params are sent.

export function getAvailability(owner?: SchedulingOwnerRef) {
  return get<AvailabilityBundle>(`${ownerBase(owner)}/availability`);
}

export function createSchedule(
  data: { name?: string; timezone: string; is_default?: boolean },
  owner?: SchedulingOwnerRef,
) {
  return post<{ schedule: AvailabilitySchedule }>(
    `${ownerBase(owner)}/availability`,
    data,
  );
}

export function updateSchedule(
  id: string,
  data: { name?: string; timezone?: string; is_default?: boolean },
  owner?: SchedulingOwnerRef,
) {
  return put<{ schedule: AvailabilitySchedule }>(
    `${ownerBase(owner)}/availability/${encodeURIComponent(id)}`,
    data,
  );
}

export function deleteSchedule(id: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/availability/${encodeURIComponent(id)}`,
  );
}

/** Replaces the entire weekly-rule set for a schedule. */
export function updateRules(
  id: string,
  rules: AvailabilityRule[],
  owner?: SchedulingOwnerRef,
) {
  return put<{ rules: AvailabilityRule[] }>(
    `${ownerBase(owner)}/availability/${encodeURIComponent(id)}/rules`,
    { rules },
  );
}

/** Replaces the entire date-override set for a schedule. */
export function updateOverrides(
  id: string,
  overrides: AvailabilityOverride[],
  owner?: SchedulingOwnerRef,
) {
  return put<{ overrides: AvailabilityOverride[] }>(
    `${ownerBase(owner)}/availability/${encodeURIComponent(id)}/overrides`,
    { overrides },
  );
}

export function createBlock(
  data: {
    title?: string;
    start_at: string;
    end_at: string;
    recurrence_rule?: string;
  },
  owner?: SchedulingOwnerRef,
) {
  return post<{ block: AvailabilityBlock }>(
    `${ownerBase(owner)}/availability/blocks`,
    data,
  );
}

export function deleteBlock(blockId: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/availability/blocks/${encodeURIComponent(blockId)}`,
  );
}

// ─── Notification preferences ───────────────────────────────

export function getNotificationPreferences(owner?: SchedulingOwnerRef) {
  return get<{ prefs: NotificationPreferences }>(
    `${ownerBase(owner)}/notification-preferences`,
  );
}

export function updateNotificationPreferences(
  prefs: NotificationPreferences,
  owner?: SchedulingOwnerRef,
) {
  return put<{ prefs: NotificationPreferences }>(
    `${ownerBase(owner)}/notification-preferences`,
    { prefs },
  );
}

// ─── Workflows ──────────────────────────────────────────────

export function listWorkflows(owner?: SchedulingOwnerRef) {
  return get<{ workflows: Workflow[] }>(
    `${ownerBase(owner)}/workflows`,
    ownerParams(owner),
  );
}

export function createWorkflow(
  data: WorkflowInput,
  owner?: SchedulingOwnerRef,
) {
  return post<{ workflow: Workflow }>(`${ownerBase(owner)}/workflows`, {
    ...ownerParams(owner),
    ...data,
  });
}

export function updateWorkflow(
  id: string,
  data: Partial<WorkflowInput>,
  owner?: SchedulingOwnerRef,
) {
  return put<{ workflow: Workflow }>(
    `${ownerBase(owner)}/workflows/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function deleteWorkflow(id: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/workflows/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
    },
  );
}

// ─── Message templates ──────────────────────────────────────

export function listMessageTemplates(owner?: SchedulingOwnerRef) {
  return get<{ templates: MessageTemplate[] }>(
    `${ownerBase(owner)}/message-templates`,
    ownerParams(owner),
  );
}

export function createMessageTemplate(
  data: MessageTemplateInput,
  owner?: SchedulingOwnerRef,
) {
  return post<{ template: MessageTemplate }>(
    `${ownerBase(owner)}/message-templates`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function previewMessageTemplate(data: {
  subject?: string;
  body: string;
  variables?: Record<string, unknown>;
}) {
  return post<MessageTemplatePreview>(
    `${BASE}/message-templates/preview`,
    data,
  );
}

export function updateMessageTemplate(
  id: string,
  data: Partial<MessageTemplateInput>,
  owner?: SchedulingOwnerRef,
) {
  return put<{ template: MessageTemplate }>(
    `${ownerBase(owner)}/message-templates/${encodeURIComponent(id)}`,
    { ...ownerParams(owner), ...data },
  );
}

export function deleteMessageTemplate(id: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/message-templates/${encodeURIComponent(id)}`,
    { ...ownerParams(owner) },
  );
}

// ─── Payments & connected calendars ─────────────────────────

export function getPaymentsStatus(owner?: SchedulingOwnerRef) {
  return get<PaymentsStatus>(
    `${ownerBase(owner)}/payments/status`,
    ownerParams(owner),
  );
}

export function getConnectedCalendars(owner?: SchedulingOwnerRef) {
  return get<{ calendars: ConnectedCalendar[] }>(
    `${ownerBase(owner)}/connected-calendars`,
  );
}

/** Returns 501 NOT_AVAILABLE (OAuth sync deferred) → surface "coming soon". */
export function connectCalendar(owner?: SchedulingOwnerRef) {
  return post<{ error: string; message: string }>(
    `${ownerBase(owner)}/connected-calendars/connect`,
    {},
  );
}

// ─── Bookings ───────────────────────────────────────────────

export interface BookingListParams {
  status?: "upcoming" | "pending" | "past" | "cancelled";
  event_type_id?: string;
  from?: string;
  to?: string;
  q?: string;
}

export function listBookings(
  params?: BookingListParams,
  owner?: SchedulingOwnerRef,
) {
  return get<{ bookings: Booking[] }>(`${ownerBase(owner)}/bookings`, {
    ...ownerParams(owner),
    ...(params || {}),
  });
}

export function getBookingsSummary(owner?: SchedulingOwnerRef) {
  return get<BookingsSummary>(
    `${ownerBase(owner)}/bookings/summary`,
    ownerParams(owner),
  );
}

export function getBooking(id: string, owner?: SchedulingOwnerRef) {
  return get<BookingDetail>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}`,
    ownerParams(owner),
  );
}

export function getBookingAvailableSlots(
  id: string,
  params: { from: string; to: string; tz?: string },
  owner?: SchedulingOwnerRef,
) {
  return get<{ slots: BookingSlot[] }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/available-slots`,
    { ...ownerParams(owner), ...params },
  );
}

export function createBooking(
  data: BookingCreateInput,
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking; attendees: unknown[] }>(
    `${ownerBase(owner)}/bookings`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function approveBooking(id: string, owner?: SchedulingOwnerRef) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/approve`,
    {
      ...ownerParams(owner),
    },
  );
}

export function declineBooking(
  id: string,
  reason?: string,
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/decline`,
    {
      ...ownerParams(owner),
      reason,
    },
  );
}

export function cancelBooking(
  id: string,
  reason?: string,
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/cancel`,
    {
      ...ownerParams(owner),
      reason,
    },
  );
}

export function rescheduleBooking(
  id: string,
  data: { start_at: string; host_user_id?: string; reason?: string },
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/reschedule`,
    { ...ownerParams(owner), ...data },
  );
}

export function noShowBooking(id: string, owner?: SchedulingOwnerRef) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/no-show`,
    {
      ...ownerParams(owner),
    },
  );
}

export function reassignBooking(
  id: string,
  data: { host_user_id: string; reason?: string },
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/reassign`,
    { ...ownerParams(owner), ...data },
  );
}

/** Attendee self-service RSVP (not owner-gated). */
export function rsvpBooking(
  id: string,
  status: RsvpStatus,
  owner?: SchedulingOwnerRef,
) {
  return post<{ attendee: { id: string; rsvp_status: RsvpStatus } }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/rsvp`,
    { status },
  );
}

export function createRecurringBookings(
  data: {
    event_type_id: string;
    sessions: string[];
    invitee_name?: string;
    invitee_email?: string;
    invitee_timezone?: string;
  },
  owner?: SchedulingOwnerRef,
) {
  return post<{ bookings: Booking[] }>(
    `${ownerBase(owner)}/bookings/recurring`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function nudgeBooking(
  id: string,
  message?: string,
  owner?: SchedulingOwnerRef,
) {
  return post<{ ok: true }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/nudge`,
    {
      ...ownerParams(owner),
      message,
    },
  );
}

export function proposeReschedule(
  id: string,
  data: { start_at: string; host_user_id?: string },
  owner?: SchedulingOwnerRef,
) {
  return post<{ booking: Booking }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/propose-reschedule`,
    { ...ownerParams(owner), ...data },
  );
}

/** Customer applies a package credit to their own booking (not owner-gated). */
export function applyCredit(
  id: string,
  creditId: string,
  owner?: SchedulingOwnerRef,
) {
  return post<{ ok: true; remaining: number }>(
    `${ownerBase(owner)}/bookings/${encodeURIComponent(id)}/apply-credit`,
    { credit_id: creditId },
  );
}

export function getNoShowInsights(days = 90, owner?: SchedulingOwnerRef) {
  // Backend route is GET /insights/no-shows (no /bookings prefix).
  return get<NoShowInsights>(`${ownerBase(owner)}/insights/no-shows`, {
    ...ownerParams(owner),
    days,
  });
}

export function getTeamInsights(days = 90, owner?: SchedulingOwnerRef) {
  // Backend route is GET /insights/team (no /bookings prefix).
  return get<TeamInsights>(`${ownerBase(owner)}/insights/team`, {
    ...ownerParams(owner),
    days,
  });
}

// ─── Invoices (business-only) ───────────────────────────────

export function listInvoices(owner?: SchedulingOwnerRef) {
  return get<{ invoices: Invoice[] }>(
    `${ownerBase(owner)}/invoices`,
    ownerParams(owner),
  );
}

export function getInvoice(id: string, owner?: SchedulingOwnerRef) {
  return get<{ invoice: Invoice }>(
    `${ownerBase(owner)}/invoices/${encodeURIComponent(id)}`,
    ownerParams(owner),
  );
}

export function sendInvoice(id: string, owner?: SchedulingOwnerRef) {
  return post<{ ok: true }>(
    `${ownerBase(owner)}/invoices/${encodeURIComponent(id)}/send`,
    {
      ...ownerParams(owner),
    },
  );
}

// ─── Packages ───────────────────────────────────────────────

export function listPackages(owner?: SchedulingOwnerRef) {
  return get<{ packages: Package[] }>(
    `${ownerBase(owner)}/packages`,
    ownerParams(owner),
  );
}

export function createPackage(data: PackageInput, owner?: SchedulingOwnerRef) {
  return post<{ package: Package }>(`${ownerBase(owner)}/packages`, {
    ...ownerParams(owner),
    ...data,
  });
}

export function updatePackage(
  id: string,
  data: Partial<PackageInput>,
  owner?: SchedulingOwnerRef,
) {
  return put<{ package: Package }>(
    `${ownerBase(owner)}/packages/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function deletePackage(id: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/packages/${encodeURIComponent(id)}`,
    {
      ...ownerParams(owner),
    },
  );
}

/** Customer purchase (not owner-gated). Returns Stripe clientSecret when priced. */
export function buyPackage(id: string, owner?: SchedulingOwnerRef) {
  return post<BuyPackageResult>(
    `${ownerBase(owner)}/packages/${encodeURIComponent(id)}/buy`,
    {},
  );
}

export function getMyPackages(owner?: SchedulingOwnerRef) {
  return get<{ credits: MyPackageCredit[] }>(`${ownerBase(owner)}/my-packages`);
}

// ─── My bookings (customer) ─────────────────────────────────

export function getMyBookings(owner?: SchedulingOwnerRef) {
  return get<{ bookings: Booking[] }>(`${ownerBase(owner)}/my-bookings`);
}

// ─── Home: find-a-time, who's-free ──────────────────────────

export function getFindATime(
  params: FindATimeQuery,
  owner?: SchedulingOwnerRef,
) {
  // Backend route is POST /find-a-time — validate(findATimeSchema) reads
  // req.body, so params must be sent as the body, not as a query string.
  return post<FindATime>(`${ownerBase(owner)}/find-a-time`, {
    ...ownerParams(owner),
    ...params,
  });
}

export function getWhosFree(
  params: { from: string; to: string; tz?: string },
  owner?: SchedulingOwnerRef,
) {
  return get<WhosFree>(`${ownerBase(owner)}/whos-free`, {
    ...ownerParams(owner),
    ...params,
  });
}

// ─── Home: resources & visits ───────────────────────────────

export function listResources(owner?: SchedulingOwnerRef) {
  return get<{ resources: Resource[] }>(
    `${ownerBase(owner)}/resources`,
    ownerParams(owner),
  );
}

export function createResource(
  data: ResourceInput,
  owner?: SchedulingOwnerRef,
) {
  return post<{ resource: Resource }>(`${ownerBase(owner)}/resources`, {
    ...ownerParams(owner),
    ...data,
  });
}

export function updateResource(
  rid: string,
  data: Partial<ResourceInput>,
  owner?: SchedulingOwnerRef,
) {
  return put<{ resource: Resource }>(
    `${ownerBase(owner)}/resources/${encodeURIComponent(rid)}`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function deleteResource(rid: string, owner?: SchedulingOwnerRef) {
  return del<{ ok: true }>(
    `${ownerBase(owner)}/resources/${encodeURIComponent(rid)}`,
    {
      ...ownerParams(owner),
    },
  );
}

export function bookResource(
  rid: string,
  data: ResourceBookingInput,
  owner?: SchedulingOwnerRef,
) {
  // The backend inserts a full Booking row (booker → invitee_*, status
  // 'pending' when the resource requires approval) and returns select('*').
  return post<{ booking: Booking & { resource_id: string | null } }>(
    `${ownerBase(owner)}/resources/${encodeURIComponent(rid)}/book`,
    { ...ownerParams(owner), ...data },
  );
}

export function createVisit(data: VisitInput, owner?: SchedulingOwnerRef) {
  return post<{ visit: Visit }>(`${ownerBase(owner)}/visits`, {
    ...ownerParams(owner),
    ...data,
  });
}

// ─── Waitlist ───────────────────────────────────────────────

export function getEventTypeWaitlist(
  eventTypeId: string,
  owner?: SchedulingOwnerRef,
) {
  return get<{ waitlist: WaitlistEntry[] }>(
    `${ownerBase(owner)}/event-types/${encodeURIComponent(eventTypeId)}/waitlist`,
    ownerParams(owner),
  );
}

export function promoteWaitlist(id: string, owner?: SchedulingOwnerRef) {
  return post<{ ok: true }>(
    `${ownerBase(owner)}/waitlist/${encodeURIComponent(id)}/promote`,
    {
      ...ownerParams(owner),
    },
  );
}

// ─── Polls ──────────────────────────────────────────────────

export function createPoll(data: PollInput, owner?: SchedulingOwnerRef) {
  return post<{ poll: Poll; options: PollDetail["options"] }>(
    `${ownerBase(owner)}/polls`,
    {
      ...ownerParams(owner),
      ...data,
    },
  );
}

export function listPolls(owner?: SchedulingOwnerRef) {
  return get<{ polls: Poll[] }>(
    `${ownerBase(owner)}/polls`,
    ownerParams(owner),
  );
}

export function getPoll(id: string, owner?: SchedulingOwnerRef) {
  return get<PollDetail>(
    `${ownerBase(owner)}/polls/${encodeURIComponent(id)}`,
    ownerParams(owner),
  );
}

export function finalizePoll(
  id: string,
  optionId: string,
  owner?: SchedulingOwnerRef,
) {
  return post<{ poll: Poll; finalized_start_at: string }>(
    `${ownerBase(owner)}/polls/${encodeURIComponent(id)}/finalize`,
    { ...ownerParams(owner), option_id: optionId },
  );
}

// ─── Team availability (business-only) ──────────────────────

export function getTeamAvailability(
  params: { from: string; to: string; tz?: string },
  owner?: SchedulingOwnerRef,
) {
  return get<TeamAvailability>(`${ownerBase(owner)}/team-availability`, {
    ...ownerParams(owner),
    ...params,
  });
}
