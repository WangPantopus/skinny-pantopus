//
//  YourAudienceViewModelTests.swift
//  PantopusTests
//
//  A22.2 "Your audience". Covers:
//    - load → loaded / empty / error transitions
//    - pending vs. tier-grouped projection (premium tier first)
//    - counts parsed from string-keyed byTier; chips reflect totals even
//      when a status/tier filter is active (backend counts before filter)
//    - approve re-fetches and clears the pending queue
//

import XCTest
@testable import Pantopus

@MainActor
final class YourAudienceViewModelTests: XCTestCase {
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

    private func makeVM() -> YourAudienceViewModel {
        YourAudienceViewModel(api: makeAPI())
    }

    private let populatedBody = """
    {
      "items": [
        {"membershipId":"m1","fanHandle":"danareyes","fanDisplayName":"Dana Reyes","fanAvatarUrl":null,
         "tier":{"rank":3,"name":"Insiders"},"status":"pending","verifiedLocal":true,
         "joinedMonth":"2025-05","tenureMonths":0,"cancelAtPeriodEnd":false},
        {"membershipId":"m2","fanHandle":"priyanair","fanDisplayName":"Priya Nair","fanAvatarUrl":null,
         "tier":{"rank":4,"name":"VIP"},"status":"active","verifiedLocal":true,
         "joinedMonth":"2025-01","tenureMonths":4,"cancelAtPeriodEnd":false},
        {"membershipId":"m3","fanHandle":"tombecker","fanDisplayName":"Tom Becker","fanAvatarUrl":null,
         "tier":{"rank":4,"name":"VIP"},"status":"muted","verifiedLocal":false,
         "joinedMonth":"2024-11","tenureMonths":6,"cancelAtPeriodEnd":false},
        {"membershipId":"m4","fanHandle":"sanaortiz","fanDisplayName":"Sana Ortiz","fanAvatarUrl":null,
         "tier":{"rank":3,"name":"Insiders"},"status":"active","verifiedLocal":true,
         "joinedMonth":"2025-03","tenureMonths":2,"cancelAtPeriodEnd":false}
      ],
      "counts": {"totalActive":3,"pending":1,"byTier":{"1":0,"2":0,"3":2,"4":2}}
    }
    """

    // MARK: - Lifecycle

