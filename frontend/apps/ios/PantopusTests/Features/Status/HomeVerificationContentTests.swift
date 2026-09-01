//
//  HomeVerificationContentTests.swift
//  PantopusTests
//
//  Pins the Verification Center projection — the six `verification_status`
//  frames RN renders on `pantopus://homes/:id/waiting-room`
//  (`src/app/homes/[id]/waiting-room.tsx:242-313`), their countdown cards,
//  and the per-status action set. Copy is asserted verbatim so it can't
//  drift from the Android twin.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeVerificationContentTests: XCTestCase {
    // MARK: - Status parsing

    func testUnknownStatusFallsBackToUnverified() {
        XCTAssertEqual(HomeVerificationStatus.from(raw: nil), .unverified)
        XCTAssertEqual(HomeVerificationStatus.from(raw: "who_knows"), .unverified)
        XCTAssertEqual(HomeVerificationStatus.from(raw: "pending_doc"), .pendingDoc)
        XCTAssertEqual(HomeVerificationStatus.from(raw: "provisional_bootstrap"), .provisionalBootstrap)
    }

    // MARK: - The six frames

    func testPendingPostcardFrame() {
        let content = HomeVerificationContent.make(status: .pendingPostcard)
        XCTAssertEqual(content.headline, "Check your mailbox")
        XCTAssertEqual(content.halo.tone, .info)
        XCTAssertEqual(content.halo.icon, .mail)
        XCTAssertTrue(content.body.contains("mailed to this address"))
    }

    func testProvisionalBootstrapFrame() {
        let content = HomeVerificationContent.make(status: .provisionalBootstrap)
        XCTAssertEqual(content.headline, "Limited access")
        XCTAssertEqual(content.halo.tone, .warning)
        XCTAssertTrue(content.body.contains("provisional access with limited features"))
    }

    func testPendingApprovalFrame() {
        let content = HomeVerificationContent.make(status: .pendingApproval)
        XCTAssertEqual(content.headline, "Waiting for approval")
        XCTAssertEqual(content.halo.icon, .hourglass)
        XCTAssertTrue(content.body.contains("household member needs to approve"))
    }

    func testPendingDocFrame() {
        let content = HomeVerificationContent.make(status: .pendingDoc)
        XCTAssertEqual(content.headline, "Document under review")
        XCTAssertEqual(content.halo.tone, .warning)
        XCTAssertTrue(content.body.contains("1-2 business days"))
    }

    func testProvisionalSplitsOnChallengeWindow() {
        let inWindow = HomeVerificationContent.make(status: .provisional, isInChallengeWindow: true)
        XCTAssertEqual(inWindow.headline, "Challenge window active")
        XCTAssertEqual(inWindow.halo.tone, .info)
        let outOfWindow = HomeVerificationContent.make(status: .provisional)
        XCTAssertEqual(outOfWindow.headline, "Provisional access")
        XCTAssertEqual(outOfWindow.halo.tone, .warning)
    }

    func testSuspendedChallengedFrame() {
        let content = HomeVerificationContent.make(status: .suspendedChallenged)
        XCTAssertEqual(content.headline, "Access suspended")
        XCTAssertEqual(content.halo.icon, .alertCircle)
        XCTAssertTrue(content.body.contains("challenged by a household member"))
    }

    func testUnverifiedFallbackFrame() {
        let content = HomeVerificationContent.make(status: .unverified)
        XCTAssertEqual(content.headline, "Verification required")
        XCTAssertEqual(content.body, "Complete verification to access this home.")
    }

    // MARK: - Countdown cards

    func testPostcardExpiryRendersCountdown() {
        let content = HomeVerificationContent.make(
            status: .pendingPostcard,
            postcardExpiresAt: "2026-09-01T00:00:00Z"
        )
        XCTAssertEqual(content.countdown?.label, "Code expires")
        XCTAssertEqual(content.countdown?.icon, .mail)
        XCTAssertNotNil(content.countdown?.value)
    }

    func testChallengeWindowRendersCountdownOnlyWhileOpen() {
        let open = HomeVerificationContent.make(
            status: .provisional,
            isInChallengeWindow: true,
            challengeWindowEndsAt: "2026-09-01T00:00:00Z"
        )
        XCTAssertEqual(open.countdown?.label, "Challenge window ends")
        let closed = HomeVerificationContent.make(
            status: .provisional,
            isInChallengeWindow: false,
            challengeWindowEndsAt: "2026-09-01T00:00:00Z"
        )
        XCTAssertNil(closed.countdown)
    }

    func testUnparseableDateOmitsCountdownRatherThanPrintingPlaceholder() {
        let content = HomeVerificationContent.make(
            status: .pendingPostcard,
            postcardExpiresAt: "not-a-date"
        )
        XCTAssertNil(content.countdown)
    }

    // MARK: - Action sets

    func testPendingPostcardOffersCodeEntryAndNotAMailedCodeRequest() {
        let keys = HomeVerificationContent.make(status: .pendingPostcard).actions.map(\.actionKey)
        XCTAssertEqual(keys.first, HomeVerificationContent.ActionKey.enterCode)
        XCTAssertFalse(keys.contains(HomeVerificationContent.ActionKey.requestMailedCode))
        XCTAssertFalse(keys.contains(HomeVerificationContent.ActionKey.landlordVerification))
    }

    func testPendingApprovalOffersLandlordStatusAndNoMailedCode() {
        let actions = HomeVerificationContent.make(status: .pendingApproval).actions
        let landlord = actions.first { $0.actionKey == HomeVerificationContent.ActionKey.landlordVerification }
        XCTAssertEqual(landlord?.subtitle, "Check your approval status")
        XCTAssertFalse(actions.map(\.actionKey).contains(HomeVerificationContent.ActionKey.requestMailedCode))
    }

    func testProvisionalOffersUploadLandlordAndMailedCode() {
        let keys = HomeVerificationContent.make(status: .provisional).actions.map(\.actionKey)
        XCTAssertTrue(keys.contains(HomeVerificationContent.ActionKey.uploadProof))
        XCTAssertTrue(keys.contains(HomeVerificationContent.ActionKey.landlordVerification))
        XCTAssertTrue(keys.contains(HomeVerificationContent.ActionKey.requestMailedCode))
    }

    func testEveryFrameEndsWithMoveOutAndHelp() {
        for status in HomeVerificationStatus.allCases {
            let keys = HomeVerificationContent.make(status: status).actions.map(\.actionKey)
            XCTAssertEqual(
                Array(keys.suffix(2)),
                [HomeVerificationContent.ActionKey.moveOut, HomeVerificationContent.ActionKey.requestHelp],
                "status \(status.rawValue)"
            )
        }
    }

    func testMoveOutIsDangerToned() {
        let moveOut = HomeVerificationContent.make(status: .unverified).actions.first {
            $0.actionKey == HomeVerificationContent.ActionKey.moveOut
        }
        XCTAssertEqual(moveOut?.tone, .danger)
        XCTAssertEqual(moveOut?.title, "This isn't my home")
    }
}
