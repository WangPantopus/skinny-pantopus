//
//  ClaimUploadStepSnapshotTests.swift
//  PantopusTests
//
//  A12.4 structural render snapshots for Claim Ownership · Evidence (step 2):
//  the ready-to-submit frame (both docs done · address matches) and the
//  mid-upload frame (one warn · one uploading · "Waiting for upload to
//  finish" footer hint). Also pins the placeholder + encryption-footer copy
//  word-for-word for iOS ↔ Android parity.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class ClaimUploadStepSnapshotTests: XCTestCase {
    // MARK: - Render variants

    func test_claim_upload_ready_to_submit_renders() {
        assertRenders(
            ClaimUploadStepContent(
                homeLabel: "412 Elm St",
                slots: Self.readyToSubmitSlots,
                statement: .constant(Self.readyStatement),
                submitError: nil
            ),
            chrome: Self.chrome(primaryEnabled: true, footerHint: nil)
        )
        XCTAssertEqual(Self.readyToSubmitSlots.filter(\.state.isAttached).count, 2)
    }

    func test_claim_upload_mid_upload_renders() {
        assertRenders(
            ClaimUploadStepContent(
                homeLabel: "412 Elm St",
                slots: Self.midUploadSlots,
                statement: .constant(Self.midStatement),
                submitError: nil
            ),
            chrome: Self.chrome(primaryEnabled: false, footerHint: "Waiting for upload to finish")
        )
        // Exactly one document is attached (the warn slot); the other is
        // still uploading and must not count toward "N of 2 attached".
        XCTAssertEqual(Self.midUploadSlots.filter(\.state.isAttached).count, 1)
    }

    // MARK: - Copy parity tripwires (must match Android word-for-word)

    func test_statement_placeholder_copy_is_pinned() {
        XCTAssertEqual(
            ClaimUploadCopy.statementPlaceholder,
            "Add a short statement to help the reviewer (e.g. how long you've owned, anyone else on title)…"
        )
    }

    func test_encryption_footer_copy_is_pinned() {
        XCTAssertEqual(
            ClaimUploadCopy.encryptionFooter,
            "Encrypted in transit. Visible only to the reviewer assigned to your claim."
        )
    }

    func test_address_match_leads_are_pinned() {
        XCTAssertEqual(UploadSlotState.matchLead, "Address matches.")
        XCTAssertEqual(UploadSlotState.differLead, "Address differs from your profile.")
    }

    // MARK: - Fixtures

    private static let readyStatement =
        "I purchased the property at 412 Elm St in March 2022 and have lived here as the sole owner " +
        "since closing. The deed is in my name; the tax statement reflects the same address as my account."

    private static let midStatement = "I purchased 412 Elm St in"

    private static let readyToSubmitSlots: [ClaimUploadSlotModel] = [
        ClaimUploadSlotModel(
            id: "identity",
            label: "Government ID",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .done(
                file: UploadSlotFile(name: "drivers_license.jpg", sizeLabel: "820 KB", pageCount: nil, kind: .image),
                detail: "\"412 Elm St\" matches the address on your account."
            )
        ),
        ClaimUploadSlotModel(
            id: "ownership",
            label: "Proof of ownership",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .done(
                file: UploadSlotFile(name: "deed_412_elm.pdf", sizeLabel: "1.4 MB", pageCount: 8, kind: .pdf),
                detail: "\"412 Elm St\" matches the address on your account."
            )
        )
    ]

    private static let midUploadSlots: [ClaimUploadSlotModel] = [
        ClaimUploadSlotModel(
            id: "identity",
            label: "Government ID",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .uploading(
                file: UploadSlotFile(name: "drivers_license.jpg", sizeLabel: "1.1 MB", pageCount: nil, kind: .image),
                progress: 0.62
            )
        ),
        ClaimUploadSlotModel(
            id: "ownership",
            label: "Proof of ownership",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .warn(
                file: UploadSlotFile(name: "mortgage_statement.pdf", sizeLabel: "2.1 MB", pageCount: 4, kind: .pdf),
                detail: "We couldn't confirm 412 Elm St on this document. You can still submit — the reviewer will resolve it."
            )
        )
    ]

    // MARK: - Helpers

    private static func chrome(primaryEnabled: Bool, footerHint: String?) -> WizardChrome {
        WizardChrome(
            title: "Claim ownership",
            progressLabel: .stepOf(current: 2, total: 3),
            progressFraction: 2.0 / 3.0,
            leading: .back,
            primaryCTALabel: "Submit claim",
            primaryCTAEnabled: primaryEnabled,
            isSubmitting: false,
            footerHint: footerHint,
            dirty: true,
            showsProgressBar: true
        )
    }

    private func assertRenders(
        _ view: some View,
        chrome: WizardChrome,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: SnapshotWizardFrame(chrome: chrome) { view }
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
    @State private var model: SnapshotWizardModel
    let content: Content

    init(chrome: WizardChrome, @ViewBuilder content: () -> Content) {
        _model = State(initialValue: SnapshotWizardModel(chrome: chrome))
        self.content = content()
    }

    var body: some View {
        WizardShell(model: model) { content }
    }
}

@MainActor
private final class SnapshotWizardModel: WizardModel {
    let chrome: WizardChrome
    init(chrome: WizardChrome) {
        self.chrome = chrome
    }

    func leadingTapped() {}
    func discardConfirmed() {}
    func primaryTapped() {}
}
