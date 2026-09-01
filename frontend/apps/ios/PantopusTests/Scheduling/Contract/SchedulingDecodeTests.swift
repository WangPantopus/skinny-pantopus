//
//  SchedulingDecodeTests.swift
//  PantopusTests
//
//  Drives APIClient(retryPolicy:.none, session: SequencedURLProtocol…) with
//  stubbed 200 bodies to prove the Calendarly DTOs decode from the documented
//  response shapes (reference/calendarly-backend-api.md), including the
//  wiring-critical fields: manageToken, status enum, freeByMember map, flexible
//  prefs (JSONValue), the booking-union fields on CalendarEventDTO, and the 409
//  alternatives flowing through the live error path.
//

import XCTest
@testable import Pantopus

@MainActor
final class SchedulingDecodeTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> APIClient {
        APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func decode<T: Decodable>(_ json: String, _ endpoint: Endpoint, as _: T.Type) async throws -> T {
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        return try await makeClient().request(endpoint)
    }

    // MARK: - Booking page

    func testBookingPageDecodes() async throws {
        let json = """
        {"page":{"id":"p1","owner_type":"user","owner_id":null,"slug":"ada","is_live":true,"is_paused":false,
        "title":"Book Ada","tagline":"Let's talk","avatar_url":null,"intro":"hi","confirmation_message":"Thanks!",
        "timezone":"America/New_York","reminder_minutes":[60,1440],"cancellation_policy":"24h notice",
        "visibility":"listed","branding":{"accent":"#000"},"created_at":"2026-06-01T00:00:00Z",
        "updated_at":"2026-06-01T00:00:00Z","created_by":"u1"}}
        """
        let response = try await decode(json, SchedulingEndpoints.getBookingPage(owner: .personal), as: BookingPageResponse.self)
        XCTAssertEqual(response.page.slug, "ada")
        XCTAssertTrue(response.page.isLive)
        XCTAssertEqual(response.page.reminderMinutes, [60, 1440])
        XCTAssertEqual(response.page.cancellationPolicy?.stringValue, "24h notice")
        XCTAssertEqual(response.page.branding?.dictValue?["accent"]?.stringValue, "#000")
    }

    func testCheckSlugDecodes() async throws {
        let json = #"{"available":false,"suggestions":["ada-1","ada-2","ada-3"]}"#
        let response = try await decode(json, SchedulingEndpoints.checkSlug(owner: .personal, slug: "ada"), as: CheckSlugResponse.self)
        XCTAssertFalse(response.available)
        XCTAssertEqual(response.suggestions?.count, 3)
    }

    func testOneOffLinkDecodes() async throws {
        let json = #"{"token":"raw-tok","path":"/book/o/raw-tok","expires_at":"2026-07-08T00:00:00Z","single_use":true}"#
        let request = OneOffLinkRequest(eventTypeId: "et1")
        let response = try await decode(json, SchedulingEndpoints.createOneOffLink(owner: .personal, request), as: OneOffLinkResponse.self)
        XCTAssertEqual(response.token, "raw-tok")
        XCTAssertEqual(response.path, "/book/o/raw-tok")
        XCTAssertEqual(response.singleUse, true)
    }

    // MARK: - Event types

    func testEventTypesListDecodes() async throws {
        let json = """
        {"eventTypes":[{"id":"et1","page_id":"p1","name":"Intro","slug":"intro","durations":[15,30],
        "default_duration":30,"location_mode":"video","assignment_mode":"one_on_one","visibility":"public",
        "price_cents":0,"currency":"USD","is_active":true,"sort_order":0}]}
        """
        let response = try await decode(json, SchedulingEndpoints.getEventTypes(owner: .personal), as: EventTypesResponse.self)
        XCTAssertEqual(response.eventTypes.count, 1)
        XCTAssertEqual(response.eventTypes[0].durations, [15, 30])
        XCTAssertEqual(response.eventTypes[0].defaultDuration, 30)
    }

