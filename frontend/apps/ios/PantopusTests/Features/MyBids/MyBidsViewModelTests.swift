//
//  MyBidsViewModelTests.swift
//  PantopusTests
//
//  T5.3.1 — My bids. Covers:
//    - load → loaded / empty / error transitions
//    - tab assignment per backend status (pending → Active,
//      countered → Active, accepted → Accepted, accepted+completed gig
//      → Done, rejected → Rejected, withdrawn → Rejected, expired →
//      Rejected, cancelled gig → Rejected)
//    - chip derivation: pending+near-expiry → expiring(hoursLeft:),
//      accepted+future proposed → scheduled, accepted+in_progress
//      keeps accepted, shortlisted=true → shortlisted, your_rank=1 →
//      topBid, your_rank>1 + top_price → outbid, completed gig → leaveReview
//    - footer derivation: Active → .edit (Withdraw + Edit bid),
//      Accepted+in_progress → .complete, Accepted+other → .message,
//      Done+leaveReview → .review, Rejected → .rebid
//    - muted highlight on terminal rows (rejected, withdrawn, cancelled)
//    - optimistic withdraw moves the row out of Active and back to
//      Rejected on success / rolls back on failure
//    - banner content for the Active tab summarises leading + closingSoon
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length file_length

@MainActor
final class MyBidsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    /// 2026-05-15 12:00:00 UTC — fixed so the time-window verdicts are
    /// deterministic across runs.
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

    private func makeVM(api: APIClient? = nil) -> MyBidsViewModel {
        MyBidsViewModel(api: api ?? makeAPI()) { Self.fixedNow }
    }

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"bids\":[],\"total\":0}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "You haven\u{2019}t bid on any tasks yet")
        XCTAssertEqual(content.ctaTitle, "Browse tasks")
    }

    func testLoadPopulatedTransitionsToLoadedOnActiveTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[
              {"id":"a1","gig_id":"g_a1","user_id":"u_me","bid_amount":95,"status":"pending",
               "created_at":"2026-05-13T09:00:00Z",
               "gig":{"id":"g_a1","title":"Mount TV","price":120,
                      "category":"handyman","status":"open","user_id":"u_owner"}}
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
        XCTAssertEqual(sections.first?.rows.first?.id, "a1")
        XCTAssertEqual(vm.tabs[0].id, MyBidsTab.active)
        XCTAssertEqual(vm.tabs[0].count, 1)
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

    // MARK: - Tab assignment

    func testTabAssignment_PendingIsActive() {
        let dto = makeBid(id: "x", status: "pending")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.active)
    }

    func testTabAssignment_CounteredIsActive() {
        let dto = makeBid(id: "x", status: "countered")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.active)
    }

    func testTabAssignment_AcceptedIsAccepted() {
        let dto = makeBid(id: "x", status: "accepted")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.accepted)
    }

    func testTabAssignment_AssignedAlsoAccepted() {
        let dto = makeBid(id: "x", status: "assigned")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.accepted)
    }

    func testTabAssignment_AcceptedAndGigCompletedIsDone() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "completed")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.done)
    }

    func testTabAssignment_RejectedIsRejected() {
        let dto = makeBid(id: "x", status: "rejected")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.rejected)
    }

    func testTabAssignment_WithdrawnIsRejected() {
        let dto = makeBid(id: "x", status: "withdrawn")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.rejected)
    }

    func testTabAssignment_ExpiredIsRejected() {
        let dto = makeBid(id: "x", status: "expired")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.rejected)
    }

    func testTabAssignment_CancelledGigPushesToRejected() {
        let dto = makeBid(id: "x", status: "pending", gigStatus: "cancelled")
        XCTAssertEqual(MyBidsViewModel.tabFor(dto: dto, now: Self.fixedNow), MyBidsTab.rejected)
    }

    // MARK: - Chip derivation

    func testChip_PendingFallsBackToPending() {
        let dto = makeBid(id: "x", status: "pending", createdAt: isoDays(ago: 3))
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .pending
        )
    }

    func testChip_PendingNearExpiryIsExpiringWithHoursLeft() {
        let dto = makeBid(
            id: "x",
            status: "pending",
            createdAt: isoMinutes(ago: 30),
            expiresAt: isoMinutes(ahead: 90)
        )
        let chip = MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow)
        if case let .expiring(hours) = chip {
            XCTAssertEqual(hours, 2)
        } else {
            XCTFail("Expected .expiring(2), got \(chip)")
        }
    }

    func testChip_ShortlistedFlagWins() {
        let dto = makeBid(
            id: "x",
            status: "pending",
            createdAt: isoDays(ago: 1),
            shortlisted: true
        )
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .shortlisted
        )
    }

    func testChip_YourRankOneIsTopBid() {
        let dto = makeBid(
            id: "x",
            status: "pending",
            createdAt: isoDays(ago: 1),
            yourRank: 1
        )
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .topBid
        )
    }

    func testChip_YourRankGreaterThanOneWithTopPriceIsOutbid() {
        let dto = makeBid(
            id: "x",
            status: "pending",
            createdAt: isoDays(ago: 1),
            yourRank: 3,
            topPrice: 80
        )
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .outbid
        )
    }

    func testChip_AcceptedWithFutureProposedIsScheduled() {
        let dto = makeBid(
            id: "x",
            status: "accepted",
            createdAt: isoDays(ago: 5),
            proposedTime: isoDays(ahead: 2)
        )
        guard case let .scheduled(weekday) = MyBidsViewModel.derivedStatus(
            for: dto,
            now: Self.fixedNow
        ) else {
            XCTFail("Expected .scheduled, got something else")
            return
        }
        XCTAssertFalse(weekday.isEmpty)
    }

    func testChip_AcceptedNoProposedIsAccepted() {
        let dto = makeBid(id: "x", status: "accepted", createdAt: isoDays(ago: 5))
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .accepted
        )
    }

    func testChip_RejectedMapsToNotSelected() {
        let dto = makeBid(id: "x", status: "rejected")
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .notSelected
        )
    }

    func testChip_CancelledGigMapsToTaskCancelled() {
        let dto = makeBid(id: "x", status: "pending", gigStatus: "cancelled")
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .taskCancelled
        )
    }

    func testChip_AcceptedAndCompletedGigPromptsLeaveReview() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "completed")
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .leaveReview
        )
    }

    // MARK: - Footer derivation

    func testFooter_ActiveBidsGetEditFooter() {
        let dto = makeBid(id: "x", status: "pending", createdAt: isoDays(ago: 1))
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.active,
                status: .pending
            ),
            .edit
        )
    }

    func testFooter_AcceptedNotInProgressGetsMessageFooter() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "assigned")
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.accepted,
                status: .accepted
            ),
            .message
        )
    }

    func testFooter_AcceptedInProgressGetsCompleteFooter() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "in_progress")
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.accepted,
                status: .accepted
            ),
            .complete
        )
    }

    func testFooter_RejectedTabGetsRebidFooter() {
        let dto = makeBid(id: "x", status: "rejected")
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.rejected,
                status: .notSelected
            ),
            .rebid
        )
    }

    func testFooter_DoneWithLeaveReviewGetsReviewFooter() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "completed")
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.done,
                status: .leaveReview
            ),
            .review(firstName: "")
        )
    }

    func testFooter_DonePaidGetsNoFooter() {
        let dto = makeBid(id: "x", status: "accepted", gigStatus: "completed")
        XCTAssertEqual(
            MyBidsViewModel.footerFor(
                dto: dto,
                tab: MyBidsTab.done,
                status: .paid(amount: "$95")
            ),
            .none
        )
    }

    // MARK: - Highlight (muted)

    func testHighlight_MutedOnNotSelectedRows() {
        let proj = MyBidsViewModel.BidProjection(
            dto: makeBid(id: "x", status: "rejected"),
            tab: MyBidsTab.rejected,
            status: .notSelected,
            footer: .rebid
        )
        XCTAssertEqual(MyBidsViewModel.highlight(for: proj), .muted)
    }

    func testHighlight_NoneOnPendingRows() {
        let proj = MyBidsViewModel.BidProjection(
            dto: makeBid(id: "x", status: "pending"),
            tab: MyBidsTab.active,
            status: .pending,
            footer: .edit
        )
        XCTAssertNil(MyBidsViewModel.highlight(for: proj))
    }

    // MARK: - Row mapping

    func testRow_MapsCategoryGradientLeadingAndPriceStack() {
        let dto = makeBid(
            id: "row",
            status: "pending",
            createdAt: isoDays(ago: 1),
            bidAmount: 95,
            askingPrice: 120,
            category: "handyman"
        )
        let proj = MyBidsViewModel.BidProjection(
            dto: dto,
            tab: MyBidsTab.active,
            status: .pending,
            footer: .edit
        )
        let row = MyBidsViewModel.row(
            projection: proj,
            now: Self.fixedNow,
            callbacks: MyBidsViewModel.RowCallbacks()
        )
        // Leading: category gradient icon (hammer for handyman).
        if case let .categoryGradientIcon(icon, _) = row.leading {
            XCTAssertEqual(icon, .hammer)
        } else {
            XCTFail("Expected categoryGradientIcon leading")
        }
        // Trailing: price stack with budget sublabel.
        if case let .priceStack(amount, sublabel) = row.trailing {
            XCTAssertEqual(amount, "$95")
            XCTAssertEqual(sublabel, "budget $120")
        } else {
            XCTFail("Expected priceStack trailing")
        }
        XCTAssertEqual(row.chips?.first?.text, "Pending")
        XCTAssertEqual(row.footer?.actions.count, 2)
        XCTAssertEqual(row.footer?.actions.first?.title, "Withdraw")
        XCTAssertEqual(row.footer?.actions.last?.title, "Edit bid")
    }

    // MARK: - Tabs + banner

    func testBanner_OnActiveTabSummarisesLeadingAndClosingSoon() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[
              {"id":"top","gig_id":"g","user_id":"u","bid_amount":95,"status":"pending",
               "your_rank":1,"created_at":"2026-05-14T09:00:00Z",
               "gig":{"id":"g","title":"TV mount","price":120,"category":"handyman",
                      "status":"open","user_id":"u_owner"}},
              {"id":"soon","gig_id":"g2","user_id":"u","bid_amount":40,"status":"pending",
               "created_at":"2026-05-14T09:00:00Z",
               "expires_at":"2026-05-15T22:00:00Z",
               "gig":{"id":"g2","title":"Faucet","price":50,"category":"handyman",
                      "status":"open","user_id":"u_owner"}}
            ],"total":2}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let banner = vm.banner
        XCTAssertNotNil(banner)
        XCTAssertTrue(banner?.title.contains("Leading on 1") ?? false)
        XCTAssertTrue(banner?.subtitle?.contains("1 closing") ?? false)
    }

    func testBanner_HiddenOnNonActiveTabs() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[{"id":"a","gig_id":"g","user_id":"u","bid_amount":50,
                     "status":"pending","created_at":"2026-05-14T09:00:00Z",
                     "gig":{"id":"g","title":"t","price":60,"category":"handyman",
                            "status":"open","user_id":"u"}}],"total":1}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertNotNil(vm.banner)
        vm.selectedTab = MyBidsTab.rejected
        XCTAssertNil(vm.banner)
    }

    // MARK: - Tabs exposed

    func testTabsExposeFourTabsInDesignOrder() {
        let vm = makeVM()
        XCTAssertEqual(vm.tabs.count, 4)
        XCTAssertEqual(vm.tabs[0].id, MyBidsTab.active)
        XCTAssertEqual(vm.tabs[0].label, "Active")
        XCTAssertEqual(vm.tabs[1].id, MyBidsTab.accepted)
        XCTAssertEqual(vm.tabs[1].label, "Accepted")
        XCTAssertEqual(vm.tabs[2].id, MyBidsTab.rejected)
        XCTAssertEqual(vm.tabs[2].label, "Rejected")
        XCTAssertEqual(vm.tabs[3].id, MyBidsTab.done)
        XCTAssertEqual(vm.tabs[3].label, "Done")
    }

    func testFAB_IsExtendedNavBrowseTasks() {
        let vm = makeVM()
        XCTAssertNotNil(vm.fab)
        if case let .extendedNav(label) = vm.fab?.variant {
            XCTAssertEqual(label, "Browse tasks")
        } else {
            XCTFail("Expected extendedNav FAB variant")
        }
    }

    // MARK: - Optimistic withdraw

    func testWithdraw_OptimisticallyRemovesRowFromActive() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[{"id":"w1","gig_id":"g","user_id":"u","bid_amount":50,
                     "status":"pending","created_at":"2026-05-14T09:00:00Z",
                     "gig":{"id":"g","title":"t","price":60,"category":"handyman",
                            "status":"open","user_id":"u"}}],"total":1}
            """),
            .status(200, body: """
            {"message":"Bid withdrawn successfully",
             "rebid_available_at":"2026-05-15T12:05:00Z"}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs[0].count, 1) // Active = 1

        let bid = BidDTO(
            id: "w1",
            gigId: "g",
            userId: "u",
            bidAmount: 50,
            status: "pending",
            gig: BidGigDTO(
                id: "g",
                title: "t",
                description: nil,
                price: 60,
                category: "handyman",
                status: "open",
                userId: "u"
            )
        )
        vm.requestWithdraw(bid)
        XCTAssertNotNil(vm.withdrawTarget)
        await vm.confirmWithdraw(reason: .scheduleConflict)
        XCTAssertNil(vm.withdrawTarget)
        // Row left Active, landed on Rejected (optimistic + server agreed).
        XCTAssertEqual(vm.tabs[0].count, 0)
        XCTAssertEqual(vm.tabs[2].count, 1)
    }

    func testWithdraw_RollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[{"id":"w2","gig_id":"g","user_id":"u","bid_amount":50,
                     "status":"pending","created_at":"2026-05-14T09:00:00Z",
                     "gig":{"id":"g","title":"t","price":60,"category":"handyman",
                            "status":"open","user_id":"u"}}],"total":1}
            """),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        let bid = BidDTO(
            id: "w2",
            gigId: "g",
            userId: "u",
            bidAmount: 50,
            status: "pending",
            gig: BidGigDTO(
                id: "g",
                title: "t",
                description: nil,
                price: 60,
                category: "handyman",
                status: "open",
                userId: "u"
            )
        )
        vm.requestWithdraw(bid)
        await vm.confirmWithdraw(reason: nil)
        // Rolled back — still 1 row in Active.
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[2].count, 0)
    }

    // MARK: - Edit bid sheet

    func testRequestEditBid_SetsTargetWithPrefilledValues() {
        let bid = makeBid(
            id: "e1",
            status: "pending",
            bidAmount: 95,
            category: "handyman"
        )
        let bidWithMessage = BidDTO(
            id: bid.id,
            gigId: bid.gigId,
            userId: bid.userId,
            bidAmount: bid.bidAmount,
            message: "Old message",
            proposedTime: "Saturday afternoon",
            status: bid.status,
            createdAt: bid.createdAt,
            updatedAt: nil,
            expiresAt: nil,
            counterAmount: nil,
            counterStatus: nil,
            counteredAt: nil,
            withdrawnAt: nil,
            withdrawalReason: nil,
            gig: bid.gig,
            bidder: nil,
            shortlisted: nil,
            yourRank: nil,
            topPrice: nil
        )
        let vm = makeVM()
        vm.requestEditBid(bidWithMessage)
        XCTAssertNotNil(vm.editBidTarget)
        XCTAssertEqual(vm.editBidTarget?.gigId, bidWithMessage.gigId)
        XCTAssertEqual(vm.editBidTarget?.bidId, bidWithMessage.id)
        XCTAssertEqual(vm.editBidTarget?.initialAmount, 95)
        XCTAssertEqual(vm.editBidTarget?.initialMessage, "Old message")
        XCTAssertEqual(vm.editBidTarget?.initialProposedTime, "Saturday afternoon")
        XCTAssertNil(vm.editBidTarget?.initialTerms)
    }

    func testCancelEditBid_ClearsTarget() {
        let bid = makeBid(id: "e2")
        let vm = makeVM()
        vm.requestEditBid(bid)
        XCTAssertNotNil(vm.editBidTarget)
        vm.cancelEditBid()
        XCTAssertNil(vm.editBidTarget)
    }

    func testSubmitEditBid_HitsUpdateEndpointAndUpdatesRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[{"id":"e3","gig_id":"g","user_id":"u","bid_amount":50,
                     "status":"pending","created_at":"2026-05-14T09:00:00Z",
                     "gig":{"id":"g","title":"t","price":80,"category":"handyman",
                            "status":"open","user_id":"u_owner"}}],"total":1}
            """),
            .status(200, body: """
            {"id":"e3","gig_id":"g","user_id":"u","bid_amount":75,
             "status":"pending","created_at":"2026-05-14T09:00:00Z"}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let bid = BidDTO(
            id: "e3",
            gigId: "g",
            userId: "u",
            bidAmount: 50,
            status: "pending",
            gig: BidGigDTO(
                id: "g",
                title: "t",
                description: nil,
                price: 80,
                category: "handyman",
                status: "open",
                userId: "u_owner"
            )
        )
        vm.requestEditBid(bid)
        let ok = await vm.submitEditBid(EditBidDraft(amount: 75, message: "Updated", proposedTime: nil))
        XCTAssertTrue(ok)
        XCTAssertNil(vm.editBidTarget)
        XCTAssertEqual(vm.toast?.kind, .success)
        // Row reflects the new amount.
        if case let .loaded(sections, _) = vm.state,
           case let .priceStack(amount, _) = sections.first?.rows.first?.trailing {
            XCTAssertEqual(amount, "$75")
        } else {
            XCTFail("Expected loaded state with updated row amount")
        }
    }

    func testSubmitEditBid_ReportsErrorOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bids":[{"id":"e4","gig_id":"g","user_id":"u","bid_amount":50,
                     "status":"pending","created_at":"2026-05-14T09:00:00Z",
                     "gig":{"id":"g","title":"t","price":80,"category":"handyman",
                            "status":"open","user_id":"u_owner"}}],"total":1}
            """),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        let bid = BidDTO(id: "e4", gigId: "g", status: "pending")
        vm.requestEditBid(bid)
        let ok = await vm.submitEditBid(EditBidDraft(amount: 75, message: nil, proposedTime: nil))
        XCTAssertFalse(ok)
        // Sheet target stays so the user can retry.
        XCTAssertNotNil(vm.editBidTarget)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testRequestEditBid_PrefillsTermsWhenSeparated() {
        let bid = BidDTO(
            id: "et",
            gigId: "g",
            userId: "u",
            bidAmount: 50,
            message: "Hi there\n\nTerms: 50% deposit upfront",
            proposedTime: nil,
            status: "pending",
            gig: BidGigDTO(
                id: "g",
                title: "t",
                description: nil,
                price: 80,
                category: "handyman",
                status: "open",
                userId: "u_owner"
            )
        )
        let vm = makeVM()
        vm.requestEditBid(bid)
        XCTAssertEqual(vm.editBidTarget?.initialMessage, "Hi there")
        XCTAssertEqual(vm.editBidTarget?.initialTerms, "50% deposit upfront")
    }

    // MARK: - Leave review sheet

    func testRequestLeaveReview_SetsTargetWithGigPosterAsReviewee() {
        let bid = makeBid(id: "r1", status: "accepted", gigStatus: "completed")
        let vm = makeVM()
        vm.requestLeaveReview(bid)
        XCTAssertNotNil(vm.leaveReviewTarget)
        XCTAssertEqual(vm.leaveReviewTarget?.gigId, bid.gigId)
        XCTAssertEqual(vm.leaveReviewTarget?.revieweeId, "u_owner")
    }

    func testRequestLeaveReview_DoesNothingWhenGigPosterMissing() {
        let bid = BidDTO(
            id: "r2",
            gigId: "g_r2",
            userId: "u",
            bidAmount: 50,
            status: "accepted",
            gig: BidGigDTO(
                id: "g_r2",
                title: "t",
                description: nil,
                price: 80,
                category: "handyman",
                status: "completed",
                userId: nil
            )
        )
        let vm = makeVM()
        vm.requestLeaveReview(bid)
        XCTAssertNil(vm.leaveReviewTarget)
    }

    func testCancelLeaveReview_ClearsTarget() {
        let bid = makeBid(id: "r3", status: "accepted", gigStatus: "completed")
        let vm = makeVM()
        vm.requestLeaveReview(bid)
        XCTAssertNotNil(vm.leaveReviewTarget)
        vm.cancelLeaveReview()
        XCTAssertNil(vm.leaveReviewTarget)
    }

    func testSubmitLeaveReview_HitsCreateEndpointAndFlashesSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: "{\"id\":\"rv1\"}")
        ]
        let vm = makeVM()
        let bid = makeBid(id: "r4", status: "accepted", gigStatus: "completed")
        vm.requestLeaveReview(bid)
        let ok = await vm.submitLeaveReview(LeaveReviewDraft(rating: 5, comment: "Great!"))
        XCTAssertTrue(ok)
        XCTAssertNil(vm.leaveReviewTarget)
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSubmitLeaveReview_ReportsErrorOnFailure() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        let bid = makeBid(id: "r5", status: "accepted", gigStatus: "completed")
        vm.requestLeaveReview(bid)
        let ok = await vm.submitLeaveReview(LeaveReviewDraft(rating: 4, comment: nil))
        XCTAssertFalse(ok)
        XCTAssertNotNil(vm.leaveReviewTarget)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Message / terms composition

    func testComposeMessage_BothEmptyReturnsNil() {
        XCTAssertNil(EditBidSheetView.composeMessage(message: "", terms: ""))
    }

    func testComposeMessage_OnlyMessageReturnsMessage() {
        XCTAssertEqual(
            EditBidSheetView.composeMessage(message: "Hello", terms: ""),
            "Hello"
        )
    }

    func testComposeMessage_OnlyTermsReturnsPrefixedString() {
        XCTAssertEqual(
            EditBidSheetView.composeMessage(message: "", terms: "Deposit upfront"),
            "Terms: Deposit upfront"
        )
    }

    func testComposeMessage_BothJoinsWithSeparator() {
        XCTAssertEqual(
            EditBidSheetView.composeMessage(message: "Hello", terms: "Deposit upfront"),
            "Hello\n\nTerms: Deposit upfront"
        )
    }

    func testSplitMessageAndTerms_NoMarkerReturnsMessageOnly() {
        let parts = MyBidsViewModel.splitMessageAndTerms("Just a message")
        XCTAssertEqual(parts.message, "Just a message")
        XCTAssertNil(parts.terms)
    }

    func testSplitMessageAndTerms_TermsOnlyReturnsTermsOnly() {
        let parts = MyBidsViewModel.splitMessageAndTerms("Terms: Deposit upfront")
        XCTAssertNil(parts.message)
        XCTAssertEqual(parts.terms, "Deposit upfront")
    }

    func testSplitMessageAndTerms_BothSplitsCorrectly() {
        let parts = MyBidsViewModel.splitMessageAndTerms("Hello\n\nTerms: Deposit upfront")
        XCTAssertEqual(parts.message, "Hello")
        XCTAssertEqual(parts.terms, "Deposit upfront")
    }

    func testSplitMessageAndTerms_NilReturnsAllNil() {
        let parts = MyBidsViewModel.splitMessageAndTerms(nil)
        XCTAssertNil(parts.message)
        XCTAssertNil(parts.terms)
    }

    // MARK: - Counter response (Phase 5)

    func testChip_CounteredPendingShowsCounterAmount() {
        let dto = makeBid(id: "x", status: "countered", counterAmount: 80, counterStatus: "pending")
        XCTAssertEqual(
            MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .countered(amount: "$80")
        )
    }

    func testChip_CounteredResolvedFallsBackToPending() {
        let dto = makeBid(id: "x", status: "countered", counterAmount: 80, counterStatus: "declined")
        XCTAssertEqual(MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow), .pending)
    }

    func testFooter_CounteredGetsAcceptDeclineActions() {
        let dto = makeBid(id: "c1", status: "countered", counterAmount: 80, counterStatus: "pending")
        let status = MyBidsViewModel.derivedStatus(for: dto, now: Self.fixedNow)
        let footer = MyBidsViewModel.footerFor(dto: dto, tab: MyBidsTab.active, status: status)
        XCTAssertEqual(footer, .counter(amount: "$80"))
        let row = MyBidsViewModel.row(
            projection: MyBidsViewModel.BidProjection(dto: dto, tab: MyBidsTab.active, status: status, footer: footer),
            now: Self.fixedNow,
            callbacks: MyBidsViewModel.RowCallbacks()
        )
        XCTAssertEqual(row.footer?.actions.map(\.title), ["Decline counter", "Accept $80"])
        XCTAssertEqual(
            row.footer?.actions.map(\.identifier),
            ["myBids.counter_c1.decline", "myBids.counter_c1.accept"]
        )
    }

    private static let counteredBidsJSON = """
    {"bids":[{"id":"c1","gig_id":"g_c1","user_id":"u","bid_amount":100,"status":"countered",
              "counter_amount":80,"counter_status":"pending","created_at":"2026-05-14T09:00:00Z",
              "gig":{"id":"g_c1","title":"TV mount","price":120,"category":"handyman",
                     "status":"open","user_id":"u_owner"}}],"total":1}
    """

    func testAcceptCounter_PostsEndpointAndAdoptsCounterAmount() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.counteredBidsJSON),
            .status(200, body: #"{"bid":{"id":"c1","status":"pending","bid_amount":80}}"#)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.acceptCounter(makeBid(id: "c1", status: "countered", counterAmount: 80, counterStatus: "pending"))
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.url?.path, "/api/gigs/g_c1/bids/c1/counter/accept")
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertTrue(vm.toast?.text.contains("$80") ?? false)
        // Row settles back to a plain pending bid at the counter amount.
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected .loaded") }
        let row = sections.first?.rows.first
        XCTAssertEqual(row?.chips?.first?.text, "Pending")
        if case let .priceStack(amount, _)? = row?.trailing {
            XCTAssertEqual(amount, "$80")
        } else {
            XCTFail("Expected priceStack trailing")
        }
    }

    func testDeclineCounter_PostsEndpointAndKeepsOriginalAmount() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.counteredBidsJSON),
            .status(200, body: #"{"bid":{"id":"c1","status":"pending","bid_amount":100}}"#)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.declineCounter(makeBid(id: "c1", status: "countered", counterAmount: 80, counterStatus: "pending"))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs/g_c1/bids/c1/counter/decline")
        XCTAssertEqual(vm.toast?.kind, .success)
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected .loaded") }
        let row = sections.first?.rows.first
        if case let .priceStack(amount, _)? = row?.trailing {
            XCTAssertEqual(amount, "$100", "Decline keeps the original bid amount.")
        } else {
            XCTFail("Expected priceStack trailing")
        }
    }

    func testAcceptCounter_RollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.counteredBidsJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.acceptCounter(makeBid(id: "c1", status: "countered", counterAmount: 80, counterStatus: "pending"))
        XCTAssertEqual(vm.toast?.kind, .error)
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected .loaded") }
        XCTAssertEqual(
            sections.first?.rows.first?.chips?.first?.text,
            "Countered $80",
            "Failed POST restores the countered row."
        )
    }

    // MARK: - Test fixtures

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private func isoMinutes(ago minutes: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(-Double(minutes) * 60))
    }

    private func isoMinutes(ahead minutes: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(Double(minutes) * 60))
    }

    private func isoDays(ago days: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(-Double(days) * 24 * 3600))
    }

    private func isoDays(ahead days: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(Double(days) * 24 * 3600))
    }

    private func makeBid(
        id: String,
        status: String? = "pending",
        gigStatus: String = "open",
        createdAt: String? = nil,
        expiresAt: String? = nil,
        proposedTime: String? = nil,
        bidAmount: Double? = 100,
        askingPrice: Double? = 120,
        category: String? = "handyman",
        shortlisted: Bool? = nil,
        yourRank: Int? = nil,
        topPrice: Double? = nil,
        counterAmount: Double? = nil,
        counterStatus: String? = nil
    ) -> BidDTO {
        BidDTO(
            id: id,
            gigId: "g_\(id)",
            userId: "u",
            bidAmount: bidAmount,
            message: nil,
            proposedTime: proposedTime,
            status: status,
            createdAt: createdAt,
            updatedAt: nil,
            expiresAt: expiresAt,
            counterAmount: counterAmount,
            counterStatus: counterStatus,
            counteredAt: nil,
            withdrawnAt: nil,
            withdrawalReason: nil,
            gig: BidGigDTO(
                id: "g_\(id)",
                title: "Gig title",
                description: nil,
                price: askingPrice,
                category: category,
                status: gigStatus,
                userId: "u_owner"
            ),
            bidder: nil,
            shortlisted: shortlisted,
            yourRank: yourRank,
            topPrice: topPrice
        )
    }
}
