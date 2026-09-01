//
//  SchedulingPublicEndpoints.swift
//  Pantopus
//
//  PUBLIC endpoint builders for the Calendarly invitee flow — mounted at
//  `/api/public` (`backend/routes/schedulingPublic.js`). All are
//  `authenticated:false` (the client sends no Bearer token). Slug = booking
//  PAGE slug (NOT a booking id). One-off links use the raw token; manage uses
//  the one-time manage token. See `reference/calendarly-backend-api.md`.
//

import Foundation

/// Endpoint builders for the public scheduling router (no auth).
public enum SchedulingPublicEndpoints {
    private static func filtered(_ pairs: [String: String?]) -> [String: String] {
        var result: [String: String] = [:]
        for (key, value) in pairs {
            if let value { result[key] = value }
        }
        return result
    }

    // MARK: - Discovery (book page + slots)

    /// `GET /api/public/book/:slug` — page + status + event types.
    public static func bookPage(slug: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/public/book/\(slug)", authenticated: false)
    }

    /// `GET /api/public/book/:slug/:eventTypeSlug/slots?from&to&tz` — slots.
    public static func slots(
        slug: String,
        eventTypeSlug: String,
        from: String,
        to: String,
        tz: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/public/book/\(slug)/\(eventTypeSlug)/slots",
            query: filtered(["from": from, "to": to, "tz": tz]),
            authenticated: false
        )
    }

    /// `POST /api/public/book/:slug/:eventTypeSlug` — invitee commit. Returns the
    /// one-time `manageToken` (PERSIST it). 409 alternatives on conflict.
    public static func createBooking(
        slug: String,
        eventTypeSlug: String,
        _ request: PublicBookingCreateRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/book/\(slug)/\(eventTypeSlug)",
            body: request,
            authenticated: false
        )
    }

    /// `POST /api/public/book/:slug/:eventTypeSlug/waitlist` — join the waitlist.
    public static func joinWaitlist(
        slug: String,
        eventTypeSlug: String,
        _ request: WaitlistJoinRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/book/\(slug)/\(eventTypeSlug)/waitlist",
            body: request,
            authenticated: false
        )
    }

    // MARK: - One-off links

    /// `GET /api/public/book/o/:token?tz&from&to` — one-off link view.
    public static func oneOffView(
        token: String,
        tz: String? = nil,
        from: String? = nil,
        to: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/public/book/o/\(token)",
            query: filtered(["tz": tz, "from": from, "to": to]),
            authenticated: false
        )
    }

    /// `POST /api/public/book/o/:token` — one-off link commit. Returns
    /// `manageToken`. 400 `SLOT_NOT_OFFERED` / 409 `LINK_USED` guards.
    public static func createOneOffBooking(
        token: String,
        _ request: PublicBookingCreateRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/book/o/\(token)",
            body: request,
            authenticated: false
        )
    }

    // MARK: - Manage (manage token)

    /// `GET /api/public/booking/:token` — booking + actions + payment + page.
    public static func manage(token: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/public/booking/\(token)", authenticated: false)
    }

    /// `GET /api/public/booking/:token/available-slots?from&to&tz` — reschedule
    /// slots (excludes the current booking).
    public static func manageAvailableSlots(
        token: String,
        from: String? = nil,
        to: String? = nil,
        tz: String? = nil
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/public/booking/\(token)/available-slots",
            query: filtered(["from": from, "to": to, "tz": tz]),
            authenticated: false
        )
    }

    /// `GET /api/public/booking/:token/ics` — raw `.ics` (use `requestData`).
    public static func ics(token: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/public/booking/\(token)/ics", authenticated: false)
    }

    /// `POST /api/public/booking/:token/reschedule` — invitee reschedule.
    public static func reschedule(token: String, _ request: PublicRescheduleRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/booking/\(token)/reschedule",
            body: request,
            authenticated: false
        )
    }

    /// `POST /api/public/booking/:token/cancel` — invitee cancel.
    public static func cancel(
        token: String,
        _ request: PublicCancelRequest = PublicCancelRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/booking/\(token)/cancel",
            body: request,
            authenticated: false
        )
    }

    /// `POST /api/public/booking/:token/unsubscribe` — stop reminder emails.
    public static func unsubscribe(token: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/booking/\(token)/unsubscribe",
            authenticated: false
        )
    }

    /// `POST /api/public/booking/:token/accept-reschedule` — accept a
    /// host-proposed reschedule.
    public static func acceptReschedule(token: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/booking/\(token)/accept-reschedule",
            authenticated: false
        )
    }

    /// `POST /api/public/booking/:token/decline-reschedule` — decline a
    /// host-proposed reschedule.
    public static func declineReschedule(token: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/booking/\(token)/decline-reschedule",
            authenticated: false
        )
    }

    // MARK: - Public polls

    /// `GET /api/public/poll/:id` — public poll view.
    public static func poll(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/public/poll/\(id)", authenticated: false)
    }

    /// `POST /api/public/poll/:id/vote` — cast / update a poll vote.
    public static func votePoll(id: String, _ request: PublicPollVoteRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/public/poll/\(id)/vote",
            body: request,
            authenticated: false
        )
    }
}
