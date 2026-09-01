//
//  FindATimeSuggestedViewModelTests.swift
//  PantopusTests
//
//  Stream I11 — F5 Find a Time · Suggested Slots view-model. Verifies precomputed
//  slots render without a refetch, a missing draft refetches the engine, empty
//  results map to no-overlap, and the Book / Send-proposal actions hit the home
//  event + poll endpoints.
//

import XCTest
@testable import Pantopus

@MainActor
final class FindATimeSuggestedViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(draft: FindATimeDraft?) -> FindATimeSuggestedViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return FindATimeSuggestedViewModel(
            homeId: "home1",
            tz: "America/New_York",
            draft: draft,
            push: { _ in },
            client: client
        )
    }

    private func members() -> [FindATimeMember] {
        [
            FindATimeMember(id: "u1", displayName: "Maria", initials: "MA"),
            FindATimeMember(id: "u2", displayName: "David", initials: "DA"),
            FindATimeMember(id: "u3", displayName: "Ava", initials: "AV")
        ]
    }

    private func allFreeSlot() -> SlotDTO {
        SlotDTO(
            start: "2030-07-01T16:00:00Z",
            end: "2030-07-01T16:30:00Z",
            startLocal: "2030-07-01T12:00:00",
            eligibleHosts: ["u1", "u2", "u3"]
        )
    }

    private func draft(precomputed: [SlotDTO]?) -> FindATimeDraft {
        let resolved = members()
        return FindATimeDraft(
            homeId: "home1",
            title: "Family call",
            members: resolved,
            requiredMemberIds: resolved.map(\.id),
            mode: .collective,
            durationMin: 30,
            from: "2030-07-01",
            to: "2030-07-07",
            tz: "America/New_York",
            precomputedSlots: precomputed
        )
    }

    func testPrecomputedSlotsRenderWithoutFetch() async {
        let viewModel = makeViewModel(draft: draft(precomputed: [allFreeSlot()]))
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.suggested.count, 1)
        XCTAssertTrue(viewModel.suggested[0].allFree)
        XCTAssertEqual(viewModel.suggested[0].coverageLabel, "All 3 free")
        XCTAssertTrue(viewModel.isSingleBest)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "precomputed slots must not refetch")
    }

    func testFetchesWhenNoPrecomputedSlots() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"slots":[\#(allFreeSlotJSON)]}"#)]
        let viewModel = makeViewModel(draft: draft(precomputed: nil))
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.suggested.count, 1)
        let hit = SequencedURLProtocol.capturedRequests.contains { ($0.url?.path ?? "").contains("/find-a-time") }
        XCTAssertTrue(hit)
    }

    func testEmptyResultsMapToNoOverlap() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"slots":[]}"#)]
        let viewModel = makeViewModel(draft: draft(precomputed: nil))
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .noOverlap)
        XCTAssertTrue(viewModel.suggested.isEmpty)
    }

    func testSendProposalCreatesPoll() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"poll":{"id":"poll1","title":"Family call","status":"open"},"options":[{"id":"opt1"}]}"#)
        ]
        let viewModel = makeViewModel(draft: draft(precomputed: [allFreeSlot()]))
        await viewModel.load()
        await viewModel.sendProposal()

        XCTAssertEqual(viewModel.phase, .sent)
        XCTAssertEqual(viewModel.createdPollId, "poll1")
        let hit = SequencedURLProtocol.capturedRequests.contains { ($0.url?.path ?? "").hasSuffix("/polls") }
        XCTAssertTrue(hit)
    }

    func testBookCreatesHomeEvent() async {
        // swiftlint:disable:next line_length
        let eventJSON = #"{"event":{"id":"e1","home_id":"home1","event_type":"family","title":"Family call","start_at":"2030-07-01T16:00:00Z"}}"#
        SequencedURLProtocol.sequence = [.status(200, body: eventJSON)]
        let viewModel = makeViewModel(draft: draft(precomputed: [allFreeSlot()]))
        await viewModel.load()
        await viewModel.book(viewModel.suggested[0])

        XCTAssertEqual(viewModel.phase, .booked)
        XCTAssertNotNil(viewModel.bookedLabel)
        let hit = SequencedURLProtocol.capturedRequests.contains { ($0.url?.path ?? "") == "/api/homes/home1/events" }
        XCTAssertTrue(hit, "Book must create a home calendar event")
    }

    // swiftlint:disable:next line_length
    private let allFreeSlotJSON = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00","eligibleHosts":["u1","u2","u3"]}"#
}
