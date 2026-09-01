//
//  InstallMarkerTests.swift
//  PantopusTests
//
//  Reinstall detection: sandbox file vs Keychain mirror (design §3 / §8).
//  Each test gets its own temp directory so the real Application Support
//  folder is never touched.
//

import XCTest
@testable import Pantopus

final class InstallMarkerTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("install-marker-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
        try super.tearDownWithError()
    }

    private func marker() -> InstallMarker {
        InstallMarker(directory: directory)
    }

    func testGenerateInstallIdIsHex32() {
        let id = InstallMarker.generateInstallId()
        XCTAssertEqual(id.count, 32)
        XCTAssertNotNil(id.range(of: "^[0-9a-f]{32}$", options: .regularExpression))
        XCTAssertNotEqual(id, InstallMarker.generateInstallId())
    }

    func testFreshWhenNoRefreshTokenRegardlessOfFile() throws {
        let store = InMemorySecureStore()
        XCTAssertEqual(marker().verdict(store: store), .fresh)
        try marker().writeFile(installId: "abc")
        XCTAssertEqual(marker().verdict(store: store), .fresh)
    }

    func testReinstallWhenTokensSurvivedButFileIsMissing() throws {
        let store = InMemorySecureStore()
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try store.set("0123456789abcdef0123456789abcdef", for: SecureStoreKey.installId)
        XCTAssertEqual(marker().verdict(store: store), .reinstall)
    }

    func testReinstallWhenTokensSurvivedAndNoMarkerAnywhere() throws {
        // Upgrade from a build without the marker, or reinstall of one: the
        // launch is gated once, never silent (design §2.1).
        let store = InMemorySecureStore()
        try store.set("rt", for: SecureStoreKey.refreshToken)
        XCTAssertEqual(marker().verdict(store: store), .reinstall)
    }

    func testSameInstallAfterCommit() throws {
        let store = InMemorySecureStore()
        try store.set("rt", for: SecureStoreKey.refreshToken)
        let id = InstallMarker.generateInstallId()
        marker().commit(installId: id, store: store)

        XCTAssertEqual(marker().readFileInstallId(), id)
        XCTAssertEqual(store.get(SecureStoreKey.installId), id)
        XCTAssertEqual(marker().verdict(store: store), .sameInstall)
    }

    func testMismatchBetweenFileAndKeychainIsReinstall() throws {
        let store = InMemorySecureStore()
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try marker().writeFile(installId: "aaaa")
        try store.set("bbbb", for: SecureStoreKey.installId)
        XCTAssertEqual(marker().verdict(store: store), .reinstall)
    }

    func testFilePresentWithoutKeychainMirrorIsAdoptedAsSameInstall() throws {
        let store = InMemorySecureStore()
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try marker().writeFile(installId: "aaaa")
        XCTAssertEqual(marker().verdict(store: store), .sameInstall)
    }

    func testInstallIdForDescriptorPrefersFileAndNeverWrites() throws {
        let store = InMemorySecureStore()
        try store.set("stale-keychain-id", for: SecureStoreKey.installId)

        // No file: a fresh id is minted (reinstall ⇒ new installId) and
        // nothing is persisted until `commit`.
        let minted = marker().installIdForDescriptor(store: store)
        XCTAssertEqual(minted.count, 32)
        XCTAssertNotEqual(minted, "stale-keychain-id")
        XCTAssertNil(marker().readFileInstallId())
        XCTAssertEqual(store.get(SecureStoreKey.installId), "stale-keychain-id")

        // File present: its id wins.
        try marker().writeFile(installId: "from-file")
        XCTAssertEqual(marker().installIdForDescriptor(store: store), "from-file")
    }

    func testEnsureCommitsAndIsIdempotent() {
        let store = InMemorySecureStore()
        let first = marker().ensure(store: store)
        let second = marker().ensure(store: store)
        XCTAssertEqual(first, second)
        XCTAssertEqual(marker().readFileInstallId(), first)
        XCTAssertEqual(store.get(SecureStoreKey.installId), first)
    }

    func testFileIsExcludedFromBackup() throws {
        try marker().writeFile(installId: "abcd")
        let values = try marker().fileURL.resourceValues(forKeys: [.isExcludedFromBackupKey])
        XCTAssertEqual(values.isExcludedFromBackup, true)
    }
}
