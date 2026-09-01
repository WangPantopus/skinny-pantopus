//
//  ClaimOwnershipStartSnapshotTests.swift
//  PantopusTests
//
//  A12.3 structural render snapshots for Claim Ownership start.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class ClaimOwnershipStartSnapshotTests: XCTestCase {
    func test_claim_ownership_start_canonical_renders() {
        assertRenders(ClaimStartStep(content: ClaimOwnershipSampleData.canonicalStart))
        XCTAssertNil(ClaimOwnershipSampleData.canonicalStart.contestedClaim)
    }

    func test_claim_ownership_start_contested_renders() {
        assertRenders(ClaimStartStep(content: ClaimOwnershipSampleData.contestedStart))
        XCTAssertEqual(
            ClaimOwnershipSampleData.contestedStart.contestedClaim?.title,
            "Another claim is already in review"
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: SnapshotWizardFrame {
                view
            }
            .frame(width: 390, height: 844)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}

@MainActor
private struct SnapshotWizardFrame<Content: View>: View {
    let content: Content
    @State private var model = SnapshotWizardModel()

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        WizardShell(model: model) {
            content
        }
    }
}

@MainActor
private final class SnapshotWizardModel: WizardModel {
    let chrome = WizardChrome(
        title: "Claim ownership",
        progressLabel: .stepOf(current: 1, total: 3),
        progressFraction: 1.0 / 3.0,
        leading: .close,
        primaryCTALabel: "Start claim",
        primaryCTAEnabled: true,
        dirty: false,
        showsProgressBar: true
    )

    func leadingTapped() {}
    func discardConfirmed() {}
    func primaryTapped() {}
}
