//
//  DeviceKey.swift
//  Pantopus
//
//  The long-lived P-256 signing key that proves "this request comes from
//  the device the session was issued to" (DPoP, RFC 9449). Created once,
//  wrapped by the Secure Enclave, and stored as an opaque blob in the
//  Keychain so it survives an app delete + reinstall together with the
//  refresh token. Deliberately NOT biometry-gated: background refresh,
//  push-triggered fetches and socket reconnects must keep working — user
//  presence is a separate concern (`StepUpKey`).
//
//  Design: docs/persistent-login/persistent-login-design-2026-08-18.md §8;
//  wire shape: docs/persistent-login/CONTRACT.md ("Headers" / DPoP).
//

import CryptoKit
import Foundation

/// Where the private key material lives. Sent to the server as
/// `device.keyBacking` (contract: `secure_enclave|strongbox|tee|software`).
public enum DeviceKeyBacking: String, Sendable, Hashable {
    case secureEnclave = "secure_enclave"
    case software
}

/// RFC 7517 JSON Web Key for a P-256 public key — the exact shape embedded
/// in the DPoP JWT header (`{"kty":"EC","crv":"P-256","x":…,"y":…}`) and
/// posted to `/api/auth/step-up-key`.
public struct JWK: Codable, Sendable, Hashable {
    public let kty: String
    public let crv: String
    public let x: String
    public let y: String

    public init(kty: String = "EC", crv: String = "P-256", x: String, y: String) {
        self.kty = kty
        self.crv = crv
        self.x = x
        self.y = y
    }

    /// Build from an X9.63 (`0x04 || X || Y`) uncompressed point.
    init(p256PublicKey key: P256.Signing.PublicKey) {
        let x963 = key.x963Representation
        // 65 bytes: 1 prefix + 32 X + 32 Y.
        let xBytes = x963.subdata(in: 1..<33)
        let yBytes = x963.subdata(in: 33..<65)
        self.init(x: Base64URL.encode(xBytes), y: Base64URL.encode(yBytes))
    }

    /// RFC 7638 thumbprint: SHA-256 over the canonical JSON
    /// `{"crv":"P-256","kty":"EC","x":"…","y":"…"}` (members in lexicographic
    /// order, no whitespace), base64url without padding. Matches what the
    /// backend computes and stores as `AuthDevice.key_thumbprint`.
    public var thumbprint: String {
        let canonical = "{\"crv\":\"\(crv)\",\"kty\":\"\(kty)\",\"x\":\"\(x)\",\"y\":\"\(y)\"}"
        let digest = SHA256.hash(data: Data(canonical.utf8))
        return Base64URL.encode(Data(digest))
    }
}

/// Anything that can sign a DPoP proof: the production `DeviceKey` and
/// software keys used by tests.
protocol DPoPSigner {
    var jwk: JWK { get }
    /// ECDSA P-256 / SHA-256 signature over `data`, returned as the raw
    /// 64-byte `r || s` concatenation (JWS format — NOT DER).
    func sign(_ data: Data) throws -> Data
}

/// Base64url (RFC 4648 §5) without padding — used everywhere a JWT is
/// assembled or a binary challenge is exchanged.
enum Base64URL {
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decode(_ string: String) -> Data? {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}

/// The device's DPoP key. Either a Secure Enclave key (hardware-bound; the
/// Keychain blob is useless off this device) or, where no Secure Enclave
/// exists (older Simulators), a software P-256 key whose raw representation
/// is stored in the same Keychain item. The server learns which through
/// `keyBacking` and grades trust accordingly.
enum DeviceKey: DPoPSigner {
    case secureEnclave(SecureEnclave.P256.Signing.PrivateKey)
    case software(P256.Signing.PrivateKey)

    /// Errors surfaced to callers that must decide between "regenerate" and
    /// "give up" (`AuthManager` regenerates + falls back to L3).
    enum LoadError: Error, Equatable {
        /// Nothing stored (first run, or the Keychain was cleared).
        case missing
        /// A blob is stored but the Secure Enclave / CryptoKit refuses it —
        /// e.g. the item was restored to a different device.
        case undecodable
    }

    var backing: DeviceKeyBacking {
        switch self {
        case .secureEnclave: .secureEnclave
        case .software: .software
        }
    }

    var publicKey: P256.Signing.PublicKey {
        switch self {
        case let .secureEnclave(key): key.publicKey
        case let .software(key): key.publicKey
        }
    }