    func testEventTypeDetailDecodesAssigneesAndQuestions() async throws {
        let json = """
        {"eventType":{"id":"et1","name":"Intro","slug":"intro","durations":[30]},
        "assignees":[{"id":"a1","subject_id":"u2","subject_type":"user","weight":1,"priority":0,"is_active":true}],
        "questions":[{"id":"q1","label":"Topic?","field_type":"text","options":[],"required":true,"sort_order":0}]}
        """
        let endpoint = SchedulingEndpoints.getEventType(owner: .personal, id: "et1")
        let response = try await decode(json, endpoint, as: EventTypeDetailResponse.self)
        XCTAssertEqual(response.assignees?.first?.subjectId, "u2")
        XCTAssertEqual(response.questions?.first?.fieldType, "text")
        XCTAssertEqual(response.questions?.first?.required, true)
    }

    // MARK: - Availability

    func testAvailabilityDecodes() async throws {
        let json = """
        {"schedules":[{"id":"s1","user_id":"u1","name":"Working hours","timezone":"America/New_York","is_default":true}],
        "rules":[{"id":"r1","schedule_id":"s1","weekday":1,"start_time":"09:00","end_time":"17:00"}],
        "overrides":[{"id":"o1","schedule_id":"s1","date":"2026-12-25","is_unavailable":true}]}
        """
        let response = try await decode(json, SchedulingEndpoints.getAvailability(), as: AvailabilityResponse.self)
        XCTAssertEqual(response.schedules.first?.isDefault, true)
        XCTAssertEqual(response.rules.first?.weekday, 1)
        XCTAssertEqual(response.overrides.first?.isUnavailable, true)
    }

    // MARK: - Bookings + summary

    func testBookingsSummaryDecodes() async throws {
        // Fixture mirrors the deployed `bookingMetricsService.getSummary`
        // payload — camelCase top-level keys, snake_case `event_type_id` rows.
        let json = """
        {"bookingsThisMonth":12,"bookingsLastMonth":9,"deltaPct":33,"upcomingCount":3,"noShowCount":1,
        "sparkline":[{"date":"2026-07-01","count":2},{"date":"2026-07-02","count":0}],
        "byEventType":[{"event_type_id":"et1","count":7},{"event_type_id":"et2","count":5}]}
        """
        let summary = try await decode(json, SchedulingEndpoints.getBookingsSummary(owner: .personal), as: SchedulingSummaryDTO.self)
        XCTAssertEqual(summary.bookingsThisMonth, 12)
        XCTAssertEqual(summary.bookingsLastMonth, 9)
        XCTAssertEqual(summary.deltaPct, 33)
        XCTAssertEqual(summary.upcomingCount, 3)
        XCTAssertEqual(summary.noShowCount, 1)
        XCTAssertEqual(summary.sparkline?.count, 2)
        XCTAssertEqual(summary.sparkline?.first?.date, "2026-07-01")
        XCTAssertEqual(summary.sparkline?.first?.count, 2)
        XCTAssertEqual(summary.byEventType?.first?.eventTypeId, "et1")
        XCTAssertEqual(summary.byEventType?.first?.count, 7)
    }

    func testBookingDetailDecodes() async throws {
        let json = """
        {"booking":{"id":"b1","owner_type":"user","status":"confirmed","start_at":"2026-07-01T15:00:00Z",
        "end_at":"2026-07-01T15:30:00Z","invitee_name":"Sam","invitee_email":"sam@x.io","intake_answers":{"topic":"hi"}},
        "attendees":[{"id":"at1","booking_id":"b1","user_id":"u2","rsvp_status":"going"}],
        "eventType":{"id":"et1","name":"Intro","location_mode":"video"}}
        """
        let response = try await decode(json, SchedulingEndpoints.getBooking(owner: .personal, id: "b1"), as: BookingDetailResponse.self)
        XCTAssertEqual(response.booking.status, "confirmed")
        XCTAssertEqual(response.booking.intakeAnswers?.dictValue?["topic"]?.stringValue, "hi")
        XCTAssertEqual(response.attendees?.first?.rsvpStatus, "going")
        XCTAssertEqual(response.eventType?.locationMode, "video")
    }

    // MARK: - Public flow

