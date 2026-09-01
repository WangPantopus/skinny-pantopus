//
//  AppLockPreferenceTests.swift
//  PantopusTests
//
//  The app-lock `enabled` preference now lives in the Keychain (it must
//  survive a reinstall — design §8), with a one-time migration from the
//  legacy `UserDefaults` key. Uses a throw-away defaults suite and the
//  in-memory secure store; never touches the real Keychain.
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
        XCTAssertNil(store.get(SecureStoreKey.appLockEnabled("u_1")))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
    }

    func testLegacyUserDefaultsValueIsMigratedIntoTheKeychainOnce() {
        defaults.set(true, forKey: "appLock.u_1.enabled")
        let manager = makeManager()

        XCTAssertTrue(manager.isEnabled(forUserID: "u_1"))
        XCTAssertEqual(store.get(SecureStoreKey.appLockEnabled("u_1")), "1", "copied into the Keychain")
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"), "legacy copy removed")

        // A later legacy write (older build downgrade) no longer wins.
        defaults.set(false, forKey: "appLock.u_1.enabled")
        XCTAssertTrue(manager.isEnabled(forUserID: "u_1"), "the Keychain is the single source of truth")
    }

    func testLegacyFalseIsMigratedAsFalse() {
        defaults.set(false, forKey: "appLock.u_1.enabled")
        let manager = makeManager()
        XCTAssertFalse(manager.isEnabled(forUserID: "u_1"))
        XCTAssertEqual(store.get(SecureStoreKey.appLockEnabled("u_1")), "0")
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
    }

    func testKeychainValueIsPerUser() throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("u_1"))
        let manager = makeManager()
        XCTAssertTrue(manager.isEnabled(forUserID: "u_1"))
        XCTAssertFalse(manager.isEnabled(forUserID: "u_2"))
        XCTAssertEqual(SecureStoreKey.appLockEnabled("u_1"), "appLockEnabled.u_1", "CONTRACT client storage key")
    }

    func testClearPreferenceRemovesBothCopies() throws {
        try store.set("1", for: SecureStoreKey.appLockEnabled("u_1"))
        defaults.set(true, forKey: "appLock.u_1.enabled")
        let manager = makeManager()

        manager.clearPreference(forUserID: "u_1")

        XCTAssertNil(store.get(SecureStoreKey.appLockEnabled("u_1")))
        XCTAssertNil(defaults.object(forKey: "appLock.u_1.enabled"))
        XCTAssertFalse(manager.isEnabled(forUserID: "u_1"))
    }
}