    var jwk: JWK {
        JWK(p256PublicKey: publicKey)
    }

    var thumbprint: String {
        jwk.thumbprint
    }

    /// Raw `r || s` (64 bytes) — exactly what the JWS `ES256` algorithm and
    /// the backend's `jose` verifier expect.
    func sign(_ data: Data) throws -> Data {
        switch self {
        case let .secureEnclave(key): try key.signature(for: data).rawRepresentation
        case let .software(key): try key.signature(for: data).rawRepresentation
        }
    }

    /// The Keychain blob to persist under `SecureStoreKey.deviceKey`.
    var storedRepresentation: Data {
        switch self {
        case let .secureEnclave(key): key.dataRepresentation
        case let .software(key): key.rawRepresentation
        }
    }

    // MARK: - Persistence

    /// Load the stored key. Throws `.missing` when no blob exists and
    /// `.undecodable` when the blob cannot be reconstituted (which the
    /// caller must treat as "this device no longer owns that identity").
    static func load(from store: any SecureStore) throws -> DeviceKey {
        guard let blob = store.getData(SecureStoreKey.deviceKey), !blob.isEmpty else {
            throw LoadError.missing
        }
        let backing = store.get(SecureStoreKey.deviceKeyBacking)
            .flatMap(DeviceKeyBacking.init(rawValue:)) ?? .secureEnclave
        do {
            switch backing {
            case .secureEnclave:
                return try .secureEnclave(SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob))
            case .software:
                return try .software(P256.Signing.PrivateKey(rawRepresentation: blob))
            }
        } catch {
            throw LoadError.undecodable
        }
    }

    /// Generate a fresh key (Secure Enclave when available and permitted,
    /// software otherwise) and persist it. Callers pair this with a fresh
    /// `deviceId` — see `DeviceIdentity.regenerate`.
    static func create(in store: any SecureStore, allowSecureEnclave: Bool = SecureEnclave.isAvailable) throws -> DeviceKey {
        let key: DeviceKey = if allowSecureEnclave, let enclave = try? SecureEnclave.P256.Signing.PrivateKey() {
            .secureEnclave(enclave)
        } else {
            .software(P256.Signing.PrivateKey())
        }
        try store.setData(key.storedRepresentation, for: SecureStoreKey.deviceKey)
        try store.set(key.backing.rawValue, for: SecureStoreKey.deviceKeyBacking)
        return key
    }

    static func delete(from store: any SecureStore) {
        try? store.delete(SecureStoreKey.deviceKey)
        try? store.delete(SecureStoreKey.deviceKeyBacking)
    }
}

/// `deviceId` + `DeviceKey` — always created and replaced together.
struct DeviceIdentity {
    let deviceId: String
    let key: DeviceKey
    /// True when this call minted the identity (nothing usable was stored).
    let isNew: Bool

    /// Load the stored identity, or mint a new one when the key is missing
    /// or undecodable. A missing key with a leftover `deviceId` is treated
    /// as "no identity" — the server keys `AuthDevice` on the pair.
    static func loadOrCreate(
        in store: any SecureStore,
        allowSecureEnclave: Bool = SecureEnclave.isAvailable
    ) throws -> DeviceIdentity {
        if let existing = load(from: store) {
            return existing
        }
        return try regenerate(in: store, allowSecureEnclave: allowSecureEnclave)
    }

    /// The stored identity, if both halves are present and usable.
    static func load(from store: any SecureStore) -> DeviceIdentity? {
        guard let deviceId = store.get(SecureStoreKey.deviceId), !deviceId.isEmpty,
              let key = try? DeviceKey.load(from: store) else {
            return nil
        }
        return DeviceIdentity(deviceId: deviceId, key: key, isNew: false)
    }

    /// Mint a new `deviceId` + key, replacing whatever was stored.
    static func regenerate(
        in store: any SecureStore,
        allowSecureEnclave: Bool = SecureEnclave.isAvailable
    ) throws -> DeviceIdentity {
        DeviceKey.delete(from: store)
        let key = try DeviceKey.create(in: store, allowSecureEnclave: allowSecureEnclave)
        let deviceId = UUID().uuidString.lowercased()
        try store.set(deviceId, for: SecureStoreKey.deviceId)
        return DeviceIdentity(deviceId: deviceId, key: key, isNew: true)
    }

    static func delete(from store: any SecureStore) {
        DeviceKey.delete(from: store)
        try? store.delete(SecureStoreKey.deviceId)
    }
}
