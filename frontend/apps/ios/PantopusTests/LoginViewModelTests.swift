//
//  LoginViewModelTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

@MainActor
final class LoginViewModelTests: XCTestCase {
    func testCanSubmitRequiresValidEmailAndLongPassword() {
        let vm = LoginViewModel()

        XCTAssertFalse(vm.canSubmit)

        vm.email = "not-an-email"
        vm.password = "short"
        XCTAssertFalse(vm.canSubmit)

        vm.email = "alice@example.com"
        vm.password = "short"
        XCTAssertFalse(vm.canSubmit, "6+ char password required")

        vm.password = "hunter22"
        XCTAssertTrue(vm.canSubmit)
    }

    func testCanSubmitDisabledWhileLoading() {
        let vm = LoginViewModel()
        vm.email = "alice@example.com"
        vm.password = "hunter22"
        XCTAssertTrue(vm.canSubmit)

        vm.isLoading = true
        XCTAssertFalse(vm.canSubmit)
    }

    func testSignInFailureSurfacesTypedAuthError() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/users/login"] = [
            .status(401, body: "{\"error\":\"Invalid email or password\"}")
        ]
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client)
        let vm = LoginViewModel()
        vm.email = "alice@example.com"
        vm.password = "hunter22"

        await vm.signIn(using: auth)

        XCTAssertEqual(vm.errorMessage, .invalidCredentials)
        XCTAssertFalse(vm.isLoading)
        SequencedURLProtocol.reset()
    }

    func testClearErrorResetsErrorMessage() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/users/login"] = [
            .status(401, body: "{\"error\":\"Invalid email or password\"}")
        ]
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client)
        let vm = LoginViewModel()
        vm.email = "alice@example.com"
        vm.password = "hunter22"

        await vm.signIn(using: auth)
        XCTAssertNotNil(vm.errorMessage)

        vm.clearError()
        XCTAssertNil(vm.errorMessage)
        SequencedURLProtocol.reset()
    }
}
