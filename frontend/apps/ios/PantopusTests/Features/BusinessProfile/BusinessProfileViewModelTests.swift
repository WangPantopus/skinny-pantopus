//
//  BusinessProfileViewModelTests.swift
//  PantopusTests
//
//  A10.6 — VM-projection regression suite for the single-scroll reshape.
//  Covers the loaded path (detail + public + reviews-fallback), the
//  not-found path, the unpublished path (public 404 absorbed), the
//  newly-claimed projection (no reviews / no jobs → "New" stat + Call
//  dock), the open/closed calculator, and the Save action.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class BusinessProfileViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let detailJSON = """
    {
      "business": {
        "id": "biz-1",
        "username": "elmpark-coffee",
        "name": "Elm Park Coffee",
        "email": null,
        "bio": "Slow coffee on the corner.",
        "tagline": "Made by neighbors",
        "profile_picture_url": "https://example.test/elm.png",
        "cover_photo_url": null,
        "account_type": "business",
        "city": "Cambridge",
        "state": "MA",
        "verified": true,
        "average_rating": 4.7,
        "review_count": 12,
        "followers_count": 240,
        "gigs_completed": 0,
        "created_at": "2023-04-10T00:00:00.000Z"
      },
      "profile": {
        "business_user_id": "biz-1",
        "business_type": "cafe",
        "categories": ["Coffee", "Bakery"],
        "description": "Pour-over coffee and laminated pastry from the neighborhood.",
        "logo_file_id": null,
        "banner_file_id": null,
        "public_email": "hi@elmpark.test",
        "public_phone": "+1-555-0101",
        "website": "elmparkcoffee.test",
        "founded_year": 2021,
        "employee_count": "1-5",
        "service_area": "Serves Cambridge & Somerville",
        "founding_badge": true,
        "is_published": true,
        "verification_status": "address_verified",
        "primary_location": {
          "id": "loc-1",
          "label": "Main shop",
          "is_primary": true,
          "address": "41 Elm Street",
          "address2": null,
          "city": "Cambridge",
          "state": "MA",
          "zipcode": "02139",
          "country": "US",
          "location": { "lat": 42.37, "lng": -71.11 },
          "phone": null,
          "email": null,
          "timezone": "America/New_York"
        }
      },
      "locations": [],
      "access": { "hasAccess": true, "isOwner": false, "role_base": null }
    }
    """

    private static let publicJSON = """
    {
      "hours": [
        { "id": "h-mon", "location_id": "loc-1", "day_of_week": 1, "open_time": "07:00", "close_time": "16:00", "is_closed": false },
        { "id": "h-tue", "location_id": "loc-1", "day_of_week": 2, "open_time": "07:00", "close_time": "16:00", "is_closed": false },
        { "id": "h-sun", "location_id": "loc-1", "day_of_week": 0, "open_time": null,    "close_time": null,    "is_closed": true }
      ],
      "catalog": [
        {
          "id": "svc-1",
          "name": "Pour over",
          "description": "Single-origin, sliding scale.",
          "kind": "service",
          "price_cents": 500,
          "price_max_cents": null,
          "price_unit": null,
          "currency": "USD",
          "image_url": null,
          "is_featured": true
        }
      ]
    }
    """

    private static let publicEmptyJSON = """
    { "hours": [], "catalog": [] }
    """

    private static let reviewsJSON = """
    {
      "id": "biz-1",
      "username": "elmpark-coffee",
      "name": "Elm Park Coffee",
      "accountType": "business",
      "verified": true,
      "created_at": "2023-04-10T00:00:00.000Z",
      "gigs_posted": 0,
      "gigs_completed": 0,
      "average_rating": 4.7,
      "review_count": 12,
      "followers_count": 240,
      "reviews": [
        {
          "id": "r1",
          "reviewer_id": "u9",
          "reviewee_id": "biz-1",
          "rating": 5,
          "content": "Best coffee on Elm.",
          "created_at": "2026-05-01T00:00:00.000Z",
          "reviewer_name": "Sam",
          "reviewer_avatar": null,
          "reviewer_username": "sam"
        }
      ],
      "socialLinks": {},
      "skills": []
    }
    """

    /// Newly-claimed business: no reviews, no jobs, no published hours.
    private static let detailNewJSON = """
    {
      "business": {
        "id": "biz-new",
        "username": "tidepool-pets",
        "name": "Tide Pool Pet Care",
        "account_type": "business",
        "city": "Cedar Heights",
        "state": "CA",
        "verified": true,
        "average_rating": null,
        "review_count": 0,
        "followers_count": 0,
        "gigs_completed": 0,
        "created_at": "2026-05-20T00:00:00.000Z"
      },
      "profile": {
        "business_user_id": "biz-new",
        "categories": ["Pet care", "Dog walking"],
        "description": null,
        "website": null,
        "service_area": null,
        "is_published": true,
        "verification_status": "address_verified"
      },
      "locations": [],
      "access": { "hasAccess": true, "isOwner": false }
    }
    """

    private static let reviewsEmptyJSON = """
    {
      "id": "biz-new",
      "username": "tidepool-pets",
      "accountType": "business",
      "verified": true,
      "created_at": "2026-05-20T00:00:00.000Z",
      "gigs_completed": 0,
      "average_rating": null,
      "review_count": 0,
      "followers_count": 0,
      "reviews": []
    }
    """

    // MARK: - Happy path

    func testLoadedProjectsHeaderStatsCategoriesHoursAndServices() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailJSON),
            .status(200, body: Self.publicJSON),
            .status(200, body: Self.reviewsJSON),
            .status(200, body: #"{"following":true}"#)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-1", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.header.displayName, "Elm Park Coffee")
        XCTAssertEqual(content.header.handle, "elmpark-coffee")
        XCTAssertEqual(content.header.locality, "Cambridge, MA")
        XCTAssertTrue(content.header.isVerified)

        XCTAssertEqual(content.categories.map(\.label), ["Coffee", "Bakery"])
        XCTAssertEqual(content.categories.first?.accent, .business)
        XCTAssertEqual(content.categories.last?.accent, .neutral)

        // Reshaped stat strip: rating · jobs · followers.
        XCTAssertEqual(content.stats.map(\.label), ["12 reviews", "Jobs done", "Followers"])
        XCTAssertEqual(content.stats[0].value, "4.7")
        XCTAssertTrue(content.stats[0].leadingStar)
        XCTAssertEqual(content.stats[0].tint, .star)
        XCTAssertEqual(content.stats[2].value, "240")

        XCTAssertFalse(content.isNewlyClaimed)
        XCTAssertEqual(content.about, "Pour-over coffee and laminated pastry from the neighborhood.")

        XCTAssertEqual(content.hours.count, 3)
        XCTAssertEqual(content.hours.map(\.dayLabel), ["Sunday", "Monday", "Tuesday"])
        XCTAssertTrue(content.hours.first?.isClosed == true)

        XCTAssertNotNil(content.serviceArea)
        XCTAssertEqual(content.serviceArea?.serviceArea, "Serves Cambridge & Somerville")
        XCTAssertEqual(content.savedPlace?.label, "Elm Park Coffee")
        XCTAssertEqual(content.savedPlace?.latitude, 42.37)
        XCTAssertEqual(content.savedPlace?.longitude, -71.11)
        XCTAssertEqual(content.savedPlace?.city, "Cambridge")
        XCTAssertEqual(content.savedPlace?.state, "MA")
        XCTAssertEqual(content.savedPlace?.sourceId, "biz-1")

        XCTAssertEqual(content.services.count, 1)
        XCTAssertEqual(content.services.first?.name, "Pour over")
        XCTAssertEqual(content.services.first?.priceLabel, "$5")

        XCTAssertEqual(content.reviewSummary?.count, 12)
        XCTAssertEqual(content.reviews.count, 1)
        XCTAssertEqual(content.reviews.first?.reviewerName, "Sam")

        XCTAssertNotNil(content.websiteURL)
    }

    func testLoadedSuppressesSavedPlaceForOwnedBusiness() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailJSON.replacingOccurrences(of: "\"isOwner\": false", with: "\"isOwner\": true")),
            .status(200, body: Self.publicJSON),
            .status(200, body: Self.reviewsJSON)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-1", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertTrue(content.viewerIsOwner)
        XCTAssertNil(content.savedPlace)
    }

    // MARK: - Empty services / hours → empty-section frames

    func testEmptyPublicResponseLeavesServicesAndHoursEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailJSON),
            .status(200, body: Self.publicEmptyJSON),
            .status(200, body: Self.reviewsJSON)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-1", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertTrue(content.services.isEmpty)
        XCTAssertTrue(content.hours.isEmpty)
        XCTAssertNil(content.status)
        XCTAssertNotNil(content.about)
    }

    // MARK: - Unpublished business → public 404

    func testUnpublishedBusinessAbsorbsPublic404() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailJSON),
            .status(404, body: "{\"error\":\"unpublished\"}"),
            .status(200, body: Self.reviewsJSON)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-1", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded; got \(vm.state)")
        }
        XCTAssertTrue(content.hours.isEmpty)
        XCTAssertTrue(content.services.isEmpty)
        XCTAssertEqual(content.reviews.count, 1)
    }

    // MARK: - Newly claimed

    func testNewlyClaimedProjectsNewStatAndCallDock() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailNewJSON),
            .status(200, body: Self.publicEmptyJSON),
            .status(200, body: Self.reviewsEmptyJSON)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-new", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded; got \(vm.state)")
        }
        XCTAssertTrue(content.isNewlyClaimed)
        XCTAssertEqual(content.stats.map(\.label), ["No reviews yet", "Jobs done", "On Pantopus"])
        XCTAssertEqual(content.stats[0].value, "—")
        XCTAssertEqual(content.stats[0].tint, .muted)
        XCTAssertEqual(content.stats[2].value, "New")
        XCTAssertEqual(content.stats[2].tint, .business)
        XCTAssertNil(content.reviewSummary)
        XCTAssertEqual(content.dock.secondary, .call)
    }

    // MARK: - Not found

    func testPrimary404EmitsNotFoundState() async {
        SequencedURLProtocol.sequence = [.status(404, body: "{\"error\":\"missing\"}")]
        let vm = BusinessProfileViewModel(businessId: "nope", client: makeAPI())
        await vm.load()
        if case .notFound = vm.state { return }
        XCTFail("Expected .notFound; got \(vm.state)")
    }

    // MARK: - Open/closed calculator

    private func hours(_ json: String) -> [BusinessHoursDTO] {
        // swiftlint:disable:next force_try
        try! JSONDecoder().decode([BusinessHoursDTO].self, from: Data(json.utf8))
    }

    private func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return calendar
    }

    /// 2024-01-01 00:00:00 UTC — a Monday.
    private let mondayMidnightUTC = Date(timeIntervalSince1970: 1_704_067_200)

    private static let mondayHours = """
    [{ "id": "h", "location_id": null, "day_of_week": 1, "open_time": "09:00", "close_time": "17:00", "is_closed": false }]
    """

    func testComputeOpenStateOpenNow() {
        let vm = BusinessProfileViewModel(businessId: "x", client: makeAPI())
        let now = mondayMidnightUTC.addingTimeInterval(12 * 3600) // Mon noon
        let status = vm.computeOpenState(hours(Self.mondayHours), now: now, calendar: utcCalendar())
        XCTAssertEqual(status?.isOpen, true)
        XCTAssertEqual(status?.statusLabel, "Open now")
        XCTAssertEqual(status?.chipLabel, "Open now")
    }

    func testComputeOpenStateClosedBeforeOpening() {
        let vm = BusinessProfileViewModel(businessId: "x", client: makeAPI())
        let now = mondayMidnightUTC.addingTimeInterval(8 * 3600) // Mon 08:00
        let status = vm.computeOpenState(hours(Self.mondayHours), now: now, calendar: utcCalendar())
        XCTAssertEqual(status?.isOpen, false)
        XCTAssertEqual(status?.statusLabel, "Closed now")
        XCTAssertEqual(status?.chipLabel, "Closed · opens 9 AM")
    }

    func testComputeOpenStateClosedFindsNextDay() {
        let vm = BusinessProfileViewModel(businessId: "x", client: makeAPI())
        let now = mondayMidnightUTC.addingTimeInterval(36 * 3600) // Tue noon, only Monday has hours
        let status = vm.computeOpenState(hours(Self.mondayHours), now: now, calendar: utcCalendar())
        XCTAssertEqual(status?.isOpen, false)
        XCTAssertEqual(status?.statusDetail, "Opens Monday at 9 AM")
    }

    func testComputeOpenStateNilWhenNoHours() {
        let vm = BusinessProfileViewModel(businessId: "x", client: makeAPI())
        let status = vm.computeOpenState([], now: Date(), calendar: utcCalendar())
        XCTAssertNil(status)
    }

    // MARK: - Save action

    func testSaveTransitionsToSavedAndEmitsToast() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailJSON),
            .status(200, body: Self.publicJSON),
            .status(200, body: Self.reviewsJSON),
            .status(200, body: #"{"following":true}"#)
        ]
        let vm = BusinessProfileViewModel(businessId: "biz-1", client: makeAPI())
        await vm.load()
        await vm.save()
        XCTAssertEqual(vm.saveState, .saved)
        XCTAssertEqual(vm.toastMessage, "Saved")
    }
}
