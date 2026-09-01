//
//  PollResponseViewModelTests.swift
//  PantopusTests
//
//  Stream I11 — F6 Find a Time · Member Poll Response view-model. Verifies the
//  public poll loads into votable options, a closed poll renders its outcome
//  (not an error), submitting posts the votes, and a `POLL_CLOSED` race flips to
//  the closed state.
//

import XCTest
@testable import Pantopus

@MainActor
final class PollResponseViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> PollResponseViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return PollResponseViewModel(
            pollId: "poll1",
            tz: "America/New_York",
            voterName: "Maria",
            voterEmail: "maria@example.com",
            client: client
        )
    }

    private func pollBody(status: String = "open", finalized: String? = nil) -> String {
        let finalizedField = finalized.map { ",\"finalized_start_at\":\"\($0)\"" } ?? ""
        return """
        {"poll":{"id":"poll1","title":"Family call","duration_min":30,"status":"\(status)"\(finalizedField)},
         "options":[
           {"id":"opt1","start_at":"2030-07-01T16:00:00Z","end_at":"2030-07-01T16:30:00Z"},
           {"id":"opt2","start_at":"2030-07-02T18:00:00Z","end_at":"2030-07-02T18:30:00Z"}
         ],"votes":[]}
        """
    }

    func testLoadOpenPoll() async {
        SequencedURLProtocol.sequence = [.status(200, body: pollBody())]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.title, "Family call")
        XCTAssertEqual(viewModel.options.count, 2)
        XCTAssertFalse(viewModel.allAnswered)
    }

    func testClosedPollRendersOutcome() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: pollBody(status: "closed", finalized: "2030-07-01T16:00:00Z"))
        ]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .closed)
        XCTAssertNotNil(viewModel.finalizedLabel)
    }

    func testSubmitPostsVotes() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: pollBody()),
            .status(200, body: #"{"ok":true}"#)
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.setVote(.works, for: viewModel.options[0])
        viewModel.setVote(.cant, for: viewModel.options[1])
        XCTAssertTrue(viewModel.allAnswered)
        await viewModel.submit()

        XCTAssertEqual(viewModel.phase, .submitted)
        let hit = SequencedURLProtocol.capturedRequests.contains { ($0.url?.path ?? "").contains("/poll/poll1/vote") }
        XCTAssertTrue(hit)
    }

    func testSubmitPollClosedFlipsToClosed() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: pollBody()),
            .status(409, body: #"{"error":"POLL_CLOSED"}"#)
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.setVote(.works, for: viewModel.options[0])
        viewModel.setVote(.ifNeeded, for: viewModel.options[1])
        await viewModel.submit()

        XCTAssertEqual(viewModel.phase, .closed)
    }
}
