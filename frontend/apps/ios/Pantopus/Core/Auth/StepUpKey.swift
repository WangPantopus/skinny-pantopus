//
//  StepUpKey.swift
//  Pantopus
//
//  Biometry-bound Secure Enclave key used for the `device_key` step-up
//  method (`POST /api/auth/step-up`). Unlike `DeviceKey`, every signature
//  requires user presence — the enclave itself refuses to sign until the
//  LAContext has been satisfied, so presence is server-verifiable (a
//  cryptographic fact, not a client boolean). `.biometryCurrentSet`
//  invalidates the key when biometrics are re-enrolled, so a thief who adds
//  their face cannot inherit it; devices without enrolled biometrics get a
//  `.userPresence` (passcode) key instead. No Secure Enclave ⇒ no step-up
//  key: the caller falls back to the password method.
//
//  Design: docs/persistent-login/persistent-login-design-2026-08-18.md §2.5, §8.
//

import CryptoKit
import Foundation
import LocalAuthentication

/// Which access-control policy the stored key was created with.
public enum StepUpKeyPolicy: String, Sendable, Hashable {
    /// `.privateKeyUsage | .biometryCurrentSet` — Face ID / Touch ID only.
    case biometryCurrentSet = "biometry_current_set"
    /// `.privateKeyUsage | .userPresence` — biometrics or device passcode.
    case userPresence = "user_presence"
}

enum StepUpKeyError: Error, Equatable {
    /// No Secure Enclave on this hardware — enrol nothing.
    case unavailable
    /// No key stored for this device.
    case notEnrolled
    /// The stored blob no longer decodes / signs (biometric re-enrolment
    /// with `.biometryCurrentSet`, or the item came from another device).
    /// The caller clears it and falls back to password step-up.
    case invalidated
    /// The user dismissed the presence prompt.
    case cancelled
    /// Any other Security / CryptoKit failure.
    case failed(String)
}

/// Stateless facade over the stored step-up key. Blob + policy live in the
/// Keychain (`SecureStoreKey.stepUpKey` / `.stepUpKeyPolicy`).
enum StepUpKey {
    /// A step-up key can only exist on Secure Enclave hardware.
    static var isSupported: Bool {
        SecureEnclave.isAvailable
    }

    /// Public half + policy of the enrolled key, for `/api/auth/step-up-key`.
    struct PublicInfo: Hashable {
        let jwk: JWK
        let policy: StepUpKeyPolicy
        /// Contract `keyBacking` value — always Secure Enclave for this key.
        var keyBacking: String {
            DeviceKeyBacking.secureEnclave.rawValue
        }
    }

    static func exists(in store: any SecureStore) -> Bool {
        guard let blob = store.getData(SecureStoreKey.stepUpKey) else { return false }
        return !blob.isEmpty
    }

    /// Create (or replace) the key. Creation never prompts — only signing
    /// does. Prefers `.biometryCurrentSet`; when biometrics are not enrolled
    /// (or the enclave rejects that flag) falls back to `.userPresence`.
    @discardableResult
    static func create(in store: any SecureStore) throws -> PublicInfo {
        guard isSupported else { throw StepUpKeyError.unavailable }
        let policies: [StepUpKeyPolicy] = biometricsEnrolled() ? [.biometryCurrentSet, .userPresence] : [.userPresence]
        var lastError: (any Error)?
        for policy in policies {
            do {
                let control = try accessControl(for: policy)
                let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: control)
                try store.setData(key.dataRepresentation, for: SecureStoreKey.stepUpKey)
                try store.set(policy.rawValue, for: SecureStoreKey.stepUpKeyPolicy)
                return PublicInfo(jwk: JWK(p256PublicKey: key.publicKey), policy: policy)
            } catch {
                lastError = error
            }
        }
        throw StepUpKeyError.failed(lastError.map { "\($0)" } ?? "Secure Enclave key creation failed")
    }

    /// Public info of the stored key without prompting (public keys are
    /// readable without satisfying the access control).
    static func publicInfo(in store: any SecureStore) throws -> PublicInfo {
        let (blob, policy) = try storedBlob(in: store)
        do {
            let key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
            return PublicInfo(jwk: JWK(p256PublicKey: key.publicKey), policy: policy)
        } catch {
            throw StepUpKeyError.invalidated
        }
    }

    /// Sign `challenge` behind the OS presence prompt. Runs off the main
    /// actor because the enclave blocks the calling thread while the sheet
    /// is up. Returns raw `r || s` (64 bytes) — the server verifies ES256
    /// over the raw challenge bytes.
    static func sign(_ challenge: Data, reason: String, in store: any SecureStore) async throws -> Data {
        let (blob, _) = try storedBlob(in: store)
        return try await Task.detached(priority: .userInitiated) {
            let context = LAContext()
            context.localizedReason = reason
            let key: SecureEnclave.P256.Signing.PrivateKey
            do {
                key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob, authenticationContext: context)
            } catch {
                throw StepUpKeyError.invalidated
            }
            do {
                return try key.signature(for: challenge).rawRepresentation
            } catch let error as LAError where [.userCancel, .systemCancel, .appCancel].contains(error.code) {
                throw StepUpKeyError.cancelled
            } catch {
                throw Self.classify(error)
            }
        }.value
    }

    static func delete(from store: any SecureStore) {
        try? store.delete(SecureStoreKey.stepUpKey)
        try? store.delete(SecureStoreKey.stepUpKeyPolicy)
        try? store.delete(SecureStoreKey.stepUpKeyEnrolledUserId)
    }

    // MARK: - Internals

    private static func storedBlob(in store: any SecureStore) throws -> (Data, StepUpKeyPolicy) {
        guard let blob = store.getData(SecureStoreKey.stepUpKey), !blob.isEmpty else {
            throw StepUpKeyError.notEnrolled
        }
        let policy = store.get(SecureStoreKey.stepUpKeyPolicy)
            .flatMap(StepUpKeyPolicy.init(rawValue:)) ?? .userPresence
        return (blob, policy)
    }

    private static func biometricsEnrolled() -> Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    private static func accessControl(for policy: StepUpKeyPolicy) throws -> SecAccessControl {
        let flags: SecAccessControlCreateFlags = switch policy {
        case .biometryCurrentSet: [.privateKeyUsage, .biometryCurrentSet]
        case .userPresence: [.privateKeyUsage, .userPresence]
        }
        var error: Unmanaged<CFError>?
        guard let control = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            &error
        ) else {
            throw StepUpKeyError.failed(error?.takeRetainedValue().localizedDescription ?? "SecAccessControl failed")
        }
        return control
    }

    private static func classify(_ error: any Error) -> StepUpKeyError {
        let nsError = error as NSError
        // errSecUserCanceled / LAError cancellations surface through the
        // Security layer with these codes when the enclave sheet is dismissed.
        if nsError.domain == NSOSStatusErrorDomain, nsError.code == Int(errSecUserCanceled) {
            return .cancelled
        }
        if nsError.domain == LAErrorDomain,
           let code = LAError.Code(rawValue: nsError.code),
           [.userCancel, .systemCancel, .appCancel].contains(code) {
            return .cancelled
        }
        // Biometric re-enrolment with `.biometryCurrentSet` makes the key
        // permanently unusable; the Security layer reports it as
        // errSecAuthFailed / errSecItemNotFound-style failures.
        if nsError.domain == NSOSStatusErrorDomain,
           [Int(errSecAuthFailed), Int(errSecItemNotFound), Int(errSecInvalidKeyRef)].contains(nsError.code) {
            return .invalidated
        }
        return .failed(nsError.localizedDescription)
    }
}
