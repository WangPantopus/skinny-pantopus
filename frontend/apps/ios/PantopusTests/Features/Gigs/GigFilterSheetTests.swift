//
//  GigFilterSheetTests.swift
//  PantopusTests
//
//  P5.3 — Contract tests for the Gig filter sheet. Covers the
//  criteria ↔ sections projection (build / parse round-trip,
//  active-count), the per-dimension predicates, and the feed
//  view-model applying a filter to the already-loaded gigs.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

// swiftlint:disable file_length type_body_length

@MainActor
final class GigFilterSheetTests: XCTestCase {
    // MARK: - Criteria ↔ sections

    func testDefaultCriteriaHasNoActiveFilters() {
        XCTAssertEqual(GigFilterCriteria().activeCount, 0)
    }

    func testSectionsCoverEveryDimensionInOrder() {
        let ids = GigFilterCriteria().sections().map(\.id)
        // Wave B added the three RN chip dimensions.
        XCTAssertEqual(ids, [
            "category", "budget", "schedule", "openToBids", "postedWithin",
            "distance", "deadline", "archetype"
        ])
    }

    func testCategoryChipsExcludeAllSentinel() {
        guard case let .chipGroup(options, _)? = GigFilterCriteria().sections().first(where: { $0.id == "category" })?.control
        else { return XCTFail("Expected a category chip group") }
        XCTAssertFalse(options.contains { $0.id == GigsCategory.all.rawValue })
        XCTAssertEqual(options.count, GigsCategory.allCases.count - 1)
    }

