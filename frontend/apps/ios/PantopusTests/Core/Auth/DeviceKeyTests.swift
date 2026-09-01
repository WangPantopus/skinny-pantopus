//
//  DeviceKeyTests.swift
//  PantopusTests
//
//  Software-backed device key + device identity (the Secure Enclave path
//  is hardware-only; the software fallback shares every code path except
//  key construction). Uses `InMemorySecureStore` — nothing touches the
//  Keychain.
//

import CryptoKit
import XCTest
@testable import Pantopus

final class DeviceKeyTests: XCTestCase {
    func testCreateSoftwareKeyPersistsBlobAndBacking() throws {
        let store = InMemorySecureStore()
        let key = try DeviceKey.create(in: store, allowSecureEnclave: false)

        XCTAssertEqual(key.backing, .software)
        XCTAssertEqual(store.get(SecureStoreKey.deviceKeyBacking), "software")
        let blob = try XCTUnwrap(store.getData(SecureStoreKey.deviceKey))
        XCTAssertEqual(blob.count, 32, "raw P-256 private scalar")
    }

    func testLoadRoundTripsThePublicKeyAndSigns() throws {
        let store = InMemorySecureStore()
        let created = try DeviceKey.create(in: store, allowSecureEnclave: false)
        let loaded = try DeviceKey.load(from: store)

        XCTAssertEqual(loaded.jwk, created.jwk)
        XCTAssertEqual(loaded.thumbprint, created.thumbprint)
        XCTAssertEqual(loaded.backing, .software)

        let message = Data("hello".utf8)
        let raw = try loaded.sign(message)
        XCTAssertEqual(raw.count, 64, "raw r || s")
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: raw)
        XCTAssertTrue(created.publicKey.isValidSignature(signature, for: message))
    }

    func testLoadMissingThrowsMissing() {
        let store = InMemorySecureStore()
        XCTAssertThrowsError(try DeviceKey.load(from: store)) { error in
            XCTAssertEqual(error as? DeviceKey.LoadError, .missing)
        }
    }

    func testLoadCorruptBlobThrowsUndecodable() throws {
        let store = InMemorySecureStore()
        try store.setData(Data([0x01, 0x02, 0x03]), for: SecureStoreKey.deviceKey)
        try store.set("software", for: SecureStoreKey.deviceKeyBacking)
        XCTAssertThrowsError(try DeviceKey.load(from: store)) { error in
            XCTAssertEqual(error as? DeviceKey.LoadError, .undecodable)
        }
    }

    func testDeleteRemovesBothItems() throws {
        let store = InMemorySecureStore()
        _ = try DeviceKey.create(in: store, allowSecureEnclave: false)
        DeviceKey.delete(from: store)
        XCTAssertNil(store.getData(SecureStoreKey.deviceKey))
        XCTAssertNil(store.get(SecureStoreKey.deviceKeyBacking))
    }

    // MARK: - DeviceIdentity

    func testLoadOrCreateMintsThenReloadsTheSameIdentity() throws {
        let store = InMemorySecureStore()
        let first = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        XCTAssertTrue(first.isNew)
        XCTAssertEqual(first.deviceId, store.get(SecureStoreKey.deviceId))
        XCTAssertNotNil(UUID(uuidString: first.deviceId), "deviceId is a UUID")
        XCTAssertEqual(first.deviceId, first.deviceId.lowercased())

        let second = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        XCTAssertFalse(second.isNew)
        XCTAssertEqual(second.deviceId, first.deviceId)
        XCTAssertEqual(second.key.thumbprint, first.key.thumbprint)
    }

    func testLoadReturnsNilWhenOnlyHalfTheIdentityExists() throws {
        let store = InMemorySecureStore()
        try store.set("some-device-id", for: SecureStoreKey.deviceId)
        XCTAssertNil(DeviceIdentity.load(from: store), "a deviceId without a key is not an identity")

        // And an undecodable key with a deviceId regenerates both halves.
        try store.setData(Data([0xFF]), for: SecureStoreKey.deviceKey)
        try store.set("software", for: SecureStoreKey.deviceKeyBacking)
        let regenerated = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        XCTAssertTrue(regenerated.isNew)
        XCTAssertNotEqual(regenerated.deviceId, "some-device-id")
    }

    func testRegenerateReplacesDeviceIdAndKey() throws {
        let store = InMemorySecureStore()
        let first = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        let second = try DeviceIdentity.regenerate(in: store, allowSecureEnclave: false)
        XCTAssertNotEqual(first.deviceId, second.deviceId)
        XCTAssertNotEqual(first.key.thumbprint, second.key.thumbprint)
        XCTAssertEqual(DeviceIdentity.load(from: store)?.deviceId, second.deviceId)
    }
}