    func testPublicBookViewDecodesActive() async throws {
        let json = """
        {"page":{"slug":"ada","title":"Book Ada","timezone":"America/New_York"},
        "status":"active",
        "eventTypes":[{"id":"et1","name":"Intro","slug":"intro","durations":[30],"price_cents":0}]}
        """
        let response = try await decode(json, SchedulingPublicEndpoints.bookPage(slug: "ada"), as: PublicBookView.self)
        XCTAssertEqual(response.status, .active)
        XCTAssertEqual(response.eventTypes.first?.slug, "intro")
    }

    func testPublicSlotsDecodesPaused() async throws {
        let json = """
        {"eventType":{"id":"et1","name":"Intro","slug":"intro"},"timezone":"America/New_York",
        "status":"paused","slots":[]}
        """
        let endpoint = SchedulingPublicEndpoints.slots(
            slug: "ada",
            eventTypeSlug: "intro",
            from: "2026-07-01",
            to: "2026-07-08",
            tz: "America/New_York"
        )
        let response = try await decode(json, endpoint, as: PublicSlotsResponse.self)
        XCTAssertEqual(response.status, .paused)
        XCTAssertTrue(response.slots.isEmpty)
    }

    func testPublicSlotsDecodesWithSlots() async throws {
        let json = """
        {"eventType":{"id":"et1","name":"Intro","slug":"intro"},"timezone":"America/New_York","status":"active",
        "slots":[{"start":"2026-07-01T15:00:00Z","end":"2026-07-01T15:30:00Z","startLocal":"2026-07-01T11:00:00-04:00"}]}
        """
        let endpoint = SchedulingPublicEndpoints.slots(slug: "ada", eventTypeSlug: "intro", from: "2026-07-01", to: "2026-07-08")
        let response = try await decode(json, endpoint, as: PublicSlotsResponse.self)
        XCTAssertEqual(response.slots.count, 1)
        XCTAssertEqual(response.slots.first?.startLocal, "2026-07-01T11:00:00-04:00")
        XCTAssertNil(response.slots.first?.eligibleHosts)
    }

    func testPublicBookingCreateDecodesManageToken() async throws {
        let json = """
        {"booking":{"id":"b1","status":"confirmed","start_at":"2026-07-01T15:00:00Z","end_at":"2026-07-01T15:30:00Z",
        "requires_approval":false,"policy_snapshot":{"refund":"full"}},
        "eventType":{"id":"et1","name":"Intro"},"page":{"confirmation_message":"Thanks!","timezone":"America/New_York"},
        "manageToken":"mtok-123","clientSecret":null}
        """
        let request = PublicBookingCreateRequest(startAt: "2026-07-01T15:00:00Z", name: "Sam", email: "sam@x.io")
        let endpoint = SchedulingPublicEndpoints.createBooking(slug: "ada", eventTypeSlug: "intro", request)
        let response = try await decode(json, endpoint, as: PublicBookingCreateResponse.self)
        XCTAssertEqual(response.manageToken, "mtok-123")
        XCTAssertNil(response.clientSecret)
        XCTAssertEqual(response.booking.policySnapshot?.dictValue?["refund"]?.stringValue, "full")
    }

    func testManageBookingDecodesActionsAndPayment() async throws {
        let json = """
        {"booking":{"id":"b1","status":"confirmed","start_at":"2026-07-01T15:00:00Z","end_at":"2026-07-01T15:30:00Z"},
        "actions":{"can_cancel":true,"can_reschedule":true,"reschedule_deadline":"2026-06-30T15:00:00Z",
        "free_cancel_until":"2026-06-30T15:00:00Z","refund_estimate_cents":5000},
        "payment":{"amount_total":5000,"currency":"USD","payment_status":"paid","paid_at":"2026-06-20T00:00:00Z"},
        "eventType":{"id":"et1","name":"Intro"},"page":{"slug":"ada"}}
        """
        let response = try await decode(json, SchedulingPublicEndpoints.manage(token: "mtok-123"), as: ManageBookingResponse.self)
        XCTAssertEqual(response.actions?.canCancel, true)
        XCTAssertEqual(response.actions?.refundEstimateCents, 5000)
        XCTAssertEqual(response.payment?.paymentStatus, "paid")
    }

