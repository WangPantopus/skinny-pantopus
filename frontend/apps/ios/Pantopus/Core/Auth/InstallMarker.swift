//
//  InstallMarker.swift
//  Pantopus
//
//  Detects "the app was deleted and reinstalled" — the one signal that
//  turns a silent cold-start restore (L1) into a one-gesture "Continue as
//  X" (L2). Keychain items survive an uninstall; files in the app sandbox
//  do not. So: a random `installId` is written to
//  `Library/Application Support/.pantopus-install` (excluded from backup,
//  so a restore to a new phone also reads as "not this install") and
//  mirrored into the Keychain. On launch:
//
//    Keychain has a refresh token AND (file missing OR file != Keychain)
//      ⇒ reinstall ⇒ gate behind LAContext, never silent, never wipe.
//
//  Supersedes the RN-era "wipe the Keychain on first launch" sentinel
//  (docs/07 §381-418): the credential is kept, only gated.
//

import Foundation

/// `@unchecked Sendable`: `FileManager` is documented thread-safe for the
/// path-based calls used here, and the struct is otherwise immutable.
struct InstallMarker: @unchecked Sendable {
    /// Why a launch is (or is not) treated as the same install.
    enum Verdict: Equatable {
        /// File and Keychain agree — same install as last time.
        case sameInstall
        /// Keychain has an install id (and a refresh token) but the file is
        /// gone or disagrees — the sandbox was recreated.
        case reinstall
        /// Nothing to compare (no refresh token in the Keychain) — treat as
        /// a fresh install; the marker is (re)written after the next
        /// successful sign-in or restore.
        case fresh
    }

    static let fileName = ".pantopus-install"

    let fileURL: URL
    private let fileManager: FileManager

    /// - Parameter directory: override in tests (a temp dir). Defaults to
    ///   `Library/Application Support`.
    init(directory: URL? = nil, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        let base = directory ?? Self.defaultDirectory(fileManager: fileManager)
        fileURL = base.appendingPathComponent(Self.fileName, isDirectory: false)
    }

    /// The live app's marker location.
    static let `default` = InstallMarker()

    static func defaultDirectory(fileManager: FileManager = .default) -> URL {
        // Application Support is the documented home for app-owned state
        // that is not user-visible; it is created on demand.
        fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
    }

    /// 16 random bytes, hex-encoded (`hex32` per the contract's
    /// `device.installId`).
    static func generateInstallId() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        for index in bytes.indices {
            bytes[index] = UInt8.random(in: UInt8.min...UInt8.max)
        }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - File I/O

    /// The install id recorded in the sandbox file, if any.
    func readFileInstallId() -> String? {
        guard let data = fileManager.contents(atPath: fileURL.path),
              let raw = String(data: data, encoding: .utf8) else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Write `installId` to the sandbox file (creating the directory) and
    /// exclude it from backups so it never travels to another device.
    func writeFile(installId: String) throws {
        let directory = fileURL.deletingLastPathComponent()
        if !fileManager.fileExists(atPath: directory.path) {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        try Data(installId.utf8).write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var url = fileURL
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }

    func removeFile() {
        try? fileManager.removeItem(at: fileURL)
    }

    // MARK: - Verdicts

    /// Compare the sandbox file with the Keychain mirror.
    func verdict(store: any SecureStore) -> Verdict {
        guard let refresh = store.get(SecureStoreKey.refreshToken), !refresh.isEmpty else {
            return .fresh
        }
        guard let fileId = readFileInstallId() else { return .reinstall }
        guard let keychainId = store.get(SecureStoreKey.installId), !keychainId.isEmpty else {
            // Tokens + file but no Keychain mirror: an app version that
            // pre-dates the marker upgraded in place. The file could only
            // have been written by this install, so adopt it.
            return .sameInstall
        }
        return fileId == keychainId ? .sameInstall : .reinstall
    }

    /// The install id to report in the device descriptor *before* the user
    /// has proven ownership on this install: the file's id when the sandbox
    /// still has one, else a freshly minted one — a missing file means this
    /// is a new install (fresh or reinstall), and the server keys "did the
    /// install change?" on exactly this value (design §7.3: `install_id`
    /// updated on resume). Nothing is written — writing the marker before a
    /// login/resume succeeds would let an abandoned attempt turn the
    /// *previous* account's tokens into a silent L1 restore on the next
    /// launch. Persist with `commit(installId:store:)`.
    func installIdForDescriptor(store _: any SecureStore) -> String {
        readFileInstallId() ?? Self.generateInstallId()
    }

    /// Make file and Keychain both carry `installId`. Called only after a
    /// successful interactive login or resume.
    func commit(installId: String, store: any SecureStore) {
        if readFileInstallId() != installId {
            try? writeFile(installId: installId)
        }
        if store.get(SecureStoreKey.installId) != installId {
            try? store.set(installId, for: SecureStoreKey.installId)
        }
    }

    /// Convenience: `installIdForDescriptor` + `commit`, for call sites that
    /// have already proven ownership (a successful L1 restore).
    @discardableResult
    func ensure(store: any SecureStore) -> String {
        let installId = installIdForDescriptor(store: store)
        commit(installId: installId, store: store)
        return installId
    }
}
