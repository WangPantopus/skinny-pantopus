//
//  VerifyLandlordSnapshotTests.swift
//  PantopusTests
//
//  Structural render snapshots for A12.5 Verify Landlord Start
//  (canonical + fast-track), A12.6 Verify Landlord Details (populated
//  + errors), and A12.7 Postcard verification (in-transit + delivered)
//  — 6 frames total.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class VerifyLandlordSnapshotTests: XCTestCase {
    // MARK: - A12.5 Start

    func test_verify_landlord_start_canonical_renders() {
        assertRenders(
            SnapshotWizardFrame(model: SnapshotChrome.startModel()) {
                VerifyStartStep(content: VerifyLandlordSampleData.canonical)
            }
        )
        XCTAssertFalse(VerifyLandlordSampleData.canonical.isFastTrack)
    }

    func test_verify_landlord_start_fast_track_renders() {
        assertRenders(
            SnapshotWizardFrame(model: SnapshotChrome.startModel()) {
                VerifyStartStep(content: VerifyLandlordSampleData.fastTrack)
            }
        )
        XCTAssertTrue(VerifyLandlordSampleData.fastTrack.isFastTrack)
        XCTAssertEqual(
            VerifyLandlordSampleData.fastTrack.existingLandlord?.otherTenantsCount,
            2
        )
    }

    // MARK: - A12.6 Details

    func test_verify_landlord_details_populated_renders() {
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            form: VerifyLandlordSampleData.populatedForm,
            submitDelayNanos: 0
        )
        vm.primaryTapped()
        assertRenders(
            SnapshotWizardFrame(model: SnapshotChrome.detailsModel(enabled: true)) {
                VerifyDetailsStep(viewModel: vm)
            }
        )
        XCTAssertTrue(vm.form.validate().isEmpty)
    }

    func test_verify_landlord_details_errors_renders() async {
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            form: VerifyLandlordSampleData.errorForm,
            submitDelayNanos: 0
        )
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.errors?.count, 2)
        assertRenders(
            SnapshotWizardFrame(model: SnapshotChrome.detailsModel(enabled: false)) {
                VerifyDetailsStep(viewModel: vm)
            }
        )
    }

    // MARK: - A12.7 Postcard

    func test_postcard_in_transit_renders() {
        let vm = PostcardVerificationViewModel(
            homeId: "home-1",
            stage: .inTransit,
            submitDelayNanos: 0
        )
        assertRenders(
            PostcardVerificationView(
                homeId: "home-1",
                viewModel: vm,
                onClose: {},
                onVerified: { _ in }
            )
        )
        XCTAssertTrue(vm.isCodeInputUnlocked, "The field stays live while the card is in transit")
        XCTAssertFalse(vm.primaryCTAEnabled, "…but an empty code still can't submit")
        XCTAssertFalse(vm.showsCodeEntryFrame)
    }

    func test_postcard_delivered_renders() {
        let vm = PostcardVerificationViewModel(
            homeId: "home-1",
            stage: .delivered,
            submitDelayNanos: 0
        )
        vm.updateCode("4Q2K7B")
        assertRenders(
            PostcardVerificationView(
                homeId: "home-1",
                viewModel: vm,
                onClose: {},
                onVerified: { _ in }
            )
        )
        XCTAssertTrue(vm.isCodeInputUnlocked)
        XCTAssertTrue(vm.primaryCTAEnabled)
    }

    // MARK: - Render harness

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 844))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}

// MARK: - Snapshot harness

@MainActor
private struct SnapshotWizardFrame<Content: View>: View {
    let model: SnapshotChrome
    @ViewBuilder let content: () -> Content

    var body: some View {
        WizardShell(model: model) {
            content()
        }
    }
}

@MainActor
private final class SnapshotChrome: WizardModel {
    let chrome: WizardChrome

    init(chrome: WizardChrome) {
        self.chrome = chrome
    }

    func leadingTapped() {}
    func discardConfirmed() {}
    func primaryTapped() {}
    func secondaryTapped() {}

    static func startModel() -> SnapshotChrome {
        SnapshotChrome(chrome: WizardChrome(
            title: "Verify landlord",
            progressLabel: .stepOf(current: 1, total: 3),
            progressFraction: 1.0 / 3.0,
            leading: .close,
            primaryCTALabel: "Start verification",
            primaryCTAEnabled: true,
            dirty: false,
            showsProgressBar: true
        ))
    }

    static func detailsModel(enabled: Bool) -> SnapshotChrome {
        SnapshotChrome(chrome: WizardChrome(
            title: "Verify landlord",
            progressLabel: .stepOf(current: 2, total: 3),
            progressFraction: 2.0 / 3.0,
            leading: .back,
            primaryCTALabel: "Submit",
            primaryCTAEnabled: enabled,
            dirty: true,
            showsProgressBar: true
        ))
    }
}
