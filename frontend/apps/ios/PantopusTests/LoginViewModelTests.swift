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

    // MARK: - Persistent login: remembered account + security banner

    func testPrepareReadsRememberedAccountAndSessionEndReason() {
        let store = InMemorySecureStore()
        let client = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let auth = AuthManager(store: store, apiClient: client, allowSecureEnclave: false)
        let user = UserDTO(id: "u_1", email: "ying@gmail.com", displayName: "Ying Wang", avatarURL: nil)
        AccountHintStore.remember(AccountHint(user: user, lastMethod: .apple, lastSeenAt: Date()), in: store)
        auth.setSessionEndReason(.tokenReuse)
        let vm = LoginViewModel()
        XCTAssertEqual(vm.emailPlaceholder, "you@email.com")
        XCTAssertNil(vm.rememberedAccount)

        vm.prepare(using: auth)

        XCTAssertEqual(vm.rememberedAccount?.userId, "u_1")
        XCTAssertEqual(vm.emailPlaceholder, "y•••@gmail.com", "hint carries only the masked address")
        XCTAssertEqual(vm.lastUsedOAuthProvider, .apple)
        XCTAssertEqual(vm.securityMessage, "You were signed out for security. Sign in again.")
        XCTAssertEqual(vm.email, "", "the field itself is never prefilled with a masked value")

        vm.dismissSecurityMessage()
        XCTAssertNil(vm.securityMessage)
        vm.prepare(using: auth)
        XCTAssertNil(vm.securityMessage, "dismissal sticks for this screen instance")
    }

    func testPrepareWithoutHintOrReasonLeavesDefaults() {
        let client = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client, allowSecureEnclave: false)
        let vm = LoginViewModel()

        vm.prepare(using: auth)

        XCTAssertNil(vm.rememberedAccount)
        XCTAssertNil(vm.securityMessage)
        XCTAssertNil(vm.lastUsedOAuthProvider)
        XCTAssertEqual(vm.emailPlaceholder, "you@email.com")
    }

    func testForgetRememberedAccountWipesTheHint() async {
        let store = InMemorySecureStore()
        let client = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let auth = AuthManager(store: store, apiClient: client, allowSecureEnclave: false)
        let user = UserDTO(id: "u_1", email: "ying@gmail.com", displayName: "Ying Wang", avatarURL: nil)
        AccountHintStore.remember(AccountHint(user: user, lastMethod: .password, lastSeenAt: Date()), in: store)
        let vm = LoginViewModel()
        vm.prepare(using: auth)
        vm.email = "typed@example.com"
        XCTAssertNotNil(vm.rememberedAccount)

        await vm.forgetRememberedAccount(using: auth)

        XCTAssertNil(vm.rememberedAccount)
        XCTAssertTrue(auth.rememberedAccounts.isEmpty)
        XCTAssertEqual(vm.email, "typed@example.com", "what the user typed stays")
        XCTAssertEqual(vm.emailPlaceholder, "you@email.com")
    }
}
