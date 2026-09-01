//
//  AuthErrorViewModelTests.swift
//  PantopusTests
//
//  Verifies `AuthErrorViewModel.copy(for:)` returns the right user-facing
//  headline/body for each `AuthError` case, and that `isRetryable` matches
//  the design rule (retry only what a retry could actually fix).
//

import XCTest
@testable import Pantopus

@MainActor
final class AuthErrorViewModelTests: XCTestCase {
    func test_copy_for_invalidCredentials() {
        let copy = AuthErrorViewModel.copy(for: .invalidCredentials)
        XCTAssertEqual(copy.headline, "Couldn't sign you in")
        XCTAssertTrue(copy.body.contains("email and password"))
    }

    func test_copy_for_emailAlreadyExists() {
        let copy = AuthErrorViewModel.copy(for: .emailAlreadyExists)
        XCTAssertEqual(copy.headline, "Email already in use")
    }

    func test_copy_for_weakPassword() {
        let copy = AuthErrorViewModel.copy(for: .weakPassword)
        XCTAssertEqual(copy.headline, "Pick a stronger password")
    }

    func test_copy_for_networkError() {
        let copy = AuthErrorViewModel.copy(for: .networkError)
        XCTAssertEqual(copy.headline, "Can't reach Pantopus")
    }

    func test_copy_for_rateLimited() {
        let copy = AuthErrorViewModel.copy(for: .rateLimited)
        XCTAssertEqual(copy.headline, "Too many attempts")
    }

    func test_copy_for_serverError_does_not_leak_raw_message() {
        let copy = AuthErrorViewModel.copy(for: .serverError("SQL error at line 42"))
        XCTAssertEqual(copy.headline, "Something went wrong")
        XCTAssertFalse(copy.body.contains("SQL"))
    }

    func test_copy_for_unknown() {
        let copy = AuthErrorViewModel.copy(for: .unknown)
        XCTAssertEqual(copy.headline, "Something went wrong")
    }

    func test_isRetryable_only_for_transient_errors() {
        let vm = AuthErrorViewModel()
        XCTAssertFalse(vm.isRetryable(.invalidCredentials))
        XCTAssertFalse(vm.isRetryable(.emailAlreadyExists))
        XCTAssertFalse(vm.isRetryable(.weakPassword))
        XCTAssertTrue(vm.isRetryable(.networkError))
        XCTAssertTrue(vm.isRetryable(.rateLimited))
        XCTAssertTrue(vm.isRetryable(.serverError("anything")))
        XCTAssertTrue(vm.isRetryable(.unknown))
    }
}