    func testLoadPopulatedProjectsPendingAndTierGroups() async {
        SequencedURLProtocol.sequence = [.status(200, body: populatedBody)]
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.pending.map(\.membershipId), ["m1"])
        // Premium tier first: VIP (rank 4) before Insiders (rank 3).
        XCTAssertEqual(loaded.tierGroups.map(\.rank), [4, 3])
        XCTAssertEqual(loaded.tierGroups.first?.members.count, 2) // VIP: active + muted
        XCTAssertEqual(loaded.tierGroups.last?.members.map(\.membershipId), ["m4"])
        XCTAssertTrue(loaded.tierGroups.first?.members.contains(where: \.isMuted) ?? false)
    }

    func testCountsAndCountLine() async {
        SequencedURLProtocol.sequence = [.status(200, body: populatedBody)]
        let vm = makeVM()
        await vm.load()

        XCTAssertEqual(vm.counts.totalActive, 3)
        XCTAssertEqual(vm.counts.pending, 1)
        XCTAssertEqual(vm.counts.byTier[3], 2)
        XCTAssertEqual(vm.counts.byTier[4], 2)
        XCTAssertEqual(vm.countLine, "3 members · 1 pending")
        // Chips: premium first, labelled by creator-named tier, with counts.
        XCTAssertEqual(vm.tierChips.map(\.rank), [4, 3])
        XCTAssertEqual(vm.tierChips.first?.name, "VIP")
        XCTAssertEqual(vm.tierChips.first?.count, 2)
    }

    func testLoadEmptyTransitionsToEmpty() async {
        let body = """
        {"items": [], "counts": {"totalActive":0,"pending":0,"byTier":{"1":0,"2":0,"3":0,"4":0}}}
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = makeVM()
        await vm.load()

        guard case .empty = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertEqual(vm.countLine, "0 members")
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    // MARK: - Filtering

    func testPendingFilterKeepsFullCountsForChips() async {
        let pendingOnly = """
        {
          "items": [
            {"membershipId":"m1","fanHandle":"danareyes","fanDisplayName":"Dana Reyes","fanAvatarUrl":null,
             "tier":{"rank":3,"name":"Insiders"},"status":"pending","verifiedLocal":true,
             "joinedMonth":"2025-05","tenureMonths":0,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":3,"pending":1,"byTier":{"1":0,"2":0,"3":2,"4":2}}
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedBody),
            .status(200, body: pendingOnly)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.select(filter: .pending)

        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(vm.filter, .pending)
        XCTAssertEqual(loaded.pending.count, 1)
        XCTAssertTrue(loaded.tierGroups.isEmpty) // .pending hides tier groups
        // Counts are computed before filtering, so chips still show totals.
        XCTAssertEqual(vm.tierChips.map(\.rank), [4, 3])
    }

    // MARK: - Sort

    func testCycleSortAdvancesAndToasts() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedBody),
            .status(200, body: populatedBody)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.sort, .recent)

        await vm.cycleSort()

        XCTAssertEqual(vm.sort, .tenure)
        XCTAssertEqual(vm.toast, "Sort: Longest-tenured first")
    }

    // MARK: - Pagination

    func testLoadMoreAppendsSecondPage() async {
        let page1 = """
        {
          "persona": {"id":"p1","handle":"maya"},
          "items": [
            {"membershipId":"m1","fanHandle":"a","fanDisplayName":"A","fanAvatarUrl":null,
             "tier":{"rank":4,"name":"VIP"},"status":"active","verifiedLocal":false,
             "joinedMonth":"2025-01","tenureMonths":1,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":2,"pending":0,"byTier":{"1":0,"2":0,"3":0,"4":2}},
          "pagination": {"nextOffset":1,"hasMore":true}
        }
        """
        let page2 = """
        {
          "persona": {"id":"p1","handle":"maya"},
          "items": [
            {"membershipId":"m2","fanHandle":"b","fanDisplayName":"B","fanAvatarUrl":null,
             "tier":{"rank":4,"name":"VIP"},"status":"active","verifiedLocal":false,
             "joinedMonth":"2025-02","tenureMonths":1,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":2,"pending":0,"byTier":{"1":0,"2":0,"3":0,"4":2}},
          "pagination": {"nextOffset":null,"hasMore":false}
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: page1),
            .status(200, body: page2)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.hasMore)

        await vm.loadMore()

        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.tierGroups.first?.members.map(\.membershipId), ["m1", "m2"])
        XCTAssertFalse(vm.hasMore)
    }

    // MARK: - Actions

    func testBlockCommitsFollowerStatusAndReFetches() async throws {
        let withPersona = """
        {
          "persona": {"id":"p1","handle":"maya"},
          "items": [
            {"membershipId":"m2","fanHandle":"priyanair","fanDisplayName":"Priya Nair","fanAvatarUrl":null,
             "tier":{"rank":4,"name":"VIP"},"status":"active","verifiedLocal":true,
             "joinedMonth":"2025-01","tenureMonths":4,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":1,"pending":0,"byTier":{"1":0,"2":0,"3":0,"4":1}}
        }
        """
        let afterBlock = """
        {
          "persona": {"id":"p1","handle":"maya"},
          "items": [],
          "counts": {"totalActive":0,"pending":0,"byTier":{"1":0,"2":0,"3":0,"4":0}}
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: withPersona),
            .status(200, body: "{\"follower\":{\"id\":\"m2\",\"status\":\"blocked\"}}"),
            .status(200, body: afterBlock)
        ]
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(before) = vm.state else {
            return XCTFail("Expected .loaded before block")
        }
        let member = try XCTUnwrap(before.tierGroups.first?.members.first)
        vm.requestBlock(member)
        XCTAssertEqual(vm.blockTarget?.membershipId, "m2")

        await vm.confirmBlock(member)

        XCTAssertNil(vm.blockTarget)
        XCTAssertEqual(vm.toast, "Blocked Priya Nair.")
        guard case .empty = vm.state else {
            return XCTFail("Expected .empty after block, got \(vm.state)")
        }
    }

    func testMuteReportsConfirmation() async throws {
        let afterMute = """
        {
          "items": [
            {"membershipId":"m2","fanHandle":"priyanair","fanDisplayName":"Priya Nair","fanAvatarUrl":null,
             "tier":{"rank":4,"name":"VIP"},"status":"muted","verifiedLocal":true,
             "joinedMonth":"2025-01","tenureMonths":4,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":3,"pending":1,"byTier":{"1":0,"2":0,"3":2,"4":2}}
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedBody),
            .status(200, body: "{\"membershipId\":\"m2\",\"status\":\"muted\"}"),
            .status(200, body: afterMute)
        ]
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        let member = try XCTUnwrap(loaded.tierGroups.first?.members.first)
        await vm.mute(member)

        XCTAssertEqual(vm.toast, "Muted \(member.displayName).")
        XCTAssertNil(vm.overflowTarget)
    }

    func testApproveReFetchesAndClearsPending() async throws {
        let afterApprove = """
        {
          "items": [
            {"membershipId":"m1","fanHandle":"danareyes","fanDisplayName":"Dana Reyes","fanAvatarUrl":null,
             "tier":{"rank":3,"name":"Insiders"},"status":"active","verifiedLocal":true,
             "joinedMonth":"2025-05","tenureMonths":0,"cancelAtPeriodEnd":false}
          ],
          "counts": {"totalActive":4,"pending":0,"byTier":{"1":0,"2":0,"3":3,"4":2}}
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedBody),
            .status(200, body: "{\"membershipId\":\"m1\",\"status\":\"active\"}"),
            .status(200, body: afterApprove)
        ]
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(before) = vm.state else {
            return XCTFail("Expected .loaded before approve")
        }
        let pending = before.pending.first
        XCTAssertEqual(pending?.membershipId, "m1")

        try await vm.approve(XCTUnwrap(pending))

        guard case let .loaded(after) = vm.state else {
            return XCTFail("Expected .loaded after approve, got \(vm.state)")
        }
        XCTAssertTrue(after.pending.isEmpty)
        XCTAssertEqual(vm.counts.pending, 0)
        XCTAssertEqual(vm.toast, "Approved Dana Reyes.")
    }
}
