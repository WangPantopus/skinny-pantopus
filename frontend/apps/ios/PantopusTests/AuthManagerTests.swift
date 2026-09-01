//
//  AuthManagerTests.swift
//  PantopusTests
//
//  Exercises AuthManager with an in-memory SecureStore and a stubbed
//  APIClient backed by SequencedURLProtocol so nothing hits the real
//  Keychain or the real network.
//

import XCTest
@testable import Pantopus

@MainActor
final class AuthManagerTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeManager(store: any SecureStore = InMemorySecureStore()) -> AuthManager {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        return AuthManager(store: store, apiClient: client)
    }

    private func stub(_ path: String, status: Int, body: String) {
        SequencedURLProtocol.routeResponses[path] = [.status(status, body: body)]
    }

    // MARK: - Existing coverage

    func testInitialStateIsUnknown() {
        let manager = AuthManager(store: InMemorySecureStore())
        if case .unknown = manager.state { /* pass */ } else {
            XCTFail("Expected .unknown on init, got \(manager.state)")
        }
        XCTAssertNil(manager.accessToken)
    }

    func testSignOutClearsState() async throws {
        let store = InMemorySecureStore()
        try store.set("at_test", for: SecureStoreKey.accessToken)
        try store.set("u_123", for: SecureStoreKey.userId)

        let manager = AuthManager(store: store)
        await manager.signOut()

        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertNil(manager.accessToken)
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        XCTAssertNil(store.get(SecureStoreKey.userId))
    }

    func testHandleUnauthorizedTransitionsToSignedOut() async {
        let manager = AuthManager(store: InMemorySecureStore())
        await manager.handleUnauthorized()
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut after 401, got \(manager.state)")
        }
    }

    // MARK: - Sign in mapping

    func testSignInSuccessPersistsTokensAndFlipsState() async throws {
        let store = InMemorySecureStore()
        stub("/api/users/login", status: 200, body: Fixtures.loginJSON())
        let manager = makeManager(store: store)

        try await manager.signIn(email: "alice@example.com", password: "hunter22")

        if case let .signedIn(user) = manager.state {
            XCTAssertEqual(user.id, "u_123")
        } else {
            XCTFail("Expected .signedIn, got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "at_test")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt_test")
        XCTAssertEqual(store.get(SecureStoreKey.userId), "u_123")
    }

    func testSignInWrongCredentialsMapsToInvalidCredentials() async {
        stub("/api/users/login", status: 401, body: "{\"error\":\"Invalid email or password\"}")
        let manager = makeManager()
        await XCTAssertThrowsAsync(
            { try await manager.signIn(email: "x@y.com", password: "bad") },
            expected: .invalidCredentials
        )
    }

    func testSignInUnverifiedEmailMapsToVerifyMessage() async {
        // The login handler's only 403 is the unverified-email refusal
        // (`backend/routes/users.js:1526`). `APIClient` turns 403 into
        // `.forbidden` before the generic 4xx case, discarding the body, so the
        // mapping has to supply the copy. `LoginView.canResendVerification`
        // reveals the resend link on any sign-in error mentioning "verify" —
        // this asserts the link can actually appear.
        stub(
            "/api/users/login",
            status: 403,
            body: "{\"error\":\"Please verify your email before signing in.\",\"needsVerification\":true}"
        )
        let manager = makeManager()
        await XCTAssertThrowsAsync(
            { try await manager.signIn(email: "x@y.com", password: "right") },
            expected: .serverError("Please verify your email before signing in.")
        )
        XCTAssertNotNil(
            AuthError.serverError("Please verify your email before signing in.")
                .errorDescription?.range(of: "verify", options: .caseInsensitive),
            "The resend-verification link is gated on this copy containing \"verify\""
        )
    }

    // MARK: - Sign up

    func testSignUpSuccessReturnsRequiresVerification() async throws {
        let payload = """
        {
          "message": "Registration successful. Please verify your email before signing in.",
          "requiresEmailVerification": true,
          "user": {
            "id": "u_new",
            "email": "new@example.com",
            "username": "newuser",
            "name": "New User",
            "firstName": "New",
            "middleName": null,
            "lastName": "User",
            "phoneNumber": null,
            "address": null,
            "city": null,
            "state": null,
            "zipcode": null,
            "accountType": "individual",
            "role": "user",
            "verified": false,
            "createdAt": "2026-05-16T00:00:00Z"
          }
        }
        """
        stub("/api/users/register", status: 201, body: payload)
        let manager = makeManager()

        let result = try await manager.signUp(
            email: "new@example.com",
            password: "verystrong123",
            phoneNumber: nil,
            username: "newuser",
            firstName: "New",
            middleName: nil,
            lastName: "User",
            dateOfBirth: nil,
            address: nil,
            city: nil,
            state: nil,
            zipcode: nil,
            accountType: .personal,
            inviteCode: nil
        )

        XCTAssertEqual(result.user.id, "u_new")
        XCTAssertTrue(result.requiresEmailVerification)
        // Sign-up does not flip state — caller routes to verify-email screen.
        if case .unknown = manager.state { /* pass */ } else {
            XCTFail("Expected state to stay .unknown after sign-up, got \(manager.state)")
        }
    }

    func testSignUpEmailTakenMapsToEmailAlreadyExists() async {
        stub("/api/users/register", status: 400, body: "{\"error\":\"Email already registered\"}")
        let manager = makeManager()
        await XCTAssertThrowsAsync(
            {
                try await manager.signUp(
                    email: "taken@example.com",
                    password: "verystrong123",
                    phoneNumber: nil,
                    username: "taken",
                    firstName: "T",
                    middleName: nil,
                    lastName: "U",
                    dateOfBirth: nil,
                    address: nil,
                    city: nil,
                    state: nil,
                    zipcode: nil,
                    accountType: .personal,
                    inviteCode: nil
                )
            },
            expected: .emailAlreadyExists
        )
    }

    // MARK: - Forgot / reset / verify

    func testForgotPasswordSuccessSwallowsGenericResponse() async throws {
        stub(
            "/api/users/forgot-password",
            status: 200,
            body: "{\"message\":\"If that email exists, a password reset link has been sent.\"}"
        )
        let manager = makeManager()
        try await manager.forgotPassword(email: "alice@example.com")
    }

    func testForgotPasswordOffline_MapsToNetworkError() async {
        // No stubbed response -> SequencedURLProtocol returns 599 which the
        // client surfaces as APIError.server. Map -> .serverError.
        // Use a route stub that returns 503 to assert .serverError path
        // distinctly from .networkError (which needs a real transport fail).
        stub("/api/users/forgot-password", status: 503, body: "{\"error\":\"unavailable\"}")
        let manager = makeManager()
        do {
            try await manager.forgotPassword(email: "alice@example.com")
            XCTFail("Expected throw")
        } catch let error as AuthError {
            guard case .serverError = error else {
                return XCTFail("Expected .serverError, got \(error)")
            }
        } catch {
            XCTFail("Expected AuthError, got \(error)")
        }
    }

    func testResetPasswordInvalidTokenMapsToServerError() async {
        stub(
            "/api/users/reset-password",
            status: 400,
            body: "{\"error\":\"Invalid or expired reset token\"}"
        )
        let manager = makeManager()
        do {
            try await manager.resetPassword(token: "stale", newPassword: "newstrong123")
            XCTFail("Expected throw")
        } catch let error as AuthError {
            guard case let .serverError(message) = error else {
                return XCTFail("Expected .serverError, got \(error)")
            }
            XCTAssertEqual(message, "Invalid or expired reset token")
        } catch {
            XCTFail("Expected AuthError, got \(error)")
        }
    }

    func testVerifyEmailSuccess() async throws {
        stub(
            "/api/users/verify-email",
            status: 200,
            body: "{\"message\":\"Email verified successfully. You can now sign in.\",\"verified\":true}"
        )
        let manager = makeManager()
        try await manager.verifyEmail(token: "hashed-token")
    }

    func testVerifyEmailInvalidLinkMapsToServerError() async {
        stub(
            "/api/users/verify-email",
            status: 400,
            body: "{\"error\":\"Invalid or expired verification link/code\"}"
        )
        let manager = makeManager()
        do {
            try await manager.verifyEmail(token: "bad")
            XCTFail("Expected throw")
        } catch let error as AuthError {
            guard case .serverError = error else {
                return XCTFail("Expected .serverError, got \(error)")
            }
        } catch {
            XCTFail("Expected AuthError, got \(error)")
        }
    }

    func testResendVerificationSuccess() async throws {
        stub(
            "/api/users/resend-verification",
            status: 200,
            body: "{\"message\":\"If that email exists, a verification email has been sent.\"}"
        )
        let manager = makeManager()
        try await manager.resendVerification(email: "alice@example.com")
    }

    // MARK: - Refresh

    func testRefreshSessionSuccessUpdatesAccessToken() async throws {
        let store = InMemorySecureStore()
        try store.set("old-at", for: SecureStoreKey.accessToken)
        try store.set("rt-current", for: SecureStoreKey.refreshToken)
        stub(
            "/api/users/refresh",
            status: 200,
            body: "{\"ok\":true,\"accessToken\":\"new-at\",\"refreshToken\":\"new-rt\",\"expiresIn\":3600,\"expiresAt\":1800000000}"
        )
        let manager = makeManager(store: store)

        try await manager.refreshSession()

        XCTAssertEqual(manager.accessToken, "new-at")
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "new-at")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "new-rt")
    }

    func testRefreshSession401SignsOut() async {
        let store = InMemorySecureStore()
        try? store.set("stale-at", for: SecureStoreKey.accessToken)
        try? store.set("stale-rt", for: SecureStoreKey.refreshToken)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Session expired\"}")
        let manager = makeManager(store: store)

        do {
            try await manager.refreshSession()
            XCTFail("Expected throw")
        } catch is AuthError {
            // expected
        } catch {
            XCTFail("Expected AuthError, got \(error)")
        }
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut after refresh failure, got \(manager.state)")
        }
    }
}

// MARK: - Async throws helper

func XCTAssertThrowsAsync(
    _ expression: () async throws -> some Any,
    expected: AuthError,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("Expected throw \(expected)", file: file, line: line)
    } catch let error as AuthError {
        XCTAssertEqual(error, expected, file: file, line: line)
    } catch {
        XCTFail("Expected AuthError.\(expected), got \(error)", file: file, line: line)
    }
}
