// Existing task lifecycle, row design, filtering and completion receipt checks.
// Worker-submitted work remains Active until the owner confirms it.

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class MyTasksViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    /// Fixed clock so the time-window verdicts are deterministic.
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(api: APIClient? = nil) -> MyTasksViewModel {
        MyTasksViewModel(api: api ?? makeAPI()) { Self.fixedNow }
    }

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"gigs\":[],\"total\":0}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        // T6.0b — Magic Task primary CTA replaces the classic
        // "Post a task" headline + CTA on the Open tab.
        XCTAssertEqual(content.headline, "No tasks posted yet — try Magic Task")
        XCTAssertEqual(content.ctaTitle, "Try Magic Task")
    }

    func testLoadPopulatedTransitionsToLoadedOnOpenTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Mount TV","price":120,"category":"handyman",
               "status":"open","user_id":"u_me","bid_count":3,
               "created_at":"2026-05-13T09:00:00Z",
               "updated_at":"2026-05-15T11:00:00Z",
               "top_bidders":[
                 {"id":"b1","initials":"AR","color":"violet"},
                 {"id":"b2","initials":"MT","color":"amber"}
               ]}
            ],"total":1}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "g1")
        XCTAssertEqual(vm.tabs[0].id, MyTasksTab.open)
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertNotNil(sections.first?.rows.first?.bidderStack)
        XCTAssertEqual(sections.first?.rows.first?.bidderStack?.bidders.count, 2)
        XCTAssertEqual(sections.first?.rows.first?.bidderStack?.overflow, 1)
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testTabAssignment_OpenStatuses() {
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .reviewing), MyTasksTab.open)
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .urgent(hoursLeft: 2)), MyTasksTab.open)
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .noBids), MyTasksTab.open)
    }

    func testTabAssignment_ActiveStatuses() {
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .inProgress), MyTasksTab.active)
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .scheduled(weekday: "Sat")), MyTasksTab.active)
    }

    func testTabAssignment_DoneStatuses() {
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .awaitReview), MyTasksTab.done)
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .completed), MyTasksTab.done)
    }

    func testTabAssignment_ClosedStatuses() {
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .cancelled), MyTasksTab.closed)
        XCTAssertEqual(MyTasksViewModel.tabFor(status: .expired), MyTasksTab.closed)
    }

    func testStatusDerivation_OpenWithBidsIsReviewing() {
        let dto = makeGig(id: "x", status: "open", bidCount: 4)
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .reviewing)
    }

    func testStatusDerivation_OpenWithZeroBidsIsNoBids() {
        let dto = makeGig(id: "x", status: "open", bidCount: 0)
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .noBids)
    }

    func testStatusDerivation_OpenWithDeadlineWithin4hIsUrgent() {
        // Deadline 2h from now → urgent(2).
        let deadline = Self.fixedNow.addingTimeInterval(2 * 3600)
        let dto = makeGig(
            id: "x",
            status: "open",
            bidCount: 5,
            deadline: ISO8601DateFormatter().string(from: deadline)
        )
        guard case let .urgent(hoursLeft) = MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow) else {
            XCTFail("Expected .urgent")
            return
        }
        XCTAssertEqual(hoursLeft, 2)
    }

    func testStatusDerivation_OpenWithDeadlinePassedIsExpired() {
        let deadline = Self.fixedNow.addingTimeInterval(-1 * 3600)
        let dto = makeGig(
            id: "x",
            status: "open",
            bidCount: 0,
            deadline: ISO8601DateFormatter().string(from: deadline)
        )
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .expired)
    }

    func testStatusDerivation_AssignedWithFutureScheduledIsScheduled() {
        let scheduled = Self.fixedNow.addingTimeInterval(2 * 86400) // 2 days out
        let dto = makeGig(
            id: "x",
            status: "assigned",
            scheduledStart: ISO8601DateFormatter().string(from: scheduled)
        )
        guard case .scheduled = MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow) else {
            XCTFail("Expected .scheduled")
            return
        }
    }

    func testStatusDerivation_InProgressIsInProgress() {
        let dto = makeGig(id: "x", status: "in_progress")
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .inProgress)
    }

    func testStatusDerivation_WorkerCompletionAwaitsConfirmation() {
        let dto = makeGig(id: "x", status: "completed")
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .awaitingConfirmation)
    }

    func testStatusDerivation_CancelledIsCancelled() {
        let dto = makeGig(id: "x", status: "cancelled")
        XCTAssertEqual(MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow), .cancelled)
    }

    func testFooter_ReviewingHasEditAndReviewBids() {
        let footer = MyTasksViewModel.footerFor(status: .reviewing, bidCount: 3)
        if case let .open(bidCount) = footer {
            XCTAssertEqual(bidCount, 3)
        } else {
            XCTFail("Expected .open footer")
        }
    }

    func testFooter_UrgentHasExtendAndReviewBids() {
        let footer = MyTasksViewModel.footerFor(status: .urgent(hoursLeft: 2), bidCount: 5)
        if case let .urgent(bidCount) = footer {
            XCTAssertEqual(bidCount, 5)
        } else {
            XCTFail("Expected .urgent footer")
        }
    }

    func testFooter_NoBidsHasBoost() {
        XCTAssertEqual(MyTasksViewModel.footerFor(status: .noBids, bidCount: 0), .boost)
    }

    func testFooter_InProgressHasViewTask() {
        XCTAssertEqual(
            MyTasksViewModel.footerFor(status: .inProgress, bidCount: 0),
            .inProgress
        )
    }

    func testFooter_AwaitReviewHasReview() {
        XCTAssertEqual(
            MyTasksViewModel.footerFor(status: .awaitReview, bidCount: 0),
            .review
        )
    }

    func testFooter_CompletedHasNoFooter() {
        XCTAssertEqual(
            MyTasksViewModel.footerFor(status: .completed, bidCount: 0),
            .none
        )
    }

    func testFooter_CancelledHasRepost() {
        XCTAssertEqual(
            MyTasksViewModel.footerFor(status: .cancelled, bidCount: 0),
            .repost
        )
    }

    func testFooter_ExpiredHasRepost() {
        XCTAssertEqual(
            MyTasksViewModel.footerFor(status: .expired, bidCount: 0),
            .repost
        )
    }

    func testHighlight_TerminalRowsAreMuted() {
        XCTAssertEqual(MyTasksViewModel.highlight(for: .cancelled), .muted)
        XCTAssertEqual(MyTasksViewModel.highlight(for: .expired), .muted)
    }

    func testHighlight_NonTerminalRowsHaveNoHighlight() {
        XCTAssertNil(MyTasksViewModel.highlight(for: .reviewing))
        XCTAssertNil(MyTasksViewModel.highlight(for: .urgent(hoursLeft: 2)))
        XCTAssertNil(MyTasksViewModel.highlight(for: .noBids))
        XCTAssertNil(MyTasksViewModel.highlight(for: .inProgress))
        XCTAssertNil(MyTasksViewModel.highlight(for: .awaitReview))
    }

    func testBidderStack_OverflowEqualsCountMinusVisible() {
        let dto = makeGig(
            id: "x",
            status: "open",
            bidCount: 12,
            topBidders: [
                TopBidderDTO(id: "u1", initials: "AR", color: "violet"),
                TopBidderDTO(id: "u2", initials: "MT", color: "amber"),
                TopBidderDTO(id: "u3", initials: "JP", color: "teal")
            ]
        )
        let stack = MyTasksViewModel.bidderStack(for: dto)
        XCTAssertEqual(stack?.bidders.count, 3)
        XCTAssertEqual(stack?.overflow, 9)
    }

    func testBidderStack_EmptyWhenNoBidders() {
        let dto = makeGig(id: "x", status: "open", bidCount: 0, topBidders: [])
        XCTAssertNil(MyTasksViewModel.bidderStack(for: dto))
    }

    func testToneMapping_KnownTonesPassThrough() {
        XCTAssertEqual(MyTasksViewModel.tone(for: "sky"), .sky)
        XCTAssertEqual(MyTasksViewModel.tone(for: "teal"), .teal)
        XCTAssertEqual(MyTasksViewModel.tone(for: "amber"), .amber)
        XCTAssertEqual(MyTasksViewModel.tone(for: "rose"), .rose)
        XCTAssertEqual(MyTasksViewModel.tone(for: "violet"), .violet)
    }

    func testToneMapping_UnknownToneFallsBackToSlate() {
        XCTAssertEqual(MyTasksViewModel.tone(for: "tangerine"), .slate)
        XCTAssertEqual(MyTasksViewModel.tone(for: ""), .slate)
    }

    func testBannerOnOpenTabSummarisesNewBids() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Mount TV","price":120,"category":"handyman",
               "status":"open","user_id":"u_me","bid_count":4,
               "created_at":"2026-05-13T09:00:00Z",
               "updated_at":"2026-05-15T10:00:00Z"}
            ],"total":1}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertNotNil(vm.banner)
        // updated_at within 24h, bid_count=4 → banner shows "4 new bids since yesterday".
        XCTAssertEqual(vm.banner?.title, "4 new bids since yesterday")
    }

    func testBoostFlipsExpiresAtInCache() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Drip fix","price":90,"category":"handyman",
               "status":"open","user_id":"u_me","bid_count":0,
               "created_at":"2026-05-13T09:00:00Z"}
            ],"total":1}
            """),
            .status(200, body: "{\"boost_expires_at\":\"2026-05-16T12:00:00Z\"}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case .loaded = vm.state else {
            XCTFail("Expected .loaded after initial fetch")
            return
        }
        // Find the loaded gig and boost it via the static row's callbacks
        // by calling the VM helper directly.
        let dto = MyGigDTO(
            id: "g1",
            title: "Drip fix",
            price: 90,
            category: "handyman",
            status: "open",
            createdAt: "2026-05-13T09:00:00Z",
            userId: "u_me",
            bidCount: 0
        )
        await vm.boost(dto)
        // After boost the row still lives on the Open tab and bid_count is unchanged.
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after boost")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "g1")
    }

    func testListedConfirmationRetainsLoadedReview() async throws {
        let json = #"{"id":"g1","title":"Work","status":"completed","completion_review":"listed-review"}"#
        let dto = try JSONDecoder().decode(MyGigDTO.self, from: Data(json.utf8))
        XCTAssertEqual(dto.completionReview, "listed-review")
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"gigs\":[\(json)],\"total\":1}"),
            .status(200, body: #"{"message":"ok"}"#)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.markComplete(dto)
        let command = SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/gigs/g1/complete" }
        let body = String(data: command?.authTestBodyData() ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains("listed-review"))
        XCTAssertTrue(body.contains("expectedReview"))
    }

    func testWorkerCompletionStaysActiveUntilOwnerConfirms() {
        let unconfirmed = MyGigDTO(id: "g1", title: "Work", status: "completed", completionReview: "loaded-review")
        let confirmed = MyGigDTO(id: "g1", title: "Work", status: "completed", ownerConfirmedAt: "2026-09-15T12:00:00Z")
        XCTAssertEqual(
            MyTasksViewModel.tabFor(status: MyTasksViewModel.derivedStatus(for: unconfirmed, now: Self.fixedNow)),
            MyTasksTab.active
        )
        XCTAssertEqual(MyTasksViewModel.tabFor(status: MyTasksViewModel.derivedStatus(for: confirmed, now: Self.fixedNow)), MyTasksTab.done)
        XCTAssertEqual(renderRow(for: unconfirmed).footer?.actions.last?.title, "Confirm completion")
        XCTAssertEqual(renderRow(for: makeGig(id: "g2", status: "in_progress")).footer?.actions.last?.title, "View task")
    }

    func testPrematureConfirmationOpensTaskWithoutSending() async {
        let dto = MyGigDTO(id: "g1", title: "Work", status: "in_progress")
        SequencedURLProtocol.sequence = [.status(200, body: #"{"gigs":[{"id":"g1","title":"Work","status":"in_progress"}]}"#)]
        var opened: [String] = []
        let vm = MyTasksViewModel(api: makeAPI(), onOpenTask: { opened.append($0.id) }, now: { Self.fixedNow })
        await vm.load()
        await vm.markComplete(dto)
        XCTAssertEqual(opened, ["g1"])
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/complete" })
    }

    func testConfirmationWaitsForReceiptAndIgnoresDuplicateTap() async throws {
        let before = #"{"id":"g1","title":"Work","status":"completed","completion_review":"loaded-review"}"#
        let after = #"{"id":"g1","title":"Work","status":"completed","owner_confirmed_at":"2026-09-15T12:00:00Z"}"#
        let dto = try JSONDecoder().decode(MyGigDTO.self, from: Data(before.utf8))
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [.status(200, body: "{\"gigs\":[\(before)]}"), .status(200, body: "{\"gigs\":[\(after)]}")],
            "/api/gigs/g1/complete": [.status(200, body: "{\"gig\":\(after)}", delay: 0.3)]
        ]
        let vm = makeVM()
        await vm.load()
        let pending = Task { await vm.markComplete(dto) }
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.contains(where: { $0.url?.path == "/api/gigs/g1/complete" }) { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(vm.tabs.first { $0.id == MyTasksTab.active }?.count, 1)
        XCTAssertEqual(vm.tabs.first { $0.id == MyTasksTab.done }?.count, 0)
        await vm.markComplete(dto)
        await pending.value
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/gigs/g1/complete" }.count, 1)
        XCTAssertEqual(vm.tabs.first { $0.id == MyTasksTab.active }?.count, 0)
        XCTAssertEqual(vm.tabs.first { $0.id == MyTasksTab.done }?.count, 1)
    }

    func testCanceledConfirmationDoesNotNavigateFromRetiredAction() async throws {
        let before = #"{"id":"g1","title":"Work","status":"completed","completion_review":"loaded-review"}"#
        let dto = try JSONDecoder().decode(MyGigDTO.self, from: Data(before.utf8))
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [.status(200, body: "{\"gigs\":[\(before)]}")],
            "/api/gigs/g1/complete": [.status(503, body: "{}", delay: 0.5)]
        ]
        var opened = 0
        let onOpen: @MainActor (MyGigDTO) -> Void = { _ in opened += 1 }
        let vm = MyTasksViewModel(api: makeAPI(), onOpenTask: onOpen)
        await vm.load()
        let pending = Task { await vm.markComplete(dto) }
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.contains(where: { $0.url?.path == "/api/gigs/g1/complete" }) { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/complete" })
        pending.cancel()
        await pending.value
        XCTAssertEqual(opened, 0)
    }

    func testOlderRefreshCannotOverwriteTheLastAcceptedListAfterNewerFailure() async throws {
        let initial = #"{"gigs":[{"id":"initial","title":"Initial task","status":"open"}]}"#
        let stale = #"{"gigs":[{"id":"stale","title":"Stale task","status":"open"}]}"#
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/my-gigs": [
                .status(200, body: initial),
                .status(200, body: stale, delay: 0.3),
                .status(503, body: "{}")
            ]
        ]
        let vm = makeVM()
        await vm.load()
        let earlier = Task { await vm.refresh() }
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.count >= 2 { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        await vm.refresh()
        await earlier.value
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected the last accepted list") }
        XCTAssertEqual(sections.first?.rows.first?.id, "initial")
    }

    private func renderRow(for dto: MyGigDTO) -> RowModel {
        let status = MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow)
        let projection = MyTasksViewModel.GigProjection(
            dto: dto,
            tab: MyTasksViewModel.tabFor(status: status),
            status: status,
            footer: MyTasksViewModel.footerFor(status: status, bidCount: dto.bidCount ?? 0)
        )
        return MyTasksViewModel.row(
            projection: projection,
            now: Self.fixedNow,
            callbacks: MyTasksViewModel.RowCallbacks()
        )
    }

    private func makeGig(
        id: String,
        status: String,
        bidCount: Int = 0,
        deadline: String? = nil,
        scheduledStart: String? = nil,
        topBidders: [TopBidderDTO] = [],
        sourceFlow: String? = nil,
        taskArchetype: String? = nil,
        taskFormat: String? = nil
    ) -> MyGigDTO {
        MyGigDTO(
            id: id,
            title: "Test gig",
            price: 100,
            category: "handyman",
            status: status,
            createdAt: "2026-05-13T09:00:00Z",
            updatedAt: "2026-05-15T10:00:00Z",
            deadline: deadline,
            userId: "u_me",
            scheduledStart: scheduledStart,
            bidCount: bidCount,
            topBidders: topBidders.isEmpty ? nil : topBidders,
            sourceFlow: sourceFlow,
            taskArchetype: taskArchetype,
            taskFormat: taskFormat
        )
    }
}
