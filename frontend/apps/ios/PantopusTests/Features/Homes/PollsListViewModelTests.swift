//
//  PollsListViewModelTests.swift
//  PantopusTests
//
//  Covers the Polls VM (T6.3e / P13):
//    - four-state transitions (loading / empty / loaded / error)
//    - 3-state chip derivation (active / closing / closed)
//    - kind classification (decision / schedule / yesno / open)
//    - "Leading: <option>" chip derivation from `option_counts`
//    - "Voted: <option>" chip when `my_vote` is set
//    - tab filtering across active / closed
//    - banner summary (awaiting-vote count)
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class PollsListViewModelTests: XCTestCase {
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

    /// 2026-05-15T12:00:00Z fixed clock.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(viewerId: String? = nil, api: APIClient? = nil) -> PollsListViewModel {
        let frozen = Self.fixedNow
        return PollsListViewModel(
            homeId: "home-1",
            viewerId: viewerId,
            api: api ?? makeAPI()
        ) { frozen }
    }

    private func makePoll(
        id: String = "p",
        title: String = "Paint color?",
        pollType: String = "single_choice",
        options: [PollOptionDTO] = [
            PollOptionDTO(id: "sage", label: "Sage"),
            PollOptionDTO(id: "white", label: "White"),
            PollOptionDTO(id: "navy", label: "Navy")
        ],
        status: String = "open",
        closesAt: String? = "2026-05-20T12:00:00Z",
        voteCount: Int = 0,
        optionCounts: [String: Int] = [:],
        myVote: [String]? = nil
    ) -> PollDTO {
        PollDTO(
            id: id,
            homeId: "home-1",
            title: title,
            pollType: pollType,
            options: options,
            status: status,
            closesAt: closesAt,
            voteCount: voteCount,
            optionCounts: optionCounts,
            myVote: myVote
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"polls\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No active polls")
        XCTAssertEqual(content.ctaTitle, "Start a poll")
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedResponseMapsActivePollToRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"polls":[
              {"id":"p1","home_id":"h","title":"Paint color?","poll_type":"single_choice",
               "options":[{"id":"sage","label":"Sage"},{"id":"white","label":"White"}],
               "status":"open","closes_at":"2026-05-20T12:00:00Z",
               "vote_count":2,"option_counts":{"sage":2,"white":0},"my_vote":["sage"]}
            ]}
            """)
        ]
        let vm = makeVM(viewerId: "viewer-1")
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections[0].rows.count, 1)
        let row = sections[0].rows[0]
        XCTAssertEqual(row.id, "p1")
        XCTAssertEqual(row.title, "Paint color?")
        XCTAssertEqual(row.subtitle, "2 votes · 2 options")
        guard case .chevron = row.trailing else {
            XCTFail("Expected chevron trailing")
            return
        }
        guard case let .typeIcon(icon, background: _, foreground: _) = row.leading else {
            XCTFail("Expected typeIcon leading")
            return
        }
        XCTAssertEqual(icon, .clipboardList)
        // chip strip: status chip + leading chip + voted chip
        let chips = row.chips ?? []
        XCTAssertGreaterThanOrEqual(chips.count, 3)
        XCTAssertEqual(chips[0].text, "Active")
        XCTAssertTrue(chips.contains { $0.text.starts(with: "Leading: Sage") })
        XCTAssertTrue(chips.contains { $0.text == "Voted: Sage" })
    }

    // MARK: - Chip status derivation

    func testChipStatusClosedWhenStatusClosed() {
        let poll = makePoll(status: "closed")
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .closed)
    }

    func testChipStatusClosedWhenStatusCanceled() {
        let poll = makePoll(status: "canceled")
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .closed)
    }

    func testChipStatusClosedWhenClosesAtIsPast() {
        let poll = makePoll(status: "open", closesAt: "2026-05-14T00:00:00Z")
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .closed)
    }

    func testChipStatusClosingWhenClosesAtWithin24h() {
        let poll = makePoll(status: "open", closesAt: "2026-05-15T20:00:00Z")
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .closing)
    }

    func testChipStatusActiveWhenClosesAtBeyond24h() {
        let poll = makePoll(status: "open", closesAt: "2026-05-20T12:00:00Z")
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .active)
    }

    func testChipStatusActiveWhenNoCloseDate() {
        let poll = makePoll(status: "open", closesAt: nil)
        XCTAssertEqual(PollsListViewModel.chipStatus(for: poll, now: Self.fixedNow), .active)
    }

    // MARK: - Kind classification

    func testKindFromYesNo() {
        XCTAssertEqual(PollKind.from(pollType: "yes_no", title: "Replace dishwasher?"), .yesno)
    }

    func testKindFromMultipleChoice() {
        XCTAssertEqual(PollKind.from(pollType: "multiple_choice", title: "Movie picks"), .open)
    }

    func testKindFromRanking() {
        XCTAssertEqual(PollKind.from(pollType: "ranking", title: "Rank vendors"), .decision)
    }

    func testKindFromSingleChoiceDefaultsToDecision() {
        XCTAssertEqual(PollKind.from(pollType: "single_choice", title: "Paint color?"), .decision)
    }

    func testKindUpgradesSingleChoiceToScheduleWhenWeekendKeyword() {
        XCTAssertEqual(PollKind.from(pollType: "single_choice", title: "Garage sale this weekend — Sat or Sun?"), .schedule)
    }

    func testKindUpgradesSingleChoiceToScheduleWhenSaturdayKeyword() {
        XCTAssertEqual(PollKind.from(pollType: "single_choice", title: "Saturday or Sunday?"), .schedule)
    }

    // MARK: - Projection details

    func testProjectionEmitsLeadingChipWhenOptionCountsPresent() {
        let poll = makePoll(
            voteCount: 3,
            optionCounts: ["sage": 2, "white": 1, "navy": 0]
        )
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertNotNil(projection.leadingChip)
        XCTAssertEqual(projection.leadingChip?.text, "Leading: Sage · 2 votes")
    }

    func testProjectionEmitsWinnerChipWhenClosed() {
        let poll = makePoll(
            status: "closed",
            voteCount: 3,
            optionCounts: ["sage": 2, "white": 1]
        )
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertEqual(projection.leadingChip?.text, "Winner: Sage · 2 votes")
        XCTAssertEqual(projection.chipText, "Closed")
    }

    func testProjectionOmitsLeadingChipWhenNoVotes() {
        let poll = makePoll(voteCount: 0, optionCounts: [:])
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertNil(projection.leadingChip)
    }

    func testProjectionEmitsVotedChipWhenViewerVoted() {
        let poll = makePoll(myVote: ["white"])
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertEqual(projection.votedChip?.text, "Voted: White")
    }

    func testProjectionOmitsVotedChipWhenNoVote() {
        let poll = makePoll(myVote: nil)
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertNil(projection.votedChip)
    }

    func testProjectionTimeMetaUsesHoursWhenClosing() {
        let poll = makePoll(status: "open", closesAt: "2026-05-15T21:00:00Z")
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertEqual(projection.chipStatus, .closing)
        XCTAssertEqual(projection.timeMeta, "Closes in 9 hr")
    }

    func testProjectionTimeMetaUsesDateWhenActive() {
        let poll = makePoll(status: "open", closesAt: "2026-05-19T12:00:00Z")
        let projection = PollsListViewModel.project(poll: poll, now: Self.fixedNow)
        XCTAssertEqual(projection.chipStatus, .active)
        XCTAssertEqual(projection.timeMeta, "Closes May 19")
    }

    // MARK: - Tab filtering

    func testActiveTabExcludesClosedPolls() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"polls":[
              {"id":"a","home_id":"h","title":"Active","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"},{"id":"n","label":"No"}],
               "status":"open","closes_at":"2026-06-01T00:00:00Z","vote_count":0},
              {"id":"c","home_id":"h","title":"Closed","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"},{"id":"n","label":"No"}],
               "status":"closed","closes_at":"2026-05-10T00:00:00Z","vote_count":0}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertEqual(sections[0].rows.count, 1)
        XCTAssertEqual(sections[0].rows[0].id, "a")
    }

    func testClosedTabShowsOnlyClosedPolls() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"polls":[
              {"id":"a","home_id":"h","title":"Active","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"},{"id":"n","label":"No"}],
               "status":"open","closes_at":"2026-06-01T00:00:00Z","vote_count":0},
              {"id":"c","home_id":"h","title":"Closed","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"},{"id":"n","label":"No"}],
               "status":"closed","closes_at":"2026-05-10T00:00:00Z","vote_count":0}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = PollsTab.closed.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after tab switch")
            return
        }
        XCTAssertEqual(sections[0].rows.count, 1)
        XCTAssertEqual(sections[0].rows[0].id, "c")
    }

    func testTabsCountsReflectChipStatuses() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"polls":[
              {"id":"a","home_id":"h","title":"A","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"}],
               "status":"open","closes_at":"2026-06-01T00:00:00Z","vote_count":0},
              {"id":"b","home_id":"h","title":"B","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"}],
               "status":"open","closes_at":"2026-05-15T18:00:00Z","vote_count":0},
              {"id":"c","home_id":"h","title":"C","poll_type":"single_choice",
               "options":[{"id":"y","label":"Yes"}],
               "status":"closed","vote_count":0}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let counts = vm.tabs.reduce(into: [String: Int]()) { acc, tab in
            acc[tab.id] = tab.count ?? 0
        }
        XCTAssertEqual(counts[PollsTab.active.rawValue], 2)
        XCTAssertEqual(counts[PollsTab.closed.rawValue], 1)
    }

    // MARK: - Banner

    func testBannerCountsActivePollsAwaitingViewerVote() {
        let polls: [PollDTO] = [
            makePoll(id: "a", status: "open", myVote: nil),
            makePoll(id: "b", status: "open", myVote: ["sage"]),
            makePoll(id: "c", status: "closed", myVote: nil)
        ]
        let summary = PollsListViewModel.summarize(
            polls: polls,
            viewerId: "viewer-1",
            now: Self.fixedNow
        )
        XCTAssertEqual(summary.totalActive, 2)
        XCTAssertEqual(summary.awaitingViewerVote, 1)
    }

    func testBannerHasContentReturnsFalseWhenNoActivePolls() {
        let polls: [PollDTO] = [makePoll(id: "c", status: "closed")]
        let summary = PollsListViewModel.summarize(polls: polls, viewerId: nil, now: Self.fixedNow)
        XCTAssertFalse(summary.hasContent)
    }

    // MARK: - Optimistic vote

    func testApplyOptimisticVoteAddsCountWhenNoPriorVote() {
        let poll = makePoll(voteCount: 1, optionCounts: ["white": 1], myVote: nil)
        let updated = PollDetailViewModel.applyOptimisticVote(poll: poll, optionId: "sage")
        XCTAssertEqual(updated.voteCount, 2)
        XCTAssertEqual(updated.optionCounts["sage"], 1)
        XCTAssertEqual(updated.optionCounts["white"], 1)
        XCTAssertEqual(updated.myVote, ["sage"])
    }

    func testApplyOptimisticVoteSwitchesCountWhenChangingVote() {
        let poll = makePoll(voteCount: 2, optionCounts: ["sage": 1, "white": 1], myVote: ["white"])
        let updated = PollDetailViewModel.applyOptimisticVote(poll: poll, optionId: "sage")
        XCTAssertEqual(updated.voteCount, 2)
        XCTAssertEqual(updated.optionCounts["sage"], 2)
        XCTAssertNil(updated.optionCounts["white"])
        XCTAssertEqual(updated.myVote, ["sage"])
    }

    // MARK: - FAB

    func testFabIsSecondaryCreateWithHomeTint() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"polls\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.accessibilityLabel, "Start a poll")
        XCTAssertEqual(fab.tint, .home)
        if case .secondaryCreate = fab.variant {} else {
            XCTFail("Expected secondaryCreate variant, got \(fab.variant)")
        }
    }

    // MARK: - Top bar

    func testTopBarActionIsNilByDesign() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction)
    }
}
