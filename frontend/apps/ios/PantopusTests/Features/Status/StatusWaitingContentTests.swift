//
//  StatusWaitingContentTests.swift
//  PantopusTests
//
//  A18 Status / Waiting is presentational — the testable surface is the
//  preset factories on `StatusWaitingContent`. These tests pin the slot
//  output for each design frame and its secondary state.
//

import XCTest
@testable import Pantopus

final class StatusWaitingContentTests: XCTestCase {
    // MARK: - A18.2 Claim submitted

    func testClaimSubmittedFillsAllRequiredSlots() {
        let content = StatusWaitingContent.claimSubmitted(homeName: "418 Linden Ave")
        XCTAssertEqual(content.halo.tone, .success)
        XCTAssertEqual(content.halo.icon, .check)
        XCTAssertEqual(content.headline, "Claim submitted")
        XCTAssertEqual(content.addressChip, "418 Linden Ave")
        XCTAssertEqual(content.statusPill?.tone, .success)
        XCTAssertEqual(content.statusPill?.text, "Decision usually within 3 business days")
        XCTAssertNil(content.timeline[0].sub, "no submitted date supplied → no caption")
        XCTAssertEqual(content.timeline.count, 3)
        XCTAssertEqual(content.timeline.map(\.state), [.done, .pending, .pending])
        XCTAssertEqual(content.primaryCta?.actionKey, "view_status")
        XCTAssertEqual(content.primaryCta?.icon, .arrowRight)
        XCTAssertEqual(content.secondaryCta?.actionKey, "back_to_home")
        XCTAssertTrue(content.actionStack.isEmpty)
    }

    func testClaimSubmittedWithoutHomeNameOmitsChip() {
        let content = StatusWaitingContent.claimSubmitted(homeName: nil)
        XCTAssertNil(content.addressChip)
        let blank = StatusWaitingContent.claimSubmitted(homeName: "")
        XCTAssertNil(blank.addressChip)
    }

    func testClaimApprovedSwapsHaloPillAndDock() {
        let content = StatusWaitingContent.claimSubmitted(homeName: "418 Linden Ave", approved: true)
        XCTAssertEqual(content.halo.icon, .badgeCheck)
        XCTAssertEqual(content.headline, "You're the owner")
        XCTAssertEqual(content.statusPill?.tone, .success)
        XCTAssertEqual(content.statusPill?.text, "Approved")
        XCTAssertEqual(content.timeline.map(\.state), [.done, .done, .done])
        XCTAssertEqual(content.primaryCta?.label, "Open your home")
        XCTAssertEqual(content.secondaryCta?.label, "View claim")
    }

    func testClaimApprovedUsesSuppliedDatesInsteadOfSamples() {
        let content = StatusWaitingContent.claimSubmitted(
            homeName: "418 Linden Ave",
            approved: true,
            submittedOn: "Mar 2",
            decidedOn: "Mar 6"
        )
        XCTAssertEqual(content.statusPill?.text, "Approved · Mar 6")
        XCTAssertEqual(content.timeline.map(\.sub), ["Mar 2", nil, "Mar 6"])
    }

    // MARK: - A18.3 Verification submitted

    func testVerificationSubmittedFillsAllRequiredSlots() {
        let content = StatusWaitingContent.verificationSubmitted(
            homeName: "418 Linden Ave · Apt 3B",
            landlordEmail: "r.osman@acme-realty.com"
        )
        XCTAssertEqual(content.halo.tone, .success)
        XCTAssertEqual(content.halo.icon, .check)
        XCTAssertEqual(content.headline, "Verification submitted")
        XCTAssertEqual(content.bodyEmphasis, "r.osman@acme-realty.com")
        XCTAssertTrue(content.subcopy.contains("r.osman@acme-realty.com"))
        XCTAssertEqual(content.addressChip, "418 Linden Ave · Apt 3B")
        XCTAssertEqual(content.statusPill?.tone, .success)
        XCTAssertEqual(content.statusPill?.text, "Most landlords confirm in 1–2 days")
        XCTAssertEqual(content.timeline.map(\.label), ["Lease + ID", "Landlord confirms", "Verified"])
        XCTAssertEqual(content.timeline.map(\.state), [.done, .pending, .pending])
        // A18.3 inverts A18.2: "Back to home" is the primary CTA.
        XCTAssertEqual(content.primaryCta?.label, "Back to home")
        XCTAssertEqual(content.primaryCta?.icon, .home)
        XCTAssertEqual(content.secondaryCta?.label, "View status")
    }

    func testVerificationConfirmedSwapsHaloPillAndTimeline() {
        let content = StatusWaitingContent.verificationSubmitted(
            homeName: "418 Linden Ave · Apt 3B",
            landlordEmail: "r.osman@acme-realty.com",
            landlordName: "Rashida Osman",
            confirmed: true
        )
        XCTAssertEqual(content.halo.icon, .userCheck)
        XCTAssertEqual(content.headline, "Landlord confirmed")
        XCTAssertEqual(content.bodyEmphasis, "Rashida Osman")
        XCTAssertEqual(content.statusPill?.tone, .primary)
        XCTAssertEqual(content.statusPill?.text, "Final review in progress")
        XCTAssertEqual(content.timeline.map(\.state), [.done, .done, .current])
        // Primary CTA stays "Back to home" across both states.
        XCTAssertEqual(content.primaryCta?.label, "Back to home")
    }

