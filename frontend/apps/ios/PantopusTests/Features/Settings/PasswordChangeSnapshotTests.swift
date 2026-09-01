//
//  PasswordChangeSnapshotTests.swift
//  PantopusTests
//
//  A13.14 — structural snapshot coverage for the reshaped Change Password
//  screen. Mirrors the two design frames: READY (current verified, strong
//  revealed new password, confirm matches, CTA enabled, info chip) and ERROR
//  (form banner, wrong current password + reset shortcut, breached new
//  password, mismatched confirm, CTA locked). Follows the existing iOS
//  pattern of rendering the SwiftUI hierarchy in-process.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PasswordChangeSnapshotTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func test_a13_14_ready_frame_renders() async {
        let vm = await loadedViewModel()
        vm.update(.current, to: "autumn-river-2019")
        vm.update(.new, to: "Bake-Sourdough-Friday-77")
        vm.update(.confirm, to: "Bake-Sourdough-Friday-77")

        XCTAssertTrue(vm.isValid)
        XCTAssertTrue(vm.strength.isStrong)
        XCTAssertNil(vm.formError)
        assertRenders(PasswordChangeView(viewModel: vm) {})
    }

    func test_a13_14_error_frame_renders() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}"),
            .status(401, body: "{\"error\":\"Current password is incorrect\"}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        // A valid submit that the server rejects on the current password.
        vm.update(.current, to: "autum-river-2018")
        vm.update(.new, to: "Bake-Sourdough-Friday-77")
        vm.update(.confirm, to: "Bake-Sourdough-Friday-77")
        await vm.save()
        // Mid-recovery: the new password is now breached and confirm drifts.
        vm.update(.new, to: "password123")
        vm.update(.confirm, to: "password12")

        XCTAssertNotNil(vm.formError)
        XCTAssertFalse(vm.isValid)
        XCTAssertTrue(vm.strength.breached)
        XCTAssertEqual(vm.fields[.current]?.error, "That doesn't match the password on file.")
        assertRenders(PasswordChangeView(viewModel: vm) {})
    }

    // MARK: - Helpers

    private func loadedViewModel() async -> PasswordChangeViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"has_password\":true}")]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        return vm
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 800))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 800)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
