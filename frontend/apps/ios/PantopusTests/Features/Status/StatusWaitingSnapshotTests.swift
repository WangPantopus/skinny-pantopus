//
//  StatusWaitingSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for `StatusWaitingView` across every A18 frame +
//  secondary state (A18.1 sent/resent, A18.2 submitted/approved, A18.3
//  waiting/confirmed, plus the retained under-review recipe). Hosts each
//  frame in a UIHostingController and asserts the SwiftUI tree builds —
//  mirrors `StatusPrimitivesSnapshotTests`, the established pattern for the
//  ceremonial status surfaces (whose pixel baselines live alongside).
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class StatusWaitingSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        content: StatusWaitingContent,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: StatusWaitingView(content: content))
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    // MARK: - A18.1 Check your email

    func testCheckYourEmailWaiting() {
        assertRenders("A18.1 waiting", content: .checkYourEmail(email: "maria.k@email.com"))
    }

    func testCheckYourEmailResent() {
        assertRenders("A18.1 resent", content: .checkYourEmail(email: "maria.k@email.com", resent: true))
    }

    // MARK: - A18.2 Claim submitted

    func testClaimSubmitted() {
        assertRenders("A18.2 submitted", content: .claimSubmitted(homeName: "418 Linden Ave, Oakland CA"))
    }

    func testClaimApproved() {
        assertRenders(
            "A18.2 approved",
            content: .claimSubmitted(homeName: "418 Linden Ave, Oakland CA", approved: true)
        )
    }

    // MARK: - A18.3 Verification submitted

    func testVerificationSubmitted() {
        assertRenders("A18.3 waiting", content: .verificationSubmitted(
            homeName: "418 Linden Ave · Apt 3B",
            landlordEmail: "r.osman@acme-realty.com"
        ))
    }

    func testVerificationConfirmed() {
        assertRenders("A18.3 confirmed", content: .verificationSubmitted(
            homeName: "418 Linden Ave · Apt 3B",
            landlordEmail: "r.osman@acme-realty.com",
            landlordName: "Rashida Osman",
            confirmed: true
        ))
    }

    // MARK: - Retained frame

    func testUnderReview() {
        assertRenders("Under review", content: .underReview(homeName: "412 Elm St", submittedAgo: "2 days ago"))
    }
}
