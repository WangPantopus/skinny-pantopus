//
//  CreateBusinessSnapshotTests.swift
//  PantopusTests
//
//  Structural render snapshots for A12.10 frame 1 (populated) and frame
//  2 (search). Mirrors `ClaimOwnershipStartSnapshotTests` — host the
//  step inside a `SnapshotWizardFrame` that wires the violet identity,
//  layout once, and assert non-zero geometry. The intent is to catch
//  build-time regressions on the new wizard surface; per-pixel
//  comparison lives in the cross-platform snapshot harness.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class CreateBusinessSnapshotTests: XCTestCase {
    func test_create_business_frame1_populated_renders() {
        let vm = CreateBusinessWizardViewModel()
        // Default state is the populated frame: .home selected, no
        // search query, the "What you'll get" strip present.
        XCTAssertEqual(vm.selectedCategoryId, .home)
        XCTAssertFalse(vm.isSearchActive)
        XCTAssertEqual(vm.whatYouGetItems.count, 3)
        assertRenders(PickCategoryStep(viewModel: vm))
    }

    func test_create_business_frame2_search_renders() {
        let vm = CreateBusinessWizardViewModel()
        vm.searchText = "tutor"
        XCTAssertTrue(vm.isSearchActive)
        XCTAssertEqual(vm.searchHits.count, 3)
        assertRenders(PickCategorySearchStep(viewModel: vm))
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
        WizardShell(model: model, identity: .business) {
            content
        }
    }
}

@MainActor
private final class SnapshotWizardModel: WizardModel {
    let chrome = WizardChrome(
        title: "Create business",
        progressLabel: .stepOf(current: 1, total: 4),
        progressFraction: 1.0 / 4.0,
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