    // MARK: - Find-a-time / who's-free

    func testMemberFreeDecodesFreeByMember() async throws {
        let json = """
        {"members":["u1","u2"],"freeByMember":{
          "u1":[{"start":"2026-07-01T15:00:00Z","end":"2026-07-01T15:30:00Z","startLocal":"x","eligibleHosts":["u1"]}],
          "u2":[]}}
        """
        let endpoint = SchedulingEndpoints.whosFree(owner: .home(homeId: "h1"), from: "2026-07-01", to: "2026-07-08")
        let response = try await decode(json, endpoint, as: MemberFreeResponse.self)
        XCTAssertEqual(response.members, ["u1", "u2"])
        XCTAssertEqual(response.freeByMember["u1"]?.first?.eligibleHosts, ["u1"])
        XCTAssertEqual(response.freeByMember["u2"]?.count, 0)
    }

    func testFindATimeIsPostWithArrayBody() throws {
        let request = FindATimeRequest(memberIds: ["u1", "u2"], from: "2026-07-01", to: "2026-07-08", mode: "collective")
        let endpoint = SchedulingEndpoints.findATime(owner: .home(homeId: "h1"), request)
        XCTAssertEqual(endpoint.method, .post)
        XCTAssertEqual(endpoint.path, "/api/homes/h1/scheduling/find-a-time")
        let body = try XCTUnwrap(endpoint.body)
        let data = try JSONEncoder().encode(body)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        // member_ids MUST be a JSON array (not a comma-joined string).
        XCTAssertEqual(object["member_ids"] as? [String], ["u1", "u2"])
        XCTAssertEqual(object["mode"] as? String, "collective")
        XCTAssertNil(object["owner_type"]) // home → owner implied by path
    }

    func testFindATimeResponseDecodes() async throws {
        let json = """
        {"slots":[{"start":"2026-07-01T15:00:00Z","end":"2026-07-01T15:30:00Z","startLocal":"x","eligibleHosts":["u1","u2"]}]}
        """
        let request = FindATimeRequest(memberIds: ["u1", "u2"], from: "2026-07-01", to: "2026-07-08")
        let endpoint = SchedulingEndpoints.findATime(owner: .home(homeId: "h1"), request)
        let response = try await decode(json, endpoint, as: FindATimeResponse.self)
        XCTAssertEqual(response.slots.first?.eligibleHosts, ["u1", "u2"])
    }

    // MARK: - Notification prefs (flexible JSON round-trip)

