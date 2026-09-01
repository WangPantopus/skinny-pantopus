//
//  SupportTrainDetailViewModelTests.swift
//  PantopusTests
//
//  A10.9 (P3.1) — Covers the Support Train detail VM:
//    - initial state is loading,
//    - load() resolves to `.loaded` via the default resolver,
//    - the default resolver picks fully-covered when the trainId
//      contains "covered" / "full" so QA can swap variants on the
//      same row tap,
//    - seeded states survive load() so previews + the chrome tests
//      can exercise loading / error deterministically,
//    - the populated + fully-covered sample fixtures match the
//      A10.9 frame contract (slot counts, dock variant, banner
//      presence).
//

import XCTest
@testable import Pantopus

@MainActor
final class SupportTrainDetailViewModelTests: XCTestCase {
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

    // MARK: - State machine

    func testInitialStateIsLoading() {
        let vm = SupportTrainDetailViewModel(trainId: "any")
        guard case .loading = vm.state else {
            return XCTFail("Expected loading, got \(vm.state)")
        }
    }

    func testResolverResolvesPopulatedFixture() async {
        let vm = SupportTrainDetailViewModel(trainId: "abc-123", resolver: SupportTrainDetailViewModel.defaultResolver)
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.typeDates.slotsFilled, 12)
        XCTAssertEqual(content.typeDates.slotsTotal, 21)
        XCTAssertFalse(content.isFullyCovered)
        XCTAssertNil(content.celebrationBanner)
        if case let .signUp(label) = content.dock {
            XCTAssertEqual(label, "Sign up for a slot")
        } else {
            XCTFail("Expected signUp dock, got \(content.dock)")
        }
    }

    func testResolverResolvesFullyCoveredWhenIdContainsCovered() async {
        let vm = SupportTrainDetailViewModel(
            trainId: "fully-covered-xyz",
            resolver: SupportTrainDetailViewModel.defaultResolver
        )
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertTrue(content.isFullyCovered)
        XCTAssertEqual(content.typeDates.slotsFilled, 21)
        XCTAssertEqual(content.typeDates.slotsTotal, 21)
        XCTAssertNotNil(content.celebrationBanner)
        if case .sendCardAndBackup = content.dock {} else {
            XCTFail("Expected sendCardAndBackup dock, got \(content.dock)")
        }
    }

    func testCustomResolverReturningNilSurfacesError() async {
        let vm = SupportTrainDetailViewModel(trainId: "missing") { _ in nil }
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
        XCTAssertFalse(message.isEmpty)
    }

    func testSeededStateSurvivesLoad() async {
        let vm = SupportTrainDetailViewModel(seedState: .error(message: "Boom"))
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected seeded error to persist, got \(vm.state)")
        }
        XCTAssertEqual(message, "Boom")
    }

    func testRefreshReloadsViaResolver() async {
        var hits = 0
        let vm = SupportTrainDetailViewModel(trainId: "any") { _ in
            hits += 1
            return SupportTrainDetailSampleData.populated
        }
        await vm.load()
        await vm.refresh()
        XCTAssertEqual(hits, 2)
        guard case .loaded = vm.state else {
            return XCTFail("Expected loaded after refresh, got \(vm.state)")
        }
    }

    func testConvenienceContentInitSeedsLoadedState() {
        let vm = SupportTrainDetailViewModel(content: SupportTrainDetailSampleData.populated)
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.trainId, "sample-populated")
    }

    // MARK: - Sample fixtures

    func testPopulatedFixtureMatchesFrame() {
        let content = SupportTrainDetailSampleData.populated
        XCTAssertEqual(content.recipient.householdName, "The Reyes household")
        XCTAssertEqual(content.recipient.identityTag, .home)
        XCTAssertTrue(content.recipient.verified)

        XCTAssertEqual(content.typeDates.kind, .meals)
        XCTAssertEqual(content.typeDates.slotsFilled, 12)
        XCTAssertEqual(content.typeDates.slotsTotal, 21)
        XCTAssertEqual(content.typeDates.daysLeft, 20)
        XCTAssertEqual(content.typeDates.percentCovered, 57)

        XCTAssertEqual(content.calendarDays.count, 28)
        // Tue Dec 2 (idx 8) is the `today` cell in the JSX.
        XCTAssertEqual(content.calendarDays[8].state, .today)
        // Mirrors the JSX state-vocab: 8 past (Nov 24-30 + Dec 1),
        // 1 today (Dec 2), 6 filled (Dec 3/5/7/9/11/14), 13 open
        // (Dec 4/6/8/10/12/13 + the all-open Dec 15-21 band).
        let pastCount = content.calendarDays.filter { $0.state == .past }.count
        let todayCount = content.calendarDays.filter { $0.state == .today }.count
        let openCount = content.calendarDays.filter { $0.state == .open }.count
        let filledCount = content.calendarDays.filter { $0.state == .filled }.count
        XCTAssertEqual(pastCount, 8)
        XCTAssertEqual(todayCount, 1)
        XCTAssertEqual(filledCount, 6)
        XCTAssertEqual(openCount, 13)

        XCTAssertEqual(content.sections.count, 2)
        XCTAssertEqual(content.sections[0].id, "open")
        XCTAssertEqual(content.sections[0].rows.count, 3)
        XCTAssertEqual(content.sections[0].actionLabel, "See all 9")
        XCTAssertEqual(content.sections[1].id, "covered")
        XCTAssertEqual(content.sections[1].rows.count, 3)

        XCTAssertNil(content.celebrationBanner)
        if case let .signUp(label) = content.dock {
            XCTAssertEqual(label, "Sign up for a slot")
        } else {
            XCTFail("Expected signUp dock")
        }
    }

    func testFullyCoveredFixtureMatchesFrame() {
        let content = SupportTrainDetailSampleData.fullyCovered
        XCTAssertEqual(content.typeDates.slotsFilled, 21)
        XCTAssertEqual(content.typeDates.slotsTotal, 21)
        XCTAssertTrue(content.isFullyCovered)
        XCTAssertEqual(content.typeDates.percentCovered, 100)

        XCTAssertEqual(content.calendarDays.count, 28)
        // Every open in the populated grid flips to filled in fully-covered;
        // idx 10 is the viewer's "mine" cell.
        XCTAssertEqual(content.calendarDays[10].state, .mine)
        let mineCount = content.calendarDays.filter { $0.state == .mine }.count
        let openCount = content.calendarDays.filter { $0.state == .open }.count
        let pastCount = content.calendarDays.filter { $0.state == .past }.count
        XCTAssertEqual(mineCount, 1)
        XCTAssertEqual(openCount, 0, "Fully-covered grid has no open cells")
        XCTAssertEqual(pastCount, 8, "Past cells are preserved across variants")

        XCTAssertNotNil(content.celebrationBanner)
        XCTAssertEqual(content.celebrationBanner?.title, "Every slot is covered")

        XCTAssertEqual(content.sections.count, 2)
        XCTAssertEqual(content.sections[0].id, "mine")
        XCTAssertTrue(content.sections[0].rows.allSatisfy(\.mine))
        XCTAssertEqual(content.sections[1].id, "nextup")
        XCTAssertEqual(content.sections[1].actionLabel, "See all 21")

        if case .sendCardAndBackup = content.dock {} else {
            XCTFail("Expected sendCardAndBackup dock")
        }
    }

    func testCurrentContentAndIsFullyCoveredAccessors() async {
        let vm = SupportTrainDetailViewModel(trainId: "covered-1", resolver: SupportTrainDetailViewModel.defaultResolver)
        await vm.load()
        XCTAssertNotNil(vm.currentContent)
        XCTAssertTrue(vm.isFullyCovered)
    }

    // MARK: - Live detail fetch + projection

    private static let detailJSON = """
    {
      "id":"t1","title":"Meals for the Reyes family","story":"Baby arrived Nov 18 — thank you.",
      "status":"active",
      "support_modes":{"home_cooked_meals":true,"takeout":true,"groceries":false,"gift_funds":false},
      "recipient_summary":"Household of 4","household_size":4,
      "slots":[
        {"id":"s1","slot_date":"2025-12-02","slot_label":"Dinner","support_mode":"meal","status":"open","filled_count":0,"capacity":1},
        {"id":"s2","slot_date":"2025-12-03","slot_label":"Dinner","support_mode":"meal","status":"full","filled_count":1,"capacity":1}
      ],
      "my_reservations":[
        {"id":"r1","slot_id":"s2","status":"reserved","contribution_mode":"cook","dish_title":"Lentil soup",
         "created_at":"2025-11-20T00:00:00Z"}
      ],
      "updates":[],
      "organizers":[{"id":"o1","role":"primary","User":{"id":"u1","username":"diane","name":"Diane K."}}],
      "viewer_level":"viewer","exact_address_shared":false,
      "coarse_location":{"city":"Portland","state":"OR"}
    }
    """

    func testLoadFetchesDetailAndProjects() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detailJSON)]
        let vm = SupportTrainDetailViewModel(trainId: "t1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.trainId, "t1")
        XCTAssertEqual(content.typeDates.title, "Meals for the Reyes family")
        XCTAssertEqual(content.typeDates.kind, .meals)
        XCTAssertEqual(content.typeDates.slotsTotal, 2)
        XCTAssertEqual(content.typeDates.slotsFilled, 1, "s2 (full) counts as covered")
        XCTAssertFalse(content.isFullyCovered)
        XCTAssertEqual(content.calendarDays.count, 28)
        XCTAssertEqual(content.recipient.householdName, "Meals for the Reyes family")
        XCTAssertTrue(content.recipient.quote.contains("Baby"))
        XCTAssertEqual(content.hostedBy.organizerDisplayName, "Diane K.")
        // Sections: my commitment + open + covered.
        XCTAssertEqual(content.sections.map(\.id), ["mine", "open", "covered"])
        if case .signUp = content.dock {} else {
            XCTFail("Partially-covered train shows the sign-up dock")
        }
    }

    func testLoadFullyCoveredProducesCelebrationDock() async {
        let json = """
        {
          "id":"t2","title":"Meals","status":"active",
          "support_modes":{"home_cooked_meals":true},
          "slots":[
            {"id":"s1","slot_date":"2025-12-02","slot_label":"Dinner","status":"full","filled_count":1,"capacity":1}
          ],
          "my_reservations":[],"updates":[],
          "organizers":[{"id":"o1","role":"primary","User":{"id":"u1","name":"Diane K."}}]
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = SupportTrainDetailViewModel(trainId: "t2", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertTrue(content.isFullyCovered)
        XCTAssertNotNil(content.celebrationBanner)
        if case .sendCardAndBackup = content.dock {} else {
            XCTFail("Fully-covered train shows the send-card-and-backup dock")
        }
    }

    func testLoadServerErrorSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = SupportTrainDetailViewModel(trainId: "t3", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    func testCurrentContentNilOnNonLoadedState() {
        let vm = SupportTrainDetailViewModel(seedState: .loading)
        XCTAssertNil(vm.currentContent)
        XCTAssertFalse(vm.isFullyCovered)
    }

    // MARK: - Row helpers

    func testSlotRowAccessibilityLabelShape() {
        let row = SlotRowContent(
            id: "x",
            dayLabel: "Thu",
            dateLabel: "4",
            state: .open,
            title: "Open · dinner for 4",
            subtitle: "Drop off by 5:30 pm · porch shelf"
        )
        XCTAssertEqual(row.state, .open)
        XCTAssertFalse(row.mine)
        XCTAssertNil(row.author)
    }

    func testTypeDatesPercentRoundsHalfUp() {
        let card = TypeDatesCardContent(
            kind: .meals,
            title: "x",
            dateRange: "y",
            daysLeft: 0,
            slotsFilled: 1,
            slotsTotal: 3,
            contributors: [],
            extraCount: 0
        )
        XCTAssertEqual(card.percentCovered, 33)
        XCTAssertFalse(card.isFullyCovered)
    }
}