    func testParseRoundTripPreservesEverySelection() {
        let criteria = GigFilterCriteria(
            categories: [.handyman, .cleaning],
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime, .flexible],
            openToBids: true,
            postedWithin: .week
        )
        XCTAssertEqual(GigFilterCriteria(sections: criteria.sections()), criteria)
    }

    func testActiveCountCountsEachActiveDimension() {
        let criteria = GigFilterCriteria(
            categories: [.handyman],
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime],
            openToBids: true,
            postedWithin: .today
        )
        XCTAssertEqual(criteria.activeCount, 5)
    }

    // MARK: - Predicates

    func testBudgetCeilingIsOpenEnded() {
        let criteria = GigFilterCriteria(budgetLower: 100, budgetUpper: GigFilterCriteria.budgetMax)
        XCTAssertTrue(criteria.matchesBudget(1000), "upper at max should impose no ceiling")
        XCTAssertTrue(criteria.matchesBudget(100))
        XCTAssertFalse(criteria.matchesBudget(50), "below the lower handle")
    }

    func testBudgetExcludesUnpricedGigsWhenActive() {
        XCTAssertFalse(GigFilterCriteria(budgetLower: 50, budgetUpper: 300).matchesBudget(nil))
        XCTAssertTrue(GigFilterCriteria().matchesBudget(nil), "inactive budget passes everything")
    }

    func testScheduleMappingIsTolerant() {
        XCTAssertEqual(GigScheduleFilter.from(backendKey: "scheduled"), .oneTime)
        XCTAssertEqual(GigScheduleFilter.from(backendKey: "one_time"), .oneTime)
        XCTAssertEqual(GigScheduleFilter.from(backendKey: "Recurring"), .recurring)
        XCTAssertEqual(GigScheduleFilter.from(backendKey: "flexible"), .flexible)
        XCTAssertNil(GigScheduleFilter.from(backendKey: "mystery"))
        XCTAssertNil(GigScheduleFilter.from(backendKey: nil))
    }

    func testPostedWithinCutoffs() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        XCTAssertNil(GigPostedWithin.anytime.cutoff(from: now))
        XCTAssertEqual(GigPostedWithin.today.cutoff(from: now), now.addingTimeInterval(-86400))
        XCTAssertEqual(GigPostedWithin.week.cutoff(from: now), now.addingTimeInterval(-604_800))
    }

    // MARK: - Server-side query mapping

    func testServerPriceParamsDeriveFromBudgetHandles() {
        XCTAssertNil(GigFilterCriteria().serverMinPrice, "Default lower handle sends no minPrice.")
        XCTAssertNil(GigFilterCriteria().serverMaxPrice, "The $500+ ceiling sends no maxPrice.")
        let active = GigFilterCriteria(budgetLower: 100, budgetUpper: 300)
        XCTAssertEqual(active.serverMinPrice, 100)
        XCTAssertEqual(active.serverMaxPrice, 300)
        let openEnded = GigFilterCriteria(budgetLower: 100, budgetUpper: GigFilterCriteria.budgetMax)
        XCTAssertNil(openEnded.serverMaxPrice, "Upper at max imposes no ceiling server-side either.")
    }

    func testServerPayTypeMapsOpenToBids() {
        XCTAssertNil(GigFilterCriteria().serverPayType)
        XCTAssertEqual(GigFilterCriteria(openToBids: true).serverPayType, "offers")
    }

    func testServerScheduleTypeOnlyForSingleMappableSelection() {
        XCTAssertNil(GigFilterCriteria().serverScheduleType)
        XCTAssertEqual(GigFilterCriteria(schedules: [.oneTime]).serverScheduleType, "scheduled")
        XCTAssertEqual(GigFilterCriteria(schedules: [.flexible]).serverScheduleType, "flexible")
        XCTAssertNil(
            GigFilterCriteria(schedules: [.recurring]).serverScheduleType,
            "recurring has no backend schedule_type value."
        )
        XCTAssertNil(
            GigFilterCriteria(schedules: [.oneTime, .flexible]).serverScheduleType,
            "The backend takes a single value — multi-select stays client-side."
        )
    }

    func testMatchesClientSideSkipsServerHandledDimensions() {
        // Budget + open-to-bids are server-side: a gig outside the budget
        // band still passes the residual predicate.
        let gig = makeGig(price: 999, scheduleType: "asap", acceptedBy: "worker-1")
        let criteria = GigFilterCriteria(budgetLower: 50, budgetUpper: 100, openToBids: true)
        XCTAssertTrue(criteria.matchesClientSide(gig))
        // …while a single mappable schedule (server param) is skipped too.
        let serverSchedule = GigFilterCriteria(schedules: [.oneTime])
        XCTAssertTrue(serverSchedule.matchesClientSide(gig))
        // …but a residual schedule selection still filters locally.
        let residualSchedule = GigFilterCriteria(schedules: [.oneTime, .flexible])
        XCTAssertFalse(residualSchedule.matchesClientSide(gig), "asap matches neither residual bucket.")
    }

    private func makeGig(price: Double?, scheduleType: String?, acceptedBy: String?) -> GigDTO {
        GigDTO(
            id: "g-test",
            title: "Test gig",
            description: nil,
            price: price,
            category: "handyman",
            status: "open",
            createdAt: "2026-06-09T08:00:00Z",
            deadline: nil,
            isUrgent: nil,
            tags: nil,
            userId: "u1",
            acceptedBy: acceptedBy,
            acceptedAt: nil,
            ownerConfirmedAt: nil,
            scheduledStart: nil,
            paymentStatus: nil,
            engagementMode: nil,
            scheduleType: scheduleType,
            payType: nil,
            taskArchetype: nil,
            isV2: nil,
            pickupAddress: nil,
            dropoffAddress: nil,
            bidCount: nil,
            savedByUser: nil,
            distanceMiles: nil,
            latitude: nil,
            longitude: nil,
            approxLocation: nil,
            locationUnlocked: nil,
            location: nil,
            exactCity: nil,
            exactState: nil,
            creator: nil
        )
    }

    // MARK: - Sheet construction

    func testSheetConstructsAndParsesOnApply() {
        var captured: GigFilterCriteria?
        let sheet = GigFilterSheet(
            criteria: GigFilterCriteria(categories: [.handyman]),
            onApply: { captured = $0 },
            onClose: {}
        )
        _ = UIHostingController(rootView: sheet)
        XCTAssertNil(captured, "onApply only fires on the shell's Apply button")
    }

    // MARK: - View-model integration

    private func makeAPI() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    /// Location stub that never has a coordinate — keeps the feed VM off
    /// the location-resolve path so it issues no request the sequenced
    /// mock hasn't stubbed, regardless of the host sim's cached location.
    private final class NoLocationProvider: LocationProviding, @unchecked Sendable {
        func cachedCoordinate() -> UserCoordinate? {
            nil
        }

        func requestCurrent(timeoutSeconds _: TimeInterval) async -> UserCoordinate? {
            nil
        }
    }

    private static let handymanGigJSON = """
    {
      "id": "g1", "title": "Hang shelves", "description": "Mount shelves.",
      "price": 60, "category": "handyman", "status": "open",
      "created_at": "2026-05-19T08:00:00Z", "user_id": "u1", "bid_count": 4,
      "distance_miles": 0.2
    }
    """

    private static let cleaningGigJSON = """
    {
      "id": "g2", "title": "Deep clean apartment", "description": "Kitchen + bath.",
      "price": 180, "category": "cleaning", "status": "open",
      "created_at": "2026-05-19T05:00:00Z", "user_id": "u2", "bid_count": 0,
      "distance_miles": 0.5
    }
    """

    private static func gigsJSON(_ rows: String...) -> String {
        "{\"gigs\":[\(rows.joined(separator: ","))],\"total\":\(rows.count)}"
    }

    func testApplyBudgetFilterRefetchesWithPriceParams() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            // Budget rides the request — the backend returns the
            // already-narrowed page.
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = GigsFeedViewModel(api: makeAPI(), location: NoLocationProvider())
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(budgetLower: 0, budgetUpper: 100))
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected .loaded, got \(vm.state)") }
        XCTAssertEqual(rows.map(\.id), ["g1"], "rows reflect the server's filtered page")
        XCTAssertEqual(vm.activeFilterCount, 1)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.last?.url?.query?.contains("maxPrice=100") ?? false,
            "budget ceiling rides the refetch as maxPrice"
        )
    }

    func testApplyCategoryFilterWithNoMatchesFallsToEmpty() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let vm = GigsFeedViewModel(api: makeAPI(), location: NoLocationProvider())
        await vm.load()
        // Multi-category is client-side — both fetched rows fall out.
        await vm.applyFilters(GigFilterCriteria(categories: [.tech]))
        guard case .empty = vm.state else { return XCTFail("Expected .empty when nothing matches, got \(vm.state)") }
    }

    func testResettingFiltersRestoresFullList() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let vm = GigsFeedViewModel(api: makeAPI(), location: NoLocationProvider())
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(categories: [.tech]))
        await vm.applyFilters(GigFilterCriteria())
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected .loaded, got \(vm.state)") }
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(vm.activeFilterCount, 0)
    }

    // MARK: - P6a saved-search mapping (pure)

    func testSavedSearchNameMatchesSpecExample() {
        let criteria = GigFilterCriteria(categories: [.cleaning], budgetUpper: 100)
        XCTAssertEqual(
            criteria.savedSearchName(feedCategory: .all, searchText: "", radiusMiles: 5),
            "Cleaning · under $100 · 5 mi"
        )
    }

    func testSavedSearchNameCoversEveryDimension() {
        let criteria = GigFilterCriteria(
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime],
            openToBids: true
        )
        XCTAssertEqual(
            criteria.savedSearchName(feedCategory: .handyman, searchText: " mount tv ", radiusMiles: 2.5),
            "Handyman · \u{201C}mount tv\u{201D} · $50–$300 · One-time · open to bids · 2.5 mi"
        )
        XCTAssertEqual(
            GigFilterCriteria().savedSearchName(feedCategory: .all, searchText: "", radiusMiles: 5),
            "All tasks · 5 mi"
        )
        XCTAssertEqual(
            GigFilterCriteria(budgetLower: 100).savedSearchName(feedCategory: .all, searchText: "", radiusMiles: 5),
            "All tasks · over $100 · 5 mi"
        )
    }

    func testSavedSearchNameSkipsUnmappableSchedule() {
        // `recurring` has no backend schedule_type — it never rides the
        // body, so the name omits it too.
        let criteria = GigFilterCriteria(schedules: [.recurring])
        XCTAssertEqual(
            criteria.savedSearchName(feedCategory: .all, searchText: "", radiusMiles: 5),
            "All tasks · 5 mi"
        )
    }

    func testSavedSearchCategoryPrecedence() {
        XCTAssertEqual(
            GigFilterCriteria(categories: [.moving]).savedSearchCategory(feedCategory: .cleaning),
            .moving,
            "Exactly one sheet chip wins over the feed chip."
        )
        XCTAssertEqual(
            GigFilterCriteria().savedSearchCategory(feedCategory: .cleaning),
            .cleaning,
            "No sheet chips — the feed's active chip applies."
        )
        XCTAssertNil(GigFilterCriteria().savedSearchCategory(feedCategory: .all), "All is omitted.")
        XCTAssertNil(
            GigFilterCriteria(categories: [.moving, .tech]).savedSearchCategory(feedCategory: .cleaning),
            "Multi-select saves category-less — the backend stores one value."
        )
    }

    func testSavedSearchBodyMapsServerDimensions() {
        let criteria = GigFilterCriteria(
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime],
            openToBids: true
        )
        let body = criteria.savedSearchBody(
            feedCategory: .cleaning,
            searchText: " mount tv ",
            latitude: 40.7,
            longitude: -73.9,
            radiusMiles: 5
        )
        XCTAssertEqual(body.category, "cleaning")
        XCTAssertEqual(body.search, "mount tv", "Search text rides trimmed.")
        XCTAssertEqual(body.minPrice, 50)
        XCTAssertEqual(body.maxPrice, 300)
        XCTAssertEqual(body.scheduleType, "scheduled")
        XCTAssertEqual(body.payType, "offers")
        XCTAssertEqual(body.latitude, 40.7)
        XCTAssertEqual(body.longitude, -73.9)
        XCTAssertEqual(body.radiusMiles, 5)
        XCTAssertTrue(body.notify)
        XCTAssertFalse(body.name?.isEmpty ?? true, "A derived name always rides the body.")
    }

    func testSavedSearchBodyOmitsInactiveDimensions() {
        let body = GigFilterCriteria().savedSearchBody(
            feedCategory: .all,
            searchText: "",
            latitude: 40.7,
            longitude: -73.9,
            radiusMiles: 5
        )
        XCTAssertNil(body.category)
        XCTAssertNil(body.search)
        XCTAssertNil(body.minPrice, "Untouched lower handle sends no min_price.")
        XCTAssertNil(body.maxPrice, "The $500+ ceiling sends no max_price.")
        XCTAssertNil(body.scheduleType)
        XCTAssertNil(body.payType)
    }

    func testCanSaveSearchRequiresCriteriaOrSearchText() {
        XCTAssertFalse(GigFilterCriteria().canSaveSearch(searchText: ""))
        XCTAssertFalse(GigFilterCriteria().canSaveSearch(searchText: "   "))
        XCTAssertTrue(GigFilterCriteria().canSaveSearch(searchText: "tv"))
        XCTAssertTrue(GigFilterCriteria(openToBids: true).canSaveSearch(searchText: ""))
        XCTAssertTrue(GigFilterCriteria(postedWithin: .week).canSaveSearch(searchText: ""))
    }

    // MARK: - P6a manage sheet view-model

    private static func savedSearchJSON(
        id: String,
        name: String? = nil,
        notify: Bool = true
    ) -> String {
        let nameField = name.map { "\"\($0)\"" } ?? "null"
        return """
        {
          "id": "\(id)", "user_id": "me", "name": \(nameField),
          "category": "cleaning", "search": null,
          "min_price": null, "max_price": 100,
          "schedule_type": null, "pay_type": null,
          "latitude": 40.7, "longitude": -73.9, "radius_miles": 5,
          "notify": \(notify), "created_at": "2026-06-09T08:00:00.123456+00:00",
          "last_notified_at": null
        }
        """
    }

    private static func searchesJSON(_ rows: String...) -> String {
        "{\"searches\":[\(rows.joined(separator: ","))]}"
    }

    func testManageSheetLoadProjectsRows() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.searchesJSON(
                Self.savedSearchJSON(id: "ss1", name: "Cleaning · under $100 · 5 mi"),
                Self.savedSearchJSON(id: "ss2", notify: false)
            ))
        ]
        let vm = GigSavedSearchesViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected .loaded, got \(vm.state)") }
        XCTAssertEqual(rows.map(\.id), ["ss1", "ss2"])
        XCTAssertEqual(rows[0].name, "Cleaning · under $100 · 5 mi", "Stored name wins.")
        XCTAssertEqual(rows[1].name, "Cleaning", "Nameless rows derive one from criteria.")
        XCTAssertEqual(rows[1].summary, "under $100 · within 5 mi")
        XCTAssertTrue(rows[0].notify)
        XCTAssertFalse(rows[1].notify)
        XCTAssertNotNil(rows[0].createdLabel, "Supabase microsecond timestamps still parse.")
    }

    func testManageSheetEmptyAndErrorStates() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [.status(200, body: "{\"searches\":[]}")]
        let emptyVM = GigSavedSearchesViewModel(api: makeAPI())
        await emptyVM.load()
        guard case .empty = emptyVM.state else { return XCTFail("Expected .empty, got \(emptyVM.state)") }

        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let errorVM = GigSavedSearchesViewModel(api: makeAPI())
        await errorVM.load()
        guard case .error = errorVM.state else { return XCTFail("Expected .error, got \(errorVM.state)") }
    }

    func testManageSheetNotifyTogglePatchesOptimistically() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.searchesJSON(Self.savedSearchJSON(id: "ss1"))),
            .status(200, body: "{\"search\":\(Self.savedSearchJSON(id: "ss1", notify: false))}")
        ]
        let vm = GigSavedSearchesViewModel(api: makeAPI())
        await vm.load()
        await vm.setNotify(id: "ss1", to: false)
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected .loaded, got \(vm.state)") }
        XCTAssertFalse(rows[0].notify)
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "PATCH")
        XCTAssertEqual(last?.url?.path, "/api/gigs/saved-searches/ss1")
    }

    func testManageSheetNotifyToggleRevertsOnFailure() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.searchesJSON(Self.savedSearchJSON(id: "ss1"))),
            .status(500, body: "{}")
        ]
        let vm = GigSavedSearchesViewModel(api: makeAPI())
        await vm.load()
        await vm.setNotify(id: "ss1", to: false)
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected .loaded, got \(vm.state)") }
        XCTAssertTrue(rows[0].notify, "Failed PATCH reverts the optimistic flip.")
        XCTAssertNotNil(vm.toast)
    }

    func testManageSheetDeleteRemovesRowAndFallsToEmpty() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.searchesJSON(Self.savedSearchJSON(id: "ss1"))),
            .status(200, body: "{\"message\":\"Saved search deleted\"}")
        ]
        let vm = GigSavedSearchesViewModel(api: makeAPI())
        await vm.load()
        await vm.deleteSearch(id: "ss1")
        guard case .empty = vm.state else { return XCTFail("Expected .empty, got \(vm.state)") }
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "DELETE")
        XCTAssertEqual(last?.url?.path, "/api/gigs/saved-searches/ss1")
    }

    func testManageSheetDeleteRevertsOnFailure() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.searchesJSON(Self.savedSearchJSON(id: "ss1"))),
            .status(500, body: "{}")
        ]
        let vm = GigSavedSearchesViewModel(api: makeAPI())
        await vm.load()
        await vm.deleteSearch(id: "ss1")
        guard case let .loaded(rows) = vm.state else { return XCTFail("Expected restored .loaded, got \(vm.state)") }
        XCTAssertEqual(rows.map(\.id), ["ss1"], "Failed DELETE restores the optimistic removal.")
        XCTAssertNotNil(vm.toast)
    }

    func testManageSheetRowLabels() {
        XCTAssertEqual(GigSavedSearchesViewModel.scheduleLabel("scheduled"), "One-time")
        XCTAssertEqual(GigSavedSearchesViewModel.scheduleLabel("asap"), "ASAP")
        XCTAssertNil(GigSavedSearchesViewModel.scheduleLabel(nil))
        XCTAssertEqual(GigSavedSearchesViewModel.payLabel("offers"), "open to bids")
        let now = Date(timeIntervalSince1970: 1_700_172_800)
        XCTAssertEqual(
            GigSavedSearchesViewModel.createdLabel(
                ISO8601DateFormatter().string(from: now.addingTimeInterval(-172_800)),
                now: now
            ),
            "Saved 2d ago"
        )
        XCTAssertNil(GigSavedSearchesViewModel.createdLabel(nil, now: now))
    }
}
