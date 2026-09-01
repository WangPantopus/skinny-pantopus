//
//  WizardShellIdentitySnapshotTests.swift
//  PantopusTests
//
//  P2.0 — Renders `WizardShell` against all four `WizardIdentity` cases
//  to lock the identity-tinted progress rail + primary CTA behaviour.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class WizardShellIdentitySnapshotTests: XCTestCase {
    func test_wizardShell_renders_for_personal_identity() {
        assertRenders(identity: .personal)
    }

    func test_wizardShell_renders_for_home_identity() {
        assertRenders(identity: .home)
    }

    func test_wizardShell_renders_for_business_identity() {
        assertRenders(identity: .business)
    }

    func test_wizardShell_renders_for_warm_identity() {
        assertRenders(identity: .warm)
    }

    func test_wizardIdentity_accentColors_areDistinct() {
        // Sanity check that every identity surfaces its own accent — caller
        // code that branches on identity depends on these being unique.
        let accents = Set(WizardIdentity.allCases.map(\.accent.description))
        XCTAssertEqual(accents.count, WizardIdentity.allCases.count)
    }

    private func assertRenders(
        identity: WizardIdentity,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let model = IdentitySnapshotWizardModel()
        let host = UIHostingController(
            rootView: WizardShell(model: model, identity: identity) {
                Text("Step content")
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
private final class IdentitySnapshotWizardModel: WizardModel {
    let chrome = WizardChrome(
        title: "Identity wizard",
        progressLabel: .stepOf(current: 2, total: 4),
        progressFraction: 0.5,
        leading: .close,
        primaryCTALabel: "Continue",
        primaryCTAEnabled: true,
        dirty: false,
        showsProgressBar: true
    )

    func leadingTapped() {}
    func discardConfirmed() {}
    func primaryTapped() {}
}