    func testVerificationConfirmedWithoutNameFallsBack() {
        let content = StatusWaitingContent.verificationSubmitted(
            homeName: nil,
            landlordEmail: "r.osman@acme-realty.com",
            confirmed: true
        )
        XCTAssertEqual(content.bodyEmphasis, "Your landlord")
        XCTAssertTrue(content.subcopy.hasPrefix("Your landlord"))
    }

    // MARK: - A18.1 Check your email

    func testCheckYourEmailWaitingState() {
        let content = StatusWaitingContent.checkYourEmail(email: "maria.k@email.com")
        XCTAssertEqual(content.halo.tone, .info)
        XCTAssertEqual(content.halo.icon, .mailCheck)
        XCTAssertEqual(content.headline, "Check your email")
        XCTAssertEqual(content.bodyEmphasis, "maria.k@email.com")
        XCTAssertEqual(content.statusPill?.tone, .neutral)
        XCTAssertEqual(content.statusPill?.text, "Waiting for link click…")
        XCTAssertTrue(content.statusPill?.isSpinning == true)
        XCTAssertEqual(content.actionStack.map(\.id), ["openMail", "resendEmail", "changeEmail"])
        XCTAssertEqual(content.actionStack.map(\.style), [.primary, .outline, .underline])
        XCTAssertFalse(content.actionStack[1].isDisabled)
        XCTAssertEqual(content.actionStack[1].label, "Resend email")
        XCTAssertTrue(content.footnote?.contains("spam") == true)
        // A18.1 uses an in-body stack, not the sticky dock.
        XCTAssertNil(content.primaryCta)
        XCTAssertNil(content.secondaryCta)
        XCTAssertTrue(content.timeline.isEmpty)
    }

    func testCheckYourEmailResentState() {
        let content = StatusWaitingContent.checkYourEmail(email: "maria.k@email.com", resent: true)
        XCTAssertEqual(content.statusPill?.tone, .success)
        XCTAssertEqual(content.statusPill?.text, "New link sent · just now")
        XCTAssertFalse(content.statusPill?.isSpinning == true)
        let resend = content.actionStack[1]
        XCTAssertTrue(resend.isDisabled)
        XCTAssertEqual(resend.label, "Resend in 0:42")
        XCTAssertEqual(resend.icon, .timer)
        XCTAssertTrue(content.footnote?.contains("Double-check") == true)
    }

    func testCheckYourEmailWithoutEmailFallsBack() {
        let content = StatusWaitingContent.checkYourEmail(email: nil)
        XCTAssertNil(content.bodyEmphasis)
        XCTAssertTrue(content.subcopy.contains("your email"))
        XCTAssertFalse(content.subcopy.contains("@"))
    }

    // MARK: - Under review (retained recipe)

    func testUnderReviewFillsAllRequiredSlots() {
        let content = StatusWaitingContent.underReview(homeName: "412 Elm St", submittedAgo: "2 days ago")
        XCTAssertEqual(content.halo.tone, .warning)
        XCTAssertEqual(content.headline, "Under review")
        XCTAssertTrue(content.subcopy.contains("412 Elm St"))
        XCTAssertTrue(content.subcopy.contains("2 days ago"))
        XCTAssertEqual(content.statusPill?.tone, .warning)
        XCTAssertEqual(content.timeline.count, 3)
        XCTAssertEqual(content.currentStageId, "review")
        XCTAssertEqual(content.actionCards.map(\.id), ["addEvidence", "contactSupport"])
        XCTAssertEqual(content.explainerBullets.count, 3)
    }

    func testUnderReviewWithoutSubmittedAgoOmitsClause() {
        let content = StatusWaitingContent.underReview(homeName: "412 Elm St", submittedAgo: nil)
        XCTAssertFalse(content.subcopy.contains("Submitted "))
    }

    // MARK: - Cross-frame invariants

    func testEveryFrameExposesAnActionableElement() {
        let frames: [StatusWaitingContent] = [
            .claimSubmitted(homeName: nil),
            .claimSubmitted(homeName: nil, approved: true),
            .verificationSubmitted(homeName: nil, landlordEmail: "l@x.com"),
            .verificationSubmitted(homeName: nil, landlordEmail: "l@x.com", confirmed: true),
            .checkYourEmail(email: nil),
            .checkYourEmail(email: nil, resent: true),
            .underReview(homeName: nil)
        ]
        for frame in frames {
            XCTAssertTrue(
                frame.primaryCta != nil || !frame.actionStack.isEmpty,
                "Frame \(frame.headline) needs a primary CTA or an action stack"
            )
        }
    }

    func testHomesClaimTimelineHasThreeStages() {
        XCTAssertEqual(StatusWaitingContent.homesClaimTimeline.map(\.id), ["submitted", "review", "complete"])
    }
}
