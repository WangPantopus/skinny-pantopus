import LocalAuthentication
import XCTest
@testable import Pantopus

@MainActor
final class SensitiveScreenAuthenticationTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suite: String!
    private var store: InMemorySecureStore!
    private var context: StubAuthenticationContext!
    private var manager: AppLockManager!

    override func setUpWithError() throws {
        suite = "sensitive-auth-\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        store = InMemorySecureStore()
        context = StubAuthenticationContext()
        let context = try XCTUnwrap(context)
        manager = AppLockManager(defaults: defaults, secureStore: store) { context }
    }

    override func tearDownWithError() throws {
        defaults.removePersistentDomain(forName: suite)
    }

    func testUnavailableAuthenticationNeverOpensMoneyScreen() async {
        for code in [LAError.Code.invalidContext, .biometryNotAvailable, .biometryNotEnrolled, .biometryLockout, .notInteractive] {
            context.capabilityError = code
            let result = await manager.verifySensitiveScreen(reason: "Payments")
            guard case .failed = result else { return XCTFail("Opened screen after \(code)") }
        }
        XCTAssertEqual(context.promptCount, 0)
    }

    func testUnknownCapabilityFailureRemainsProtected() async {
        context.canAuthenticate = false
        let result = await manager.verifySensitiveScreen(reason: "Payments")
        XCTAssertEqual(result, .failed(message: "Authentication unavailable"))
    }

    func testExplicitNoPasscodeKeepsExistingNoCredentialJourney() async {
        context.capabilityError = .passcodeNotSet
        let screen = await manager.verifySensitiveScreen(reason: "Payments")
        let action = await manager.verifySensitiveAction(reason: "Confirm")
        XCTAssertEqual(screen, .verified)
        XCTAssertEqual(action, .verified)
        XCTAssertEqual(context.promptCount, 0)
        XCTAssertFalse(manager.isWithinSensitiveGracePeriod())
    }

    func testSuccessfulPromptAllowsNextScreenInsideGrace() async {
        let first = await manager.verifySensitiveScreen(reason: "Wallet")
        let second = await manager.verifySensitiveScreen(reason: "Payments")
        XCTAssertEqual(first, .verified)
        XCTAssertEqual(second, .verified)
        XCTAssertEqual(context.promptCount, 1)
    }

    func testGraceDoesNotHideNewCapabilityError() async {
        _ = await manager.verifySensitiveScreen(reason: "Wallet")
        context.capabilityError = .invalidContext
        let result = await manager.verifySensitiveScreen(reason: "Payments")
        XCTAssertEqual(result, .failed(message: "Authentication unavailable"))
    }

    func testCancelledOrFailedPromptDoesNotEarnGrace() async {
        for code in [LAError.Code.userCancel, .authenticationFailed] {
            context.promptError = code
            let result = await manager.verifySensitiveScreen(reason: "Payments")
            XCTAssertNotEqual(result, .verified)
            XCTAssertFalse(manager.isWithinSensitiveGracePeriod())
        }
        XCTAssertEqual(context.promptCount, 2)
    }

    func testAccountChangeRequiresItsOwnVerification() async {
        manager.configure(userID: "first")
        _ = await manager.verifySensitiveScreen(reason: "Wallet")
        manager.configure(userID: "second")
        XCTAssertFalse(manager.isWithinSensitiveGracePeriod())
        _ = await manager.verifySensitiveScreen(reason: "Payments")
        XCTAssertEqual(context.promptCount, 2)
    }

    func testTransientCapabilityFailurePreservesStoredAppLock() throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("first"))
        context.capabilityError = .invalidContext
        manager.configure(userID: "first")
        XCTAssertTrue(manager.preferenceEnabled)
        XCTAssertTrue(manager.isLocked)
        XCTAssertEqual(store.get(SecureStoreKey.appLockEnabled("first")), "1")
    }

    func testConfirmedCredentialRemovalKeepsExistingAppLockPolicy() throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("first"))
        context.capabilityError = .passcodeNotSet
        manager.configure(userID: "first")
        XCTAssertFalse(manager.preferenceEnabled)
        XCTAssertFalse(manager.isLocked)
    }

    func testDelayedPromptCannotUnlockAnotherAccount() async throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("first"))
        try store.set("1", for: SecureStoreKey.appLockEnabled("second"))
        manager.configure(userID: "first")
        let started = expectation(description: "Unlock prompt started")
        context.onPrompt = { started.fulfill() }
        context.deferReply = true
        let operation = Task { await manager.unlockIfNeeded() }
        await fulfillment(of: [started], timeout: 2)
        manager.configure(userID: "second")
        context.completePrompt()
        await operation.value
        XCTAssertTrue(manager.isLocked)
        XCTAssertTrue(manager.preferenceEnabled)
        XCTAssertNil(defaults.object(forKey: "appLock.second.unlockedAt"))
    }

    func testDelayedEnableCannotChangeAnotherAccountsPreference() async throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("second"))
        manager.configure(userID: "first")
        let started = expectation(description: "Enable prompt started")
        context.onPrompt = { started.fulfill() }
        context.deferReply = true
        let operation = Task { await manager.setEnabled(true, source: .postLoginPrompt) }
        await fulfillment(of: [started], timeout: 2)
        manager.configure(userID: "second")
        context.completePrompt()
        let result = await operation.value
        XCTAssertFalse(result)
        XCTAssertTrue(manager.isLocked)
        XCTAssertTrue(manager.preferenceEnabled)
        XCTAssertNil(store.get(SecureStoreKey.appLockEnabled("first")))
        XCTAssertEqual(manager.setupPromptState, .enabled)
    }

    func testOldPromptErrorCannotDisableAnotherAccountsLock() async throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("first"))
        try store.set("1", for: SecureStoreKey.appLockEnabled("second"))
        manager.configure(userID: "first")
        let started = expectation(description: "Old prompt started")
        context.onPrompt = { started.fulfill() }
        context.deferReply = true
        let operation = Task { await manager.unlockIfNeeded() }
        await fulfillment(of: [started], timeout: 2)
        manager.configure(userID: "second")
        context.completePrompt(error: .passcodeNotSet)
        await operation.value
        XCTAssertTrue(manager.isLocked)
        XCTAssertTrue(manager.preferenceEnabled)
        XCTAssertEqual(store.get(SecureStoreKey.appLockEnabled("second")), "1")
    }

    func testLogoutDiscardsPendingVerificationResult() async {
        manager.configure(userID: "first")
        let started = expectation(description: "Sensitive prompt started")
        context.onPrompt = { started.fulfill() }
        context.deferReply = true
        let operation = Task { await manager.verifySensitiveAction(reason: "Withdraw") }
        await fulfillment(of: [started], timeout: 2)
        manager.clearTransientState()
        context.completePrompt()
        let result = await operation.value
        guard case .failed = result else { return XCTFail("Accepted a previous account's prompt") }
        XCTAssertFalse(manager.isWithinSensitiveGracePeriod())
        XCTAssertFalse(manager.preferenceEnabled)
    }

    func testDelayedPresenceCannotVerifyAnotherAccount() async {
        manager.configure(userID: "first")
        let started = expectation(description: "Presence prompt started")
        context.onPrompt = { started.fulfill() }
        context.deferReply = true
        let operation = Task { await manager.verifyPresence(reason: "Continue") }
        await fulfillment(of: [started], timeout: 2)
        manager.configure(userID: "second")
        context.completePrompt()
        let result = await operation.value
        guard case .failed = result else { return XCTFail("Accepted a previous account's presence") }
        XCTAssertFalse(manager.isWithinSensitiveGracePeriod())
    }
}

private final class StubAuthenticationContext: LAContext, @unchecked Sendable {
    var canAuthenticate = true
    var capabilityError: LAError.Code?
    var promptError: LAError.Code?
    var promptCount = 0
    var deferReply = false
    var onPrompt: (() -> Void)?
    private var pendingReply: ((Bool, (any Error)?) -> Void)?

    func completePrompt(error: LAError.Code? = nil) {
        let failure = error.map { NSError(domain: LAError.errorDomain, code: $0.rawValue) }
        pendingReply?(failure == nil, failure)
        pendingReply = nil
    }

    override func canEvaluatePolicy(_: LAPolicy, error: NSErrorPointer) -> Bool {
        if let capabilityError {
            error?.pointee = NSError(domain: LAError.errorDomain, code: capabilityError.rawValue)
            return false
        }
        return canAuthenticate
    }

    override func evaluatePolicy(_: LAPolicy, localizedReason _: String, reply: @escaping (Bool, (any Error)?) -> Void) {
        promptCount += 1
        if deferReply {
            pendingReply = reply
            onPrompt?()
            return
        }
        if let promptError {
            reply(false, NSError(domain: LAError.errorDomain, code: promptError.rawValue))
        } else {
            reply(true, nil)
        }
    }
}
