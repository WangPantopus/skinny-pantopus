//
//  SchedulingEndpoints.swift
//  Pantopus
//
//  Host endpoint builders for Calendarly — `/api/scheduling/*` (personal /
//  business) AND the `/api/homes/:homeId/scheduling/*` alias (home). Every
//  builder takes a `SchedulingOwner`, which supplies the path prefix and the
//  owner context. See `reference/calendarly-backend-api.md`.
//
//  Owner-context rules (so we never fight the backend `withOwner` resolver or a
//  Joi `.unknown(false)` schema):
//   • Path prefix comes from `owner.pathPrefix` (home → the per-home alias).
//   • Owner context is ALWAYS placed in the GET/write QUERY via
//     `owner.queryItems` (business only; personal/home add nothing). `withOwner`
//     reads it there and unused query params are inert.
//   • Owner is ALSO spliced into a write BODY (via `OwnerScopedBody`) ONLY for
//     the routes whose Joi schema explicitly accepts `owner_type`/`owner_id`
//     (POST create routes + the two booking-page writes). Partial PUTs and
//     `:id`-scoped mutations resolve the owner from the loaded row, so their
//     bodies stay clean.
//   • Always-personal routes (availability, notification-preferences,
//     connected-calendars) and customer self-service routes (my-bookings,
//     my-packages, buy, apply-credit, rsvp) ignore owner entirely.
//
// swiftlint:disable file_length type_body_length

import Foundation

/// Endpoint builders for the host scheduling router
/// (`backend/routes/scheduling.js`).
public enum SchedulingEndpoints {
    // MARK: - Query helper

    /// Build a query dict: the owner's GET owner context merged with the
    /// endpoint's (optional) filters. Nil filter values are dropped.
    private static func query(
        _ owner: SchedulingOwner,
        _ filters: [String: String?] = [:]
    ) -> [String: String] {
        var result = owner.queryItems
        for (key, value) in filters {
            if let value { result[key] = value }
        }
        return result
    }

    // MARK: - Booking page

    /// `GET /booking-page` — auto-creates if missing. Returns `{ page }`.
    public static func getBookingPage(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/booking-page", query: query(owner))
    }

