//
//  AppLockPreferenceTests.swift
//  PantopusTests
//
//  The whole-app lock's preference lives in the Keychain (it must survive a
//  reinstall — design §8). The old "sensitive actions" switch's settings are
//  dropped. Uses a throw-away defaults suite and the in-memory secure store;
//  never touches the real Keychain.
//

import XCTest
@testable import Pantopus

@MainActor
final class AppLockPreferenceTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!
    private var store: InMemorySecureStore!

    override func setUpWithError() throws {
        try super.setUpWithError()
        suiteName = "app-lock-pref-tests-\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        store = InMemorySecureStore()
    }

    override func tearDownWithError() throws {
        defaults.removePersistentDomain(forName: suiteName)
        try super.tearDownWithError()
    }

    private func makeManager() -> AppLockManager {
        AppLockManager(defaults: defaults, secureStore: store)
    }

    func testDefaultIsOffAndWritesNothing() {
        let manager = makeManager()
        XCTAssertFalse(manager.isEnabled(forUserID: "u_1"))
        XCTAssertNil(store.get(SecureStoreKey.appLockOnLeave("u_1")))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
    }

    func testOldSwitchNoLongerLocksTheAppAndIsForgotten() throws {
        try store.set("1", for: SecureStoreKey.retiredAppLockEnabled("u_1"))
        defaults.set(true, forKey: "appLock.u_1.enabled")
        defaults.set("enabled", forKey: "appLock.u_1.setupPrompt")
        let manager = makeManager()

        manager.configure(userID: "u_1")

        XCTAssertFalse(manager.preferenceEnabled)
        XCTAssertFalse(manager.isLocked)
        XCTAssertNil(store.get(SecureStoreKey.retiredAppLockEnabled("u_1")))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.setupPrompt"))
    }

    func testKeychainValueIsPerUser() throws {
        try store.set("1", for: SecureStoreKey.appLockOnLeave("u_1"))
        let manager = makeManager()
        XCTAssertTrue(manager.isEnabled(forUserID: "u_1"))
        XCTAssertFalse(manager.isEnabled(forUserID: "u_2"))
        XCTAssertEqual(SecureStoreKey.appLockOnLeave("u_1"), "appLockOnLeave.u_1", "CONTRACT client storage key")
    }

    func testClearPreferenceRemovesEveryCopy() throws {
        try store.set("1", for: SecureStoreKey.appLockOnLeave("u_1"))
        try store.set("1", for: SecureStoreKey.retiredAppLockEnabled("u_1"))
        defaults.set(true, forKey: "appLock.u_1.enabled")
        let manager = makeManager()

        manager.clearPreference(forUserID: "u_1")

        XCTAssertNil(store.get(SecureStoreKey.appLockOnLeave("u_1")))
        XCTAssertNil(store.get(SecureStoreKey.retiredAppLockEnabled("u_1")))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
        XCTAssertFalse(manager.isEnabled(forUserID: "u_1"))
    }
}
