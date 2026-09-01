//
//  KeychainStore.swift
//  Pantopus
//
//  Thin wrapper around KeychainAccess. Used for access + refresh tokens,
//  the device identity (id + Secure Enclave key blob), the install marker
//  mirror and the "remembered accounts" display hints.
//

import Foundation
import KeychainAccess

/// Protocol for testability — swap in an in-memory implementation in tests.
///
/// String items carry tokens / JSON; `Data` items carry opaque key blobs
/// (`SecureEnclave.P256.Signing.PrivateKey.dataRepresentation`) that must
/// round-trip byte-for-byte.
protocol SecureStore: Sendable {
    func set(_ value: String, for key: String) throws
    func get(_ key: String) -> String?
    func delete(_ key: String) throws
    func setData(_ value: Data, for key: String) throws
    func getData(_ key: String) -> Data?
}

/// `@unchecked Sendable` because the underlying `KeychainAccess.Keychain`
/// type isn't `Sendable`-annotated upstream, but all of its mutating
/// operations are gated by the OS keychain (system-locked) — no
/// in-process shared mutable state.
///
/// Accessibility is `afterFirstUnlockThisDeviceOnly` and the items are not
/// synchronizable: readable in the background after first unlock, never
/// copied to iCloud Keychain or to another device via backup — but, in
/// practice, kept on-device across an app delete + reinstall (the design
/// treats that as an accelerator behind an OS-lock gate, never a
/// contract; see `docs/persistent-login/persistent-login-design-2026-08-18.md` §2.8).
struct KeychainStore: SecureStore, @unchecked Sendable {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios") {
        keychain = Keychain(service: service)
            .accessibility(.afterFirstUnlockThisDeviceOnly)
            .synchronizable(false)
    }

    func set(_ value: String, for key: String) throws {
        try keychain.set(value, key: key)
    }

    func get(_ key: String) -> String? {
        try? keychain.get(key)
    }

    func delete(_ key: String) throws {
        try keychain.remove(key)
    }

    func setData(_ value: Data, for key: String) throws {
        try keychain.set(value, key: key)
    }

    func getData(_ key: String) -> Data? {
        try? keychain.getData(key)
    }
}

/// Keychain item names. Pinned by `docs/persistent-login/CONTRACT.md`
/// ("Client storage keys") — renaming any of these orphans the item on
/// devices that already have it.
enum SecureStoreKey {
    static let accessToken = "accessToken"
    static let refreshToken = "refreshToken"
    static let userId = "userId"
    /// JSON snapshot of the last-known `UserDTO`. Lets the app render a
    /// signed-in shell on launch when the network is unreachable, instead
    /// of bouncing the user to the login screen (offline-first parity with
    /// YouTube / Gmail).
    static let cachedUser = "cachedUser"

    // MARK: Device identity (persistent login)

    /// Client-generated UUIDv4 identifying this (user-agnostic) device key.
    /// Regenerated together with `deviceKey` whenever the key is missing or
    /// undecodable — the pair is the identity, never one half alone.
    static let deviceId = "deviceId"
    /// `SecureEnclave.P256.Signing.PrivateKey.dataRepresentation` (Data) —
    /// or the raw software P-256 key on hardware without a Secure Enclave.
    /// Which one it is lives in `deviceKeyBacking`.
    static let deviceKey = "deviceKey"
    /// `DeviceKeyBacking.rawValue` for the blob under `deviceKey`.
    static let deviceKeyBacking = "deviceKeyBacking"
    /// Biometry-gated step-up key blob (Data). Separate from `deviceKey`
    /// because the DPoP key must keep working in the background while this
    /// one must never sign without user presence.
    static let stepUpKey = "stepUpKey"
    /// `StepUpKeyPolicy.rawValue` for the blob under `stepUpKey`.
    static let stepUpKeyPolicy = "stepUpKeyPolicy"
    /// User id the step-up key was enrolled for on the server (via
    /// `POST /api/auth/step-up-key`); nil ⇒ not enrolled.
    static let stepUpKeyEnrolledUserId = "stepUpKeyEnrolledUserId"
    /// Keychain mirror of the install marker file. A file that is missing
    /// or disagrees with this value means the app was reinstalled.
    static let installId = "installId"
    /// Access-token expiry as Unix epoch seconds (string). Drives the
    /// proactive refresh (`expiresAt - now < 120 s`).
    static let expiresAt = "expiresAt"
    /// Server session id (`AuthSession.id` == JWT `session_id`).
    static let sessionId = "sessionId"
    /// `"interactive"` | `"restored"` — a restored session cannot use the
    /// device-key step-up path.
    static let sessionContext = "sessionContext"
    /// JSON array of `AccountHint`, most-recent-first, max 3. Display-only:
    /// survives explicit sign-out so the login card can say "Continue as X".
    static let accountHints = "accountHints"
    /// App version string that was last sent to `/api/auth/devices/register`.
    /// A mismatch on launch re-registers (contract: "after app-update").
    static let registeredAppVersion = "registeredAppVersion"

    /// Per-user app-lock preference (moved out of `UserDefaults` so it
    /// survives a reinstall — a locked account must come back locked).
    static func appLockEnabled(_ userId: String) -> String {
        "appLockEnabled.\(userId)"
    }
}
