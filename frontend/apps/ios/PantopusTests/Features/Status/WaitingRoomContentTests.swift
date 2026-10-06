//
//  WaitingRoomContentTests.swift
//  PantopusTests
//
//  A18.4 — the persistent waiting room is presentational, so the testable
//  surface is the two preset factories on `WaitingRoomContent`. These tests
//  pin the slot output for the active wait + the "more info requested ·
//  review paused" secondary state so design tweaks can't silently drop a
//  required slot, and verify the copy is byte-identical to the Android twin.
//

import XCTest
@testable import Pantopus

@MainActor
final class WaitingRoomContentTests: XCTestCase {
    // MARK: - Active wait

    func testActiveFillsAllRequiredSlots() {
        let content = WaitingRoomContent.active()
        XCTAssertEqual(content.title, "Waiting for approval")
        // Info-toned, pulsing halo — review isn't done, so not success green.
        XCTAssertEqual(content.halo.tone, .info)
        XCTAssertEqual(content.halo.icon, .hourglass)
        XCTAssertTrue(content.halo.isPulsing)
        XCTAssertEqual(content.headline, "Under review")
        XCTAssertTrue(content.subcopy.contains("checking your documents against county records"))
        XCTAssertEqual(content.address, "418 Linden Ave · Apt 3B")
        XCTAssertEqual(content.claimRef, "CLM-4F2A")
        XCTAssertNil(content.reviewerNote)
        // Submitted → Under review → Approved, current = Under review.
        XCTAssertEqual(content.timeline.map(\.label), ["Submitted", "Under review", "Approved"])
        XCTAssertEqual(content.timeline.map(\.state), [.done, .current, .pending])
        XCTAssertEqual(content.timeline[1].sub, "Started 9h ago")
        XCTAssertFalse(content.timelinePaused)
        // ETA pill — primary tone, "within 24–48 hours".
        XCTAssertEqual(content.etaPill.tone, .primary)
        XCTAssertEqual(content.etaPill.text, "Decision usually within 24–48 hours")
        XCTAssertEqual(content.etaPill.icon, .calendarClock)
        XCTAssertEqual(content.manageSectionTitle, "Manage this claim")
        XCTAssertEqual(content.primaryCta.label, "View claim")
        XCTAssertEqual(content.primaryCta.icon, .fileText)
        XCTAssertEqual(content.secondaryCta.label, "Back to home")
    }

    func testActiveInlineActionsAreStandardUpdateAndDangerCancel() {
        let actions = WaitingRoomContent.active().inlineActions
        XCTAssertEqual(actions.map(\.id), ["updateEvidence", "cancelClaim"])
        XCTAssertEqual(actions.map(\.label), ["Update evidence", "Cancel claim"])
        XCTAssertEqual(actions.map(\.icon), [.filePlus2, .xCircle])
        // Active wait keeps Update evidence neutral (standard); Cancel is danger.
        XCTAssertEqual(actions.map(\.tone), [.standard, .danger])
        XCTAssertEqual(actions.map(\.actionKey), ["update_evidence", "cancel_claim"])
    }

    // MARK: - More info requested · review paused

    func testMoreInfoRequestedSwapsHaloHeadlineAndPause() {
        let content = WaitingRoomContent.moreInfoRequested()
        XCTAssertEqual(content.title, "Waiting for approval")
        // Static warning halo (amber), no pulse.
        XCTAssertEqual(content.halo.tone, .warning)
        XCTAssertEqual(content.halo.icon, .fileWarning)
        XCTAssertFalse(content.halo.isPulsing)
        XCTAssertEqual(content.headline, "We need one more thing")
        XCTAssertTrue(content.subcopy.contains("older than 90 days"))
        XCTAssertTrue(content.subcopy.contains("last 60 days"))
        // Address + claim ref are constant across both frames.
        XCTAssertEqual(content.address, "418 Linden Ave · Apt 3B")
        XCTAssertEqual(content.claimRef, "CLM-4F2A")
        // Timeline reflects the pause: current = Under review, "Action needed".
        XCTAssertTrue(content.timelinePaused)
        XCTAssertEqual(content.timeline.map(\.state), [.done, .current, .pending])
        XCTAssertEqual(content.timeline[1].sub, "Action needed")
        // ETA pill flips to warning "Paused · respond within 7 days".
        XCTAssertEqual(content.etaPill.tone, .warning)
        XCTAssertEqual(content.etaPill.text, "Paused · respond within 7 days")
        XCTAssertEqual(content.etaPill.icon, .alertCircle)
    }

    func testMoreInfoRequestedShowsReviewerNote() {
        let note = WaitingRoomContent.moreInfoRequested().reviewerNote
        XCTAssertNotNil(note)
        XCTAssertEqual(note?.eyebrow, "Note from reviewer · Maya K.")
        XCTAssertEqual(note?.body.contains("July 14"), true)
        XCTAssertEqual(note?.body.contains("last 60 days"), true)
    }

    func testMoreInfoRequestedPromotesUpdateEvidenceToPrimary() {
        let actions = WaitingRoomContent.moreInfoRequested().inlineActions
        XCTAssertEqual(actions.map(\.id), ["updateEvidence", "cancelClaim"])
        // The paused state elevates Update evidence to the primary tone.
        XCTAssertEqual(actions.map(\.tone), [.primary, .danger])
        XCTAssertEqual(actions.map(\.actionKey), ["update_evidence", "cancel_claim"])
    }

    // MARK: - Cross-frame invariants

    func testDockIsConstantAcrossBothFrames() {
        for content in [WaitingRoomContent.active(), .moreInfoRequested()] {
            XCTAssertEqual(content.primaryCta.actionKey, "view_claim")
            XCTAssertEqual(content.secondaryCta.actionKey, "back_to_home")
            XCTAssertEqual(content.manageSectionTitle, "Manage this claim")
        }
    }

    func testViewModelSeedsContentForRequestedState() async {
        let active = WaitingRoomViewModel(homeId: "h1", state: .active)
        XCTAssertEqual(active.content.headline, "Under review")
        let moreInfo = WaitingRoomViewModel(homeId: "h1", state: .moreInfoRequested)
        XCTAssertEqual(moreInfo.content.headline, "We need one more thing")
        XCTAssertEqual(moreInfo.homeId, "h1")

        let loaded = await loadedClaim(createdAt: "2026-06-12T12:00:00Z")
        XCTAssertEqual(loaded.content.timeline[0].sub, WaitingRoomViewModel.dayCaption("2026-06-12T12:00:00Z"))
        XCTAssertNotNil(loaded.content.timeline[0].sub)
        XCTAssertNil(loaded.content.timeline[1].sub)

        let invalid = await loadedClaim(createdAt: "invalid-date")
        XCTAssertNil(invalid.content.timeline[0].sub)
        XCTAssertNil(invalid.content.timeline[1].sub)
    }

    private func loadedClaim(createdAt: String) async -> WaitingRoomViewModel {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        SequencedURLProtocol.routeResponses = [
            "/api/homes/my-ownership-claims": [
                .status(200, body: """
                {"claims":[{"id":"claim-1","home_id":"home-1","claim_type":"owner","method":"invite",
                "status":"under_review","created_at":"\(createdAt)","updated_at":"2026-07-18T12:00:00Z"}]}
                """)
            ],
            "/api/homes/home-1": [.status(403, body: "{}")]
        ]
        let model = WaitingRoomViewModel(homeId: "home-1", api: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
        await model.refresh()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.content.claimRef, "CLAIM-1")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET", "GET"])
        return model
    }
}
