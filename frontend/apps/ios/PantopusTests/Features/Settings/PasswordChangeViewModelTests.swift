//
//  PasswordChangeViewModelTests.swift
//  PantopusTests
//
//  A13.14 — covers field validation (length, match, current-required
//  gating), the auth-methods discovery call (hasPassword vs OAuth-only),
//  the live strength + breach detection added by the reshape, the success
//  path (toast + shouldDismiss), and the error path (current-password field
//  error + form-level banner).
//

import XCTest
@testable import Pantopus

@MainActor
final class PasswordChangeViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    func testLoadDiscoversHasPasswordFromAuthMethods() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"providers\":[\"email\"],\"has_password\":true}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        XCTAssertTrue(vm.requiresCurrent)
        XCTAssertEqual(vm.formState, .ready)
    }

    func testLoadOAuthOnlyDoesNotRequireCurrent() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"providers\":[\"google\"],\"has_password\":false}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        XCTAssertFalse(vm.requiresCurrent)
    }

    func testIsValidRejectsShortPassword() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.current, to: "old-password-123")
        vm.update(.new, to: "short")
        vm.update(.confirm, to: "short")
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidRejectsMismatchedConfirm() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.current, to: "old-password-123")
        vm.update(.new, to: "new-password-456")
        vm.update(.confirm, to: "different")
        XCTAssertFalse(vm.isValid)
        XCTAssertEqual(vm.fields[.confirm]?.error, "Doesn't match the new password above.")
    }

    func testStrengthReflectsNewPassword() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.new, to: "Bake-Sourdough-Friday-77")
        XCTAssertEqual(vm.strength.rulesMet, 4)
        XCTAssertTrue(vm.strength.isStrong)
        XCTAssertFalse(vm.isNewPasswordBreached)
        XCTAssertTrue(vm.isNewValid)
    }

    func testBreachedNewPasswordIsInvalidAndFlagged() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.current, to: "old-password-123")
        vm.update(.new, to: "password123")
        vm.update(.confirm, to: "password123")
        XCTAssertTrue(vm.isNewPasswordBreached)
        XCTAssertTrue(vm.strength.breached)
        XCTAssertFalse(vm.isValid)
        XCTAssertEqual(vm.fields[.new]?.error, "Too common — appeared in 2.3M public records.")
    }

    func testSaveSuccessSetsToastAndShouldDismiss() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}"),
            .status(200, body: "{\"message\":\"Password updated\"}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.current, to: "old-password-123")
        vm.update(.new, to: "new-password-456")
        vm.update(.confirm, to: "new-password-456")
        await vm.save()
        XCTAssertEqual(vm.toast, "Password updated")
        XCTAssertTrue(vm.shouldDismiss)
        XCTAssertNil(vm.formError)
    }

    func testSave401MarksCurrentPasswordFieldAndShowsBanner() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"has_password\":true}"),
            .status(401, body: "{\"error\":\"Current password is incorrect\"}")
        ]
        let vm = PasswordChangeViewModel(api: makeAPI())
        await vm.load()
        vm.update(.current, to: "wrong-password-1")
        vm.update(.new, to: "new-password-456")
        vm.update(.confirm, to: "new-password-456")
        await vm.save()
        XCTAssertEqual(vm.fields[.current]?.error, "That doesn't match the password on file.")
        XCTAssertEqual(vm.formError?.title, "Couldn't update password")
        XCTAssertFalse(vm.shouldDismiss)
    }
}