    /// `PUT /booking-page` — partial update (owner fields stripped server-side).
    public static func updateBookingPage(
        owner: SchedulingOwner,
        _ request: BookingPageUpdateRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/booking-page",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `PUT /booking-page/slug` — 409 `SLUG_TAKEN` if taken.
    public static func updateBookingPageSlug(
        owner: SchedulingOwner,
        _ request: BookingPageSlugRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/booking-page/slug",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `GET /booking-page/check-slug?slug=` — `{ available, suggestions }`.
    public static func checkSlug(owner: SchedulingOwner, slug: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/booking-page/check-slug",
            query: query(owner, ["slug": slug])
        )
    }

    /// `POST /booking-page/reset-slug` — danger zone; new random slug.
    public static func resetSlug(owner: SchedulingOwner) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/booking-page/reset-slug",
            query: query(owner)
        )
    }

    /// `POST /booking-page/disable` — `is_live=false`.
    public static func disableBookingPage(owner: SchedulingOwner) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/booking-page/disable",
            query: query(owner)
        )
    }

    /// `POST /booking-page/one-off-links` — returns `{ token, path, expires_at }`.
    public static func createOneOffLink(
        owner: SchedulingOwner,
        _ request: OneOffLinkRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/booking-page/one-off-links",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    // MARK: - Event types

    /// `GET /event-types` — `{ eventTypes }`.
    public static func getEventTypes(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/event-types", query: query(owner))
    }

    /// `POST /event-types` — 409 `SLUG_TAKEN`. `{ eventType }`.
    public static func createEventType(
        owner: SchedulingOwner,
        _ request: CreateEventTypeRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/event-types",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `GET /event-types/:id` — event type + assignees + questions.
    public static func getEventType(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/event-types/\(id)",
            query: query(owner)
        )
    }

    /// `PUT /event-types/:id` — partial update (owner from loaded row).
    public static func updateEventType(
        owner: SchedulingOwner,
        id: String,
        _ request: UpdateEventTypeRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/event-types/\(id)",
            query: query(owner),
            body: request
        )
    }

    /// `DELETE /event-types/:id` — 409 `HAS_UPCOMING_BOOKINGS`.
    public static func deleteEventType(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "\(owner.pathPrefix)/event-types/\(id)",
            query: query(owner)
        )
    }

    /// `PUT /event-types/:id/assignees` — replaces the whole set.
    public static func setEventTypeAssignees(
        owner: SchedulingOwner,
        id: String,
        _ request: AssigneesRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/event-types/\(id)/assignees",
            query: query(owner),
            body: request
        )
    }

    /// `PUT /event-types/:id/questions` — replaces the whole set.
    public static func setEventTypeQuestions(
        owner: SchedulingOwner,
        id: String,
        _ request: QuestionsRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/event-types/\(id)/questions",
            query: query(owner),
            body: request
        )
    }

    /// `GET /event-types/:id/waitlist` — `{ waitlist }`.
    public static func getWaitlist(owner: SchedulingOwner, eventTypeId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/event-types/\(eventTypeId)/waitlist",
            query: query(owner)
        )
    }

    /// `POST /waitlist/:id/promote` — `{ ok: true }`.
    public static func promoteWaitlist(owner: SchedulingOwner, entryId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/waitlist/\(entryId)/promote",
            query: query(owner)
        )
    }

    // MARK: - Availability (always personal — no owner context)

    /// `GET /availability` — schedules + rules + overrides.
    public static func getAvailability() -> Endpoint {
        Endpoint(method: .get, path: "/api/scheduling/availability")
    }

    /// `POST /availability` — `{ schedule }`.
    public static func createSchedule(_ request: CreateScheduleRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/availability", body: request)
    }

    /// `PUT /availability/:id` — partial update.
    public static func updateSchedule(id: String, _ request: UpdateScheduleRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/scheduling/availability/\(id)", body: request)
    }

    /// `DELETE /availability/:id` — 409 `CANNOT_DELETE_DEFAULT`.
    public static func deleteSchedule(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/scheduling/availability/\(id)")
    }

    /// `PUT /availability/:id/rules` — replaces the whole rule set.
    public static func setRules(scheduleId: String, _ request: RulesRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/scheduling/availability/\(scheduleId)/rules", body: request)
    }

    /// `PUT /availability/:id/overrides` — replaces the whole override set.
    public static func setOverrides(scheduleId: String, _ request: OverridesRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/scheduling/availability/\(scheduleId)/overrides", body: request)
    }

    /// `POST /availability/blocks` — `{ block }`.
    public static func createBlock(_ request: CreateBlockRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/availability/blocks", body: request)
    }

    /// `DELETE /availability/blocks/:blockId` — `{ ok: true }`.
    public static func deleteBlock(blockId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/scheduling/availability/blocks/\(blockId)")
    }

    // MARK: - Notification preferences (always personal)

    /// `GET /notification-preferences` — `{ prefs }`.
    public static func getNotificationPreferences() -> Endpoint {
        Endpoint(method: .get, path: "/api/scheduling/notification-preferences")
    }

    /// `PUT /notification-preferences` — `{ prefs }`.
    public static func updateNotificationPreferences(
        _ request: UpdateNotificationPreferencesRequest
    ) -> Endpoint {
        Endpoint(method: .put, path: "/api/scheduling/notification-preferences", body: request)
    }

    // MARK: - Payments + connected calendars

    /// `GET /payments/status` — Stripe Connect status (homes → applicable:false).
    public static func paymentsStatus(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/payments/status", query: query(owner))
    }

    /// `GET /connected-calendars` — `{ calendars }` (empty in v1; personal).
    public static func getConnectedCalendars() -> Endpoint {
        Endpoint(method: .get, path: "/api/scheduling/connected-calendars")
    }

    /// `POST /connected-calendars/connect` — returns 501 `NOT_AVAILABLE`
    /// ("coming soon"). Personal.
    public static func connectCalendar() -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/connected-calendars/connect")
    }

    // MARK: - Message templates

    /// `GET /message-templates` — `{ templates }`.
    public static func getMessageTemplates(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/message-templates", query: query(owner))
    }

    /// `POST /message-templates` — `{ template }`.
    public static func createMessageTemplate(
        owner: SchedulingOwner,
        _ request: CreateMessageTemplateRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/message-templates",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `PUT /message-templates/:id` — partial update.
    public static func updateMessageTemplate(
        owner: SchedulingOwner,
        id: String,
        _ request: UpdateMessageTemplateRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/message-templates/\(id)",
            query: query(owner),
            body: request
        )
    }

    /// `DELETE /message-templates/:id` — `{ ok: true }`.
    public static func deleteMessageTemplate(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "\(owner.pathPrefix)/message-templates/\(id)",
            query: query(owner)
        )
    }

    /// `POST /message-templates/preview` — interpolates `{{variable}}`. No owner
    /// gate.
    public static func previewMessageTemplate(_ request: TemplatePreviewRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/message-templates/preview", body: request)
    }

    // MARK: - Workflows

    /// `GET /workflows` — `{ workflows }`.
    public static func getWorkflows(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/workflows", query: query(owner))
    }

    /// `POST /workflows` — `{ workflow }`.
    public static func createWorkflow(
        owner: SchedulingOwner,
        _ request: CreateWorkflowRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/workflows",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `PUT /workflows/:id` — partial update.
    public static func updateWorkflow(
        owner: SchedulingOwner,
        id: String,
        _ request: UpdateWorkflowRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/workflows/\(id)",
            query: query(owner),
            body: request
        )
    }

    /// `DELETE /workflows/:id` — `{ ok: true }`.
    public static func deleteWorkflow(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .delete, path: "\(owner.pathPrefix)/workflows/\(id)", query: query(owner))
    }

    // MARK: - Bookings (list + lifecycle)

    /// `GET /bookings` — filters: status / event_type_id / from / to / q.
    public static func getBookings(
        owner: SchedulingOwner,
        status: String? = nil,
        eventTypeId: String? = nil,
        from: String? = nil,
        to: String? = nil,
        search: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/bookings",
            query: query(owner, [
                "status": status,
                "event_type_id": eventTypeId,
                "from": from,
                "to": to,
                "q": search
            ])
        )
    }

    /// `GET /bookings/summary` — Hub summary card counts + next booking.
    public static func getBookingsSummary(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/bookings/summary", query: query(owner))
    }

    /// `GET /bookings/:id` — booking + attendees + minimal event type.
    public static func getBooking(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/bookings/\(id)", query: query(owner))
    }

    /// `GET /bookings/:id/available-slots?from&to&tz` — reschedule/reassign
    /// slots (excludes the current booking).
    public static func getBookingAvailableSlots(
        owner: SchedulingOwner,
        id: String,
        from: String,
        to: String,
        tz: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/bookings/\(id)/available-slots",
            query: query(owner, ["from": from, "to": to, "tz": tz])
        )
    }

    /// `POST /bookings` — manual host booking. 409 alternatives on conflict.
    public static func createBooking(
        owner: SchedulingOwner,
        _ request: CreateBookingRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `POST /bookings/recurring` — linked bookings from `sessions[]`.
    public static func createRecurringBookings(
        owner: SchedulingOwner,
        _ request: RecurringBookingRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/recurring",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `POST /bookings/:id/approve` — pending → confirmed.
    public static func approveBooking(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/approve",
            query: query(owner)
        )
    }

    /// `POST /bookings/:id/decline` — pending → declined.
    public static func declineBooking(
        owner: SchedulingOwner,
        id: String,
        _ request: BookingReasonRequest = BookingReasonRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/decline",
            query: query(owner),
            body: request
        )
    }

    /// `POST /bookings/:id/cancel` — confirmed → cancelled (+ refund logic).
    public static func cancelBooking(
        owner: SchedulingOwner,
        id: String,
        _ request: BookingReasonRequest = BookingReasonRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/cancel",
            query: query(owner),
            body: request
        )
    }

    /// `POST /bookings/:id/reschedule` — new start (+ optional host reassign).
    public static func rescheduleBooking(
        owner: SchedulingOwner,
        id: String,
        _ request: RescheduleBookingRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/reschedule",
            query: query(owner),
            body: request
        )
    }

    /// `POST /bookings/:id/no-show` — 409 `NOT_APPLICABLE_YET` before event end.
    public static func markNoShow(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/no-show",
            query: query(owner)
        )
    }

    /// `POST /bookings/:id/reassign` — home/business; 409 `INVALID_HOST`.
    public static func reassignBooking(
        owner: SchedulingOwner,
        id: String,
        _ request: ReassignBookingRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/reassign",
            query: query(owner),
            body: request
        )
    }

    /// `POST /bookings/:id/propose-reschedule` — pending proposal to invitee.
    public static func proposeReschedule(
        owner: SchedulingOwner,
        id: String,
        _ request: ProposeRescheduleRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/propose-reschedule",
            query: query(owner),
            body: request
        )
    }

    /// `POST /bookings/:id/nudge` — reminder to invitee.
    public static func nudgeBooking(
        owner: SchedulingOwner,
        id: String,
        _ request: NudgeRequest = NudgeRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/bookings/\(id)/nudge",
            query: query(owner),
            body: request
        )
    }

    // MARK: - Bookings: customer / attendee self-service (not owner-gated)

    /// `POST /bookings/:id/rsvp` — attendee self-service RSVP.
    public static func rsvpBooking(bookingId: String, _ request: BookingRsvpRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/bookings/\(bookingId)/rsvp", body: request)
    }

    /// `POST /bookings/:id/apply-credit` — customer applies a package credit.
    public static func applyCredit(bookingId: String, _ request: ApplyCreditRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/bookings/\(bookingId)/apply-credit", body: request)
    }

    /// `GET /my-bookings` — all bookings for the signed-in user.
    public static func getMyBookings() -> Endpoint {
        Endpoint(method: .get, path: "/api/scheduling/my-bookings")
    }

    // MARK: - Insights

    /// `GET /insights/no-shows?days` — no-show analytics. (Backend mounts this
    /// directly on the scheduling router — no `/bookings` segment.)
    public static func noShowInsights(owner: SchedulingOwner, days: Int? = nil) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/insights/no-shows",
            query: query(owner, ["days": days.map(String.init)])
        )
    }

    /// `GET /insights/team?days` — business team performance. (Backend mounts
    /// this directly on the scheduling router — no `/bookings` segment.)
    public static func teamInsights(owner: SchedulingOwner, days: Int? = nil) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/insights/team",
            query: query(owner, ["days": days.map(String.init)])
        )
    }

    // MARK: - Invoices (business-only)

    /// `GET /invoices` — `{ invoices }` (empty unless business).
    public static func getInvoices(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/invoices", query: query(owner))
    }

    /// `GET /invoices/:id` — `{ invoice }`.
    public static func getInvoice(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/invoices/\(id)", query: query(owner))
    }

    /// `POST /invoices/:id/send` — `{ ok: true }`.
    public static func sendInvoice(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .post, path: "\(owner.pathPrefix)/invoices/\(id)/send", query: query(owner))
    }

    // MARK: - Packages

    /// `GET /packages` — `{ packages }`.
    public static func getPackages(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/packages", query: query(owner))
    }

    /// `POST /packages` — `{ package }`.
    public static func createPackage(
        owner: SchedulingOwner,
        _ request: SchedulingCreatePackageRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/packages",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `PUT /packages/:id` — partial update.
    public static func updatePackage(
        owner: SchedulingOwner,
        id: String,
        _ request: SchedulingUpdatePackageRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/packages/\(id)",
            query: query(owner),
            body: request
        )
    }

    /// `DELETE /packages/:id` — soft-delete (is_active=false).
    public static func deletePackage(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .delete, path: "\(owner.pathPrefix)/packages/\(id)", query: query(owner))
    }

    /// `POST /packages/:id/buy` — customer purchase. `{ credit, clientSecret }`.
    /// Not owner-gated.
    public static func buyPackage(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/scheduling/packages/\(id)/buy")
    }

    /// `GET /my-packages` — credits owned by the signed-in user. Not
    /// owner-gated.
    public static func getMyPackages() -> Endpoint {
        Endpoint(method: .get, path: "/api/scheduling/my-packages")
    }

    // MARK: - Find a time / who's free / team availability

    /// `POST /find-a-time` — common free slots across home members (home-only).
    /// The backend reads `member_ids` as a JSON ARRAY in the request BODY
    /// (Joi `findATimeSchema`), so this is a POST, not a GET. Owner is home →
    /// implied by the path; `OwnerScopedBody` adds nothing.
    public static func findATime(
        owner: SchedulingOwner,
        _ request: FindATimeRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/find-a-time",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `GET /whos-free?from&to&tz` — per-member free grids (home-only).
    public static func whosFree(
        owner: SchedulingOwner,
        from: String,
        to: String,
        tz: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/whos-free",
            query: query(owner, ["from": from, "to": to, "tz": tz])
        )
    }

    /// `GET /team-availability?from&to&tz` — per-member free grids
    /// (business-only; 400 `BUSINESS_ONLY` otherwise).
    public static func teamAvailability(
        owner: SchedulingOwner,
        from: String,
        to: String,
        tz: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(owner.pathPrefix)/team-availability",
            query: query(owner, ["from": from, "to": to, "tz": tz])
        )
    }

    // MARK: - Resources (home-only)

    /// `GET /resources` — `{ resources }`.
    public static func getResources(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/resources", query: query(owner))
    }

    /// `POST /resources` — `{ resource }`.
    public static func createResource(
        owner: SchedulingOwner,
        _ request: CreateResourceRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/resources",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `PUT /resources/:rid` — partial update.
    public static func updateResource(
        owner: SchedulingOwner,
        resourceId: String,
        _ request: UpdateResourceRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "\(owner.pathPrefix)/resources/\(resourceId)",
            query: query(owner),
            body: request
        )
    }

    /// `DELETE /resources/:rid` — soft-delete.
    public static func deleteResource(owner: SchedulingOwner, resourceId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "\(owner.pathPrefix)/resources/\(resourceId)",
            query: query(owner)
        )
    }

    /// `POST /resources/:rid/book` — 409 `SLOT_CONFLICT` / `RESOURCE_UNAVAILABLE`.
    public static func bookResource(
        owner: SchedulingOwner,
        resourceId: String,
        _ request: BookResourceRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/resources/\(resourceId)/book",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    // MARK: - Visits (home-only)

    /// `POST /visits` — vendor/guest visit; 400 `BAD_RANGE` for >30-day span.
    public static func createVisit(
        owner: SchedulingOwner,
        _ request: CreateVisitRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/visits",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    // MARK: - Polls

    /// `POST /polls` — `{ poll, options }`.
    public static func createPoll(
        owner: SchedulingOwner,
        _ request: SchedulingCreatePollRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/polls",
            query: query(owner),
            body: OwnerScopedBody(owner: owner, payload: request)
        )
    }

    /// `GET /polls` — `{ polls }`.
    public static func getPolls(owner: SchedulingOwner) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/polls", query: query(owner))
    }

    /// `GET /polls/:id` — poll + options + votes.
    public static func getPoll(owner: SchedulingOwner, id: String) -> Endpoint {
        Endpoint(method: .get, path: "\(owner.pathPrefix)/polls/\(id)", query: query(owner))
    }

    /// `POST /polls/:id/finalize` — close + record `finalized_start_at`.
    public static func finalizePoll(
        owner: SchedulingOwner,
        id: String,
        _ request: FinalizePollRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(owner.pathPrefix)/polls/\(id)/finalize",
            query: query(owner),
            body: request
        )
    }
}