    func testNotificationPrefsDecodesFlexibleObject() async throws {
        let json = #"{"prefs":{"email":{"booking_created":true},"push":false,"custom_key":"value"}}"#
        let response = try await decode(json, SchedulingEndpoints.getNotificationPreferences(), as: NotificationPreferencesResponse.self)
        XCTAssertEqual(response.prefs.dictValue?["push"]?.boolValue, false)
        XCTAssertEqual(response.prefs.dictValue?["custom_key"]?.stringValue, "value")
        // Round-trips unknown keys: re-encode and confirm the custom key survives.
        let reencoded = try JSONEncoder().encode(UpdateNotificationPreferencesRequest(prefs: response.prefs))
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: reencoded) as? [String: Any])
        let prefs = try XCTUnwrap(object["prefs"] as? [String: Any])
        XCTAssertEqual(prefs["custom_key"] as? String, "value")
    }

    // MARK: - Payments

    func testPaymentsStatusDecodes() async throws {
        let json = #"{"applicable":true,"connected":true,"charges_enabled":true,"payouts_enabled":false}"#
        let response = try await decode(json, SchedulingEndpoints.paymentsStatus(owner: .personal), as: PaymentsStatusDTO.self)
        XCTAssertTrue(response.applicable)
        XCTAssertEqual(response.payoutsEnabled, false)
    }

    func testPaymentsStatusHomeNotApplicable() async throws {
        let json = #"{"applicable":false,"connected":false}"#
        let response = try await decode(json, SchedulingEndpoints.paymentsStatus(owner: .home(homeId: "h1")), as: PaymentsStatusDTO.self)
        XCTAssertFalse(response.applicable)
    }

    // MARK: - Packages (renamed types)

    func testBuyPackageDecodesCreditAndClientSecret() async throws {
        let json = """
        {"credit":{"id":"c1","buyer_user_id":"u1","package_id":"pk1","remaining_sessions":5,
        "purchased_at":"2026-06-20T00:00:00Z","BookingPackage":{"name":"5-pack","sessions_count":5,"owner_type":"business"}},
        "clientSecret":"pi_secret"}
        """
        let response = try await decode(json, SchedulingEndpoints.buyPackage(id: "pk1"), as: BuyPackageResponse.self)
        XCTAssertEqual(response.credit.remainingSessions, 5)
        XCTAssertEqual(response.credit.bookingPackage?.name, "5-pack")
        XCTAssertEqual(response.clientSecret, "pi_secret")
    }

    // MARK: - Home calendar booking-union + RSVP (Homes contract additions)

    func testHomeEventsUnionDecodesBookingRows() async throws {
        let json = """
        {"events":[
          {"id":"e1","home_id":"h1","event_type":"chore","title":"Trash","start_at":"2026-07-01T08:00:00Z",
           "alerts_enabled":true,"visibility":"members","source":"event"},
          {"id":"e2","home_id":"h1","event_type":"appointment","title":"Cleaner","start_at":"2026-07-02T10:00:00Z",
           "source":"booking","booking_status":"confirmed","booking_id":"bk-9","visibility":"members"}
        ]}
        """
        let response = try await decode(json, HomesEndpoints.homeEvents(homeId: "h1"), as: GetHomeEventsResponse.self)
        XCTAssertEqual(response.events.count, 2)
        let booking = try XCTUnwrap(response.events.first { $0.source == "booking" })
        XCTAssertEqual(booking.bookingStatus, "confirmed")
        XCTAssertEqual(booking.bookingId, "bk-9")
        let event = try XCTUnwrap(response.events.first { $0.source == "event" })
        XCTAssertNil(event.bookingId)
    }

    func testHomeEventDetailDecodesAttendees() async throws {
        let json = """
        {"event":{"id":"e1","home_id":"h1","event_type":"guest","title":"BBQ","start_at":"2026-07-04T18:00:00Z",
        "request_rsvp":true,"reminders":[],"visibility":"members"},
        "attendees":[{"user_id":"u1","rsvp_status":"going","updated_at":"2026-06-20T00:00:00Z"},
        {"user_id":"u2","rsvp_status":"maybe","updated_at":"2026-06-20T00:00:00Z"}]}
        """
        let response = try await decode(json, HomesEndpoints.getHomeEvent(homeId: "h1", eventId: "e1"), as: HomeEventDetailResponse.self)
        XCTAssertEqual(response.event.requestRsvp, true)
        XCTAssertEqual(response.attendees.count, 2)
        XCTAssertEqual(response.attendees.first?.rsvpStatus, "going")
    }

    // MARK: - 409 alternatives through the live error path

    func test409OnCreateSurfacesAlternatives() async throws {
        let body = """
        {"error":"SLOT_TAKEN","message":"gone","alternatives":[
          {"start":"2026-07-01T16:00:00Z","end":"2026-07-01T16:30:00Z","startLocal":"2026-07-01T12:00:00-04:00"}]}
        """
        SequencedURLProtocol.sequence = [.status(409, body: body)]
        let request = PublicBookingCreateRequest(startAt: "2026-07-01T15:00:00Z", name: "Sam", email: "sam@x.io")
        let endpoint = SchedulingPublicEndpoints.createBooking(slug: "ada", eventTypeSlug: "intro", request)
        do {
            let _: PublicBookingCreateResponse = try await makeClient().request(endpoint)
            XCTFail("Expected a 409 to throw")
        } catch let apiError as APIError {
            let error = SchedulingError.from(apiError)
            XCTAssertEqual(error.code, "SLOT_TAKEN")
            XCTAssertEqual(error.alternatives.count, 1)
            XCTAssertEqual(error.alternatives.first?.start, "2026-07-01T16:00:00Z")
        }
    }
}
