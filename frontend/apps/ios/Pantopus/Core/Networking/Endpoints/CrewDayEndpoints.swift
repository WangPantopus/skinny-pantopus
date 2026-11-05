//
//  CrewDayEndpoints.swift
//  Pantopus
//
//  Crew Day (launch cut #13, `crew_day`): every `/api/crew-days` route the
//  apps use, from the build kit's contract (docs/product/crew-day-build/
//  02-contract.md §4). While the key is off on the server every route
//  answers 403 `CREW_DAY_UNAVAILABLE`. Errors are
//  `{ error: <sentence for people>, code: <CODE> }`; money is in cents,
//  dates `YYYY-MM-DD` in the Crew Day's own time zone.
//
//  Route: backend/routes/crewDays.js (mounted at `/api/crew-days`).
//

import Foundation

public enum CrewDayEndpoints {
    static let base = "/api/crew-days"

    // MARK: - Public (no account needed)

    /// `GET /api/crew-days/public/:code` — the invitation: the day, its
    /// prices, counts and the crew, never addresses or households. 404 for
    /// unknown codes and days not approved yet. The app reads it signed in,
    /// so it also gets `viewer` (crew, household with a booking, or none).
    /// Contract §4 "Public".
    public static func invitation(code: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(base)/public/\(Endpoint.pathSegment(code))"
        )
    }

    /// `POST /api/crew-days/public/:code/quote` — a home's own price and
    /// whether it is inside the day's area. Contract §4 "Public".
    public static func quote(code: String, _ body: CrewDayQuoteBody) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(base)/public/\(Endpoint.pathSegment(code))/quote",
            body: body
        )
    }

    // MARK: - Household

    /// `POST /api/crew-days/:id/bookings` — book (or ask for a look-first
    /// price) with a saved card; a retry with the same `client_request_id`
    /// answers with the same booking. Contract §4 "Household".
    public static func book(crewDayId: String, _ body: CrewDayBookingBody) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(Endpoint.pathSegment(crewDayId))/bookings", body: body)
    }

    /// `GET /api/crew-days/mine` — Your Crew Days: coming up, asked for, done.
    public static func mine() -> Endpoint {
        Endpoint(method: .get, path: "\(base)/mine")
    }

    /// `GET /api/crew-days/today` — the Today cards: my bookings that need
    /// a look, and at most one open day coming to my street.
    public static func today() -> Endpoint {
        Endpoint(method: .get, path: "\(base)/today")
    }

    /// `POST /api/crew-days/:id/dismiss` — "Not for me" on the Today card.
    public static func dismiss(crewDayId: String) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(Endpoint.pathSegment(crewDayId))/dismiss")
    }

    /// `GET /api/crew-days/bookings/:bookingId` — the household's booking page.
    public static func booking(bookingId: String) -> Endpoint {
        Endpoint(method: .get, path: "\(base)/bookings/\(Endpoint.pathSegment(bookingId))")
    }

    /// `PATCH /api/crew-days/bookings/:bookingId` — the access note, home
    /// details (before the cutoff, re-priced) and "Remind me next fall".
    public static func updateBooking(bookingId: String, _ body: CrewDayBookingPatch) -> Endpoint {
        Endpoint(method: .patch, path: "\(base)/bookings/\(Endpoint.pathSegment(bookingId))", body: body)
    }

    /// `POST /api/crew-days/bookings/:bookingId/cancel` — free before the
    /// cutoff; after it 409 `ASK_THE_CREW`.
    public static func cancelBooking(bookingId: String) -> Endpoint {
        bookingAction(bookingId, "cancel")
    }

    /// `POST /api/crew-days/bookings/:bookingId/ask-release` — inside the
    /// cutoff: asks the crew to release the home at no charge.
    public static func askRelease(bookingId: String) -> Endpoint {
        bookingAction(bookingId, "ask-release")
    }

    /// `POST /api/crew-days/bookings/:bookingId/price-answer` — approve or
    /// decline the crew's look-first price.
    public static func priceAnswer(bookingId: String, approve: Bool) -> Endpoint {
        bookingAction(bookingId, "price-answer", body: CrewDayPriceAnswerBody(approve: approve))
    }

    /// `POST /api/crew-days/bookings/:bookingId/gate-ready` — tells the crew.
    public static func gateReady(bookingId: String) -> Endpoint {
        bookingAction(bookingId, "gate-ready")
    }

    /// `POST /api/crew-days/bookings/:bookingId/confirm` — "Everything looks
    /// good": charges now; answers with the booking.
    public static func confirm(bookingId: String) -> Endpoint {
        bookingAction(bookingId, "confirm")
    }

    /// `POST /api/crew-days/bookings/:bookingId/problem` — "Something needs
    /// attention": pauses the charge and opens a case (a second call adds a
    /// note or photos).
    public static func problem(bookingId: String, _ body: CrewDayProblemBody) -> Endpoint {
        bookingAction(bookingId, "problem", body: body)
    }

    /// `POST /api/crew-days/bookings/:bookingId/new-date` — a new date from
    /// the crew's rain proposal, or `cancel`.
    public static func newDate(bookingId: String, proposalId: String, choice: String) -> Endpoint {
        bookingAction(bookingId, "new-date", body: CrewDayNewDateBody(proposalId: proposalId, choice: choice))
    }

    /// `POST /api/crew-days/requests` — "Ask for a Crew Day on my street".
    public static func ask(_ body: CrewDayRequestBody) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/requests", body: body)
    }

    // MARK: - Crew

    /// `GET /api/crew-days/business/:businessId` — the crew's list and what
    /// the business still needs before it can run one.
    public static func business(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "\(base)/business/\(Endpoint.pathSegment(businessId))")
    }

    /// `POST /api/crew-days` — a new street day, as a draft or sent for
    /// approval (`BUSINESS_NOT_READY` with `missing` until it can).
    public static func create(_ body: CrewDayCreateBody) -> Endpoint {
        Endpoint(method: .post, path: base, body: body)
    }

    /// `PATCH /api/crew-days/:id` — capacity, included items, the prep note
    /// and future prices (never existing bookings' prices).
    public static func update(crewDayId: String, _ body: CrewDayUpdateBody) -> Endpoint {
        Endpoint(method: .patch, path: "\(base)/\(Endpoint.pathSegment(crewDayId))", body: body)
    }

    /// `POST /api/crew-days/:id/submit` — a draft goes to Pantopus for approval.
    public static func submit(crewDayId: String) -> Endpoint {
        dayAction(crewDayId, "submit")
    }

    /// `GET /api/crew-days/:id/crew` — the crew's day: counts, money, what
    /// needs them, the homes (addresses only when the privacy rule allows).
    public static func crewDay(crewDayId: String) -> Endpoint {
        Endpoint(method: .get, path: "\(base)/\(Endpoint.pathSegment(crewDayId))/crew")
    }

    /// `POST /api/crew-days/:id/bookings/:bookingId/price` — the crew's price
    /// for a look-first home, or `decline` (the crew can't take it).
    public static func setPrice(crewDayId: String, bookingId: String, _ body: CrewDaySetPriceBody) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(base)/\(Endpoint.pathSegment(crewDayId))/bookings/\(Endpoint.pathSegment(bookingId))/price",
            body: body
        )
    }

    /// `POST /api/crew-days/:id/bookings/:bookingId/release` — a home inside
    /// the cutoff, released at no charge.
    public static func release(crewDayId: String, bookingId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(base)/\(Endpoint.pathSegment(crewDayId))/bookings/\(Endpoint.pathSegment(bookingId))/release"
        )
    }

    /// `POST /api/crew-days/:id/invite-past` — invites households this
    /// business served nearby, once each.
    public static func invitePast(crewDayId: String) -> Endpoint {
        dayAction(crewDayId, "invite-past")
    }

    /// `POST /api/crew-days/:id/propose-dates` — rain: 2 or 3 new dates.
    public static func proposeDates(crewDayId: String, _ body: CrewDayProposeDatesBody) -> Endpoint {
        dayAction(crewDayId, "propose-dates", body: body)
    }

    /// `POST /api/crew-days/:id/cancel` — the day and every active booking,
    /// nobody charged.
    public static func cancelDay(crewDayId: String, reason: String) -> Endpoint {
        dayAction(crewDayId, "cancel", body: CrewDayReasonBody(reason: reason))
    }

    /// `GET /api/crew-days/:id/route?date=` — the homes in route order for
    /// one date, with what the job window allows.
    public static func route(crewDayId: String, date: String?) -> Endpoint {
        Endpoint(
            method: .get,
            path: "\(base)/\(Endpoint.pathSegment(crewDayId))/route",
            query: date.map { ["date": $0] } ?? [:]
        )
    }

    /// `POST /api/crew-days/:id/route/order` — the crew's order.
    public static func routeOrder(crewDayId: String, bookingIds: [String]) -> Endpoint {
        dayAction(crewDayId, "route/order", body: CrewDayRouteOrderBody(bookingIds: bookingIds))
    }

    /// `POST /api/crew-days/:id/running-late` — shifts every remaining home's
    /// window by 30, 60 or 90 minutes and tells them.
    public static func runningLate(crewDayId: String, minutes: Int, date: String?) -> Endpoint {
        dayAction(crewDayId, "running-late", body: CrewDayRunningLateBody(minutes: minutes, date: date))
    }

    /// `POST /api/crew-days/bookings/:bookingId/on-the-way` — "On my way",
    /// with the window the household is told.
    public static func onTheWay(bookingId: String, etaStart: String, etaEnd: String) -> Endpoint {
        bookingAction(bookingId, "on-the-way", body: CrewDayEtaBody(etaStart: etaStart, etaEnd: etaEnd))
    }

    /// `POST /api/crew-days/bookings/:bookingId/cant-get-in` — records it and
    /// tells the household.
    public static func cantGetIn(bookingId: String, note: String) -> Endpoint {
        bookingAction(bookingId, "cant-get-in", body: CrewDayNoteBody(note: note))
    }

    /// `POST /api/crew-days/bookings/:bookingId/done` — at least one photo;
    /// makes the invoice and schedules the charge.
    public static func done(bookingId: String, photoPaths: [String], note: String?) -> Endpoint {
        bookingAction(bookingId, "done", body: CrewDayDoneBody(photoPaths: photoPaths, note: note))
    }

    /// `POST /api/crew-days/uploads` — one photo (multipart, JPEG, PNG or
    /// HEIC, up to 10 MB) → `{ path }`. Sent through `MultipartUploader`.
    public static let uploadsPath = "\(base)/uploads"

    // MARK: - Helpers

    private static func bookingAction(
        _ bookingId: String,
        _ action: String,
        body: (any Encodable & Sendable)? = nil
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(base)/bookings/\(Endpoint.pathSegment(bookingId))/\(action)",
            body: body
        )
    }

    private static func dayAction(
        _ crewDayId: String,
        _ action: String,
        body: (any Encodable & Sendable)? = nil
    ) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(Endpoint.pathSegment(crewDayId))/\(action)", body: body)
    }
}
