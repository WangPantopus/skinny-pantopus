//
//  NudgeAndFollowUpViewModelTests.swift
//  PantopusTests
//
//  E11 Send Nudge + E7 Follow-up · Stream I9.
//

import XCTest
@testable import Pantopus

@MainActor
final class NudgeAndFollowUpViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
    }

    // MARK: E11 Send Nudge

    private func makeNudge(counts: NudgeAudienceCounts) -> SendNudgeViewModel {
        SendNudgeViewModel(
            owner: .personal,
            bookingId: "b1",
            eventTitle: "Group class",
            eventSubtitle: "Group class · Sat, Jun 14",
            counts: counts,
            client: makeClient()
        )
    }

    func testNudgeSendGating() {
        let viewModel = makeNudge(counts: NudgeAudienceCounts(all: 12, confirmed: 10, noShows: 0))
        XCTAssertFalse(viewModel.canSend) // empty message
        viewModel.message = "Reminder: class is tomorrow at 10 AM."
        XCTAssertTrue(viewModel.canSend)
        XCTAssertEqual(viewModel.ctaTitle, "Send to 12")

        // Over the character limit disables send.
        viewModel.message = String(repeating: "x", count: viewModel.characterLimit + 1)
        XCTAssertTrue(viewModel.isOverLimit)
        XCTAssertFalse(viewModel.canSend)

        // No recipients disables send.
        viewModel.message = "Hi"
        viewModel.select(.noShows)
        XCTAssertFalse(viewModel.hasRecipients)
        XCTAssertFalse(viewModel.canSend)
        XCTAssertEqual(viewModel.ctaTitle, "Send")
    }

    func testNudgeSendSuccess() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"ok":true}"#)]
        let viewModel = makeNudge(counts: NudgeAudienceCounts(all: 5, confirmed: 5, noShows: 0))
        viewModel.message = "See you tomorrow."
        await viewModel.send()
        XCTAssertTrue(viewModel.didSend)
        XCTAssertNil(viewModel.errorMessage)
    }

    func testNudgeSendErrorSurfacesMessage() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom","message":"Server boom"}"#)]
        let viewModel = makeNudge(counts: NudgeAudienceCounts(all: 5, confirmed: 5, noShows: 0))
        viewModel.message = "Hi"
        await viewModel.send()
        XCTAssertFalse(viewModel.didSend)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    // MARK: E7 Follow-up

    private func makeFollowUp() -> BookingFollowUpViewModel {
        BookingFollowUpViewModel(
            owner: .home(homeId: "h1"),
            bookingId: "b1",
            eventTypeId: "et1",
            inviteeName: "Mara",
            headerSubtitle: "Garden walkthrough · Mara · Jun 9",
            client: makeClient()
        )
    }

    func testOutcomeTemplatePrefillAndToggle() {
        let viewModel = makeFollowUp()
        viewModel.select(.completed)
        XCTAssertEqual(viewModel.outcome, .completed)
        XCTAssertEqual(viewModel.message, FollowUpOutcome.completed.template)
        // Re-selecting toggles the outcome off.
        viewModel.select(.completed)
        XCTAssertNil(viewModel.outcome)
    }

    func testSaveNoteOnlyMode() {
        let viewModel = makeFollowUp()
        // Blank open (no outcome, no send message) is save-note-only from the
        // start — the CTA is the calm ghost "Save note only" (Frame 1). A typed
        // private note does not change this since it has no send/network path.
        XCTAssertTrue(viewModel.isSaveNoteOnly)
        viewModel.privateNote = "Follow up next quarter"
        XCTAssertTrue(viewModel.isSaveNoteOnly)
        XCTAssertTrue(viewModel.primaryIsGhost)
        XCTAssertEqual(viewModel.primaryTitle, "Save note only")
        XCTAssertEqual(viewModel.primaryIcon, .lock)

        // Composing a send message exits save-note-only mode and surfaces the
        // active "Send follow-up" CTA.
        viewModel.message = "Thanks for the time today."
        XCTAssertFalse(viewModel.isSaveNoteOnly)
        XCTAssertFalse(viewModel.primaryIsGhost)
        XCTAssertEqual(viewModel.primaryTitle, "Send follow-up")
        XCTAssertEqual(viewModel.primaryIcon, .send)
    }

    func testFollowUpSendSuccess() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"ok":true}"#)]
        let viewModel = makeFollowUp()
        viewModel.select(.noShow)
        await viewModel.send()
        XCTAssertTrue(viewModel.didSend)
    }
}
