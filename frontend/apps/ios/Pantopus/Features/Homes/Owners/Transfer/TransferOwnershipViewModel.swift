//
//  TransferOwnershipViewModel.swift
//  Pantopus
//
//  A13.4 — Backs the Transfer Ownership form. Loads the home + its real
//  owner roster, takes the buyer's email (the identifier RN uses, and
//  the one `transferOwnerSchema` resolves for non-users —
//  `backend/routes/homeOwnership.js:74-79` + `:2274-2281`), requires the
//  typed confirmation phrase, and commits
//  `POST /api/homes/:id/owners/transfer` behind a biometric prompt.
//
//  The endpoint transfers ownership in full — it revokes the seller's
//  `HomeOwner` row and pre-seeds an ownership claim for the buyer
//  (`executeOwnershipTransfer`, line 2238). It carries no share /
//  percentage field, so this screen no longer renders one.
//

import Foundation
import LocalAuthentication
import Observation
import SwiftUI

/// Visibility states for the bottom confirmation sheet.
public enum ConfirmSheetPhase: Sendable, Equatable {
    case hidden
    case visible
    case authenticating
    case dismissing
}

/// Fetch state for the home + roster context strip.
public enum TransferOwnershipLoadState: Sendable, Equatable {
    case loading
    case loaded
    case error(message: String)
}

@Observable
@MainActor
public final class TransferOwnershipViewModel {
    /// The literal the user must type to arm the CTA.
    public static let confirmationPhraseLiteral = "TRANSFER"

    // MARK: - Inputs

    public let homeId: String
    public let confirmationPhrase: String = TransferOwnershipViewModel.confirmationPhraseLiteral

    // MARK: - Loaded context

    public private(set) var loadState: TransferOwnershipLoadState = .loading
    /// Home display name (falls back to the street address).
    public private(set) var homeTitle = ""
    /// Full street address used in the legal copy.
    public private(set) var homeAddress = ""
    /// "Mateo and Jin" — empty when the viewer is the sole owner.
    public private(set) var coOwnerNames = ""
    /// Count of owner rows other than the viewer.
    public private(set) var otherOwnerCount = 0
    /// The viewer's display name, shown on the "From" row.
    public private(set) var senderDisplayName: String

    // MARK: - Mutable state

    public var recipientField: FormFieldState
    public var confirmationField: FormFieldState
    public private(set) var sheetPhase: ConfirmSheetPhase = .hidden
    public private(set) var biometricErrorMessage: String?
    public var toast: ToastMessage?
    public private(set) var shouldDismiss = false

    // MARK: - Injected boundary

    /// Biometric evaluator. Default uses `LocalAuthentication`; tests can
    /// inject a deterministic stub that returns `.success` / `.failure`
    /// without prompting the user.
    public typealias BiometricEvaluator = @MainActor (_ reason: String) async -> Result<Void, any Error>
    private let biometricEvaluator: BiometricEvaluator

    /// Test seam for the backend round-trip. When `nil` (the default in
    /// the live app) `commitTransfer()` performs
    /// `POST /api/homes/:id/owners/transfer` through `api`; tests inject
    /// a deterministic stub so they never touch the network.
    public typealias TransferExecutor = @MainActor (_ buyerEmail: String) async throws -> String
    private let transferExecutor: TransferExecutor?
    private let api: APIClient
    private let currentUserId: String?
    private let timestampProvider: @Sendable () -> Date

    // MARK: - Init

    init(
        homeId: String,
        currentUserId: String? = nil,
        currentUserName: String? = nil,
        api: APIClient = .shared,
        biometricEvaluator: BiometricEvaluator? = nil,
        transferExecutor: TransferExecutor? = nil,
        timestampProvider: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.currentUserId = currentUserId
        senderDisplayName = currentUserName?.nilIfBlank ?? "You"
        recipientField = FormFieldState(id: "recipientEmail", originalValue: "")
        confirmationField = FormFieldState(id: "confirmation", originalValue: "")
        self.biometricEvaluator = biometricEvaluator ?? Self.defaultBiometricEvaluator
        self.transferExecutor = transferExecutor
        self.timestampProvider = timestampProvider
    }

    // MARK: - Load

    public func load() async {
        if case .loaded = loadState { return }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        loadState = .loading
        do {
            let detail: HomeDetailResponse = try await api.request(
                HomesEndpoints.detail(homeId: homeId)
            )
            let owners: OwnersResponse = try await api.request(
                HomesEndpoints.listOwners(homeId: homeId)
            )
            apply(detail: detail.home, owners: owners.owners)
            loadState = .loaded
        } catch {
            loadState = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this home. Try again."
            )
        }
    }

    private func apply(detail: HomeDetail, owners: [OwnerDTO]) {
        let address = detail.base.address?.nilIfBlank
        homeAddress = address ?? detail.base.name?.nilIfBlank ?? "this home"
        homeTitle = detail.base.name?.nilIfBlank ?? homeAddress
        let others = owners.filter { owner in
            guard let currentUserId else { return true }
            return owner.subjectId != currentUserId
        }
        otherOwnerCount = others.count
        coOwnerNames = Self.joinNames(others.map(Self.displayName(for:)))
    }

    // MARK: - Computed projections

    /// Trimmed buyer email exactly as it goes on the wire.
    public var recipientEmail: String {
        recipientField.value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Loose RFC-ish check — the backend enforces `Joi.string().email()`.
    public var recipientIsValid: Bool {
        Self.looksLikeEmail(recipientEmail)
    }

    /// Local-part of the buyer email, used in CTA / warning copy.
    public var recipientShortName: String {
        let local = recipientEmail.split(separator: "@").first.map(String.init) ?? recipientEmail
        return local.isEmpty ? "the buyer" : local
    }

    public var recipientInitials: String {
        let local = recipientEmail.split(separator: "@").first.map(String.init) ?? ""
        let letters = local.filter(\.isLetter)
        guard let first = letters.first else { return "?" }
        return String(first).uppercased()
    }

    public var senderInitials: String {
        let parts = senderDisplayName.split(separator: " ").prefix(2)
        let initials = parts.compactMap(\.first).map { String($0).uppercased() }.joined()
        return initials.isEmpty ? "YOU" : initials
    }

    /// Whether the typed phrase matches the literal "TRANSFER" exactly.
    public var confirmationMatches: Bool {
        confirmationField.value == confirmationPhrase
    }

    /// Whether the sticky CTA is active. The context strip failing to
    /// load doesn't block the mutation — the request only needs the home
    /// id and the buyer's email.
    public var isReadyToCommit: Bool {
        recipientIsValid && confirmationMatches
    }

    /// Whether the host should arm the dirty-close confirm.
    public var isDirty: Bool {
        !recipientField.value.isEmpty || !confirmationField.value.isEmpty
    }

    /// Field state visual for the typed confirmation input.
    public var confirmationFieldState: PantopusFieldState {
        if confirmationField.value.isEmpty { return .default }
        return confirmationMatches ? .valid : .default
    }

    public var recipientFieldState: PantopusFieldState {
        if recipientField.value.isEmpty { return .default }
        return recipientIsValid ? .valid : .error("Enter a valid email address.")
    }

    public var ctaLabel: String {
        recipientIsValid ? "Transfer ownership to \(recipientShortName)" : "Initiate transfer"
    }

    /// Mirrors RN's confirm-dialog body (`owners/transfer.tsx:32`) plus
    /// the co-owner-quorum note the backend applies at line 1547.
    public var warningCopy: String {
        var copy = "The new owner must verify ownership before the transfer completes. "
            + "Your owner record is revoked as soon as this is initiated."
        if otherOwnerCount > 0 {
            let names = coOwnerNames.isEmpty ? "The other owners" : coOwnerNames
            copy += " \(names) must approve before it takes effect."
        }
        return copy
    }

    public var ownerSummary: String {
        switch otherOwnerCount {
        case 0: "You're the only owner on record"
        case 1: "You + 1 co-owner"
        default: "You + \(otherOwnerCount) co-owners"
        }
    }

    public var biometryLabel: String {
        Self.biometryLabel
    }

    public var confirmSheetParties: [ConfirmSheetParty] {
        [
            ConfirmSheetParty(
                id: "sender",
                role: "From",
                name: senderDisplayName == "You" ? "You" : "You · \(senderDisplayName)",
                initials: senderInitials,
                avatarStart: Theme.Color.primary500,
                avatarEnd: Theme.Color.primary700,
                fromPercent: 100,
                toPercent: 0
            ),
            ConfirmSheetParty(
                id: "recipient",
                role: "To",
                name: recipientEmail.isEmpty ? "—" : recipientEmail,
                initials: recipientInitials,
                avatarStart: Theme.Color.business,
                avatarEnd: Theme.Color.businessDark,
                fromPercent: 0,
                toPercent: 100
            )
        ]
    }

    /// "HH:mm MMM d" stamp shown in the legal copy.
    public var confirmationTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm MMM d"
        return formatter.string(from: timestampProvider())
    }

    // MARK: - Mutations

    public func updateRecipientEmail(_ value: String) {
        recipientField.value = value
        recipientField.touched = true
    }

    public func clearRecipientEmail() {
        recipientField.value = ""
    }

    public func updateConfirmation(_ value: String) {
        confirmationField.value = value
        confirmationField.touched = true
    }

    public func presentConfirmSheet() {
        guard isReadyToCommit else { return }
        sheetPhase = .visible
        biometricErrorMessage = nil
    }

    public func dismissConfirmSheet() {
        guard sheetPhase != .authenticating else { return }
        sheetPhase = .hidden
        biometricErrorMessage = nil
    }

    /// Authenticate with biometrics, then run the transfer. On success
    /// raises a toast and signals the host should dismiss. On biometric
    /// failure the sheet stays open with an inline error so the user can
    /// retry.
    public func authenticateAndCommit() async {
        guard sheetPhase == .visible, isReadyToCommit else { return }
        sheetPhase = .authenticating
        biometricErrorMessage = nil
        let reason = "Confirm ownership transfer to \(recipientEmail)"
        let result = await biometricEvaluator(reason)
        switch result {
        case .success:
            await commitTransfer()
        case let .failure(error):
            sheetPhase = .visible
            biometricErrorMessage = (error as? LAError)
                .map { Self.message(for: $0) }
                ?? error.localizedDescription
        }
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    private func commitTransfer() async {
        do {
            let successText: String
            if let transferExecutor {
                // Test seam — deterministic stub, no network.
                successText = try await transferExecutor(recipientEmail)
            } else {
                // RN identifies the buyer by email so off-platform buyers
                // work too (`owners/transfer.tsx:41-43`); the handler
                // resolves it to a user id when one exists.
                // `effective_date` is omitted so the transfer takes
                // effect immediately.
                let request = TransferOwnerRequest(buyerEmail: recipientEmail)
                let response = try await api.request(
                    HomesEndpoints.transferOwner(homeId: homeId, request: request),
                    as: TransferOwnerResponse.self
                )
                successText = response.message
            }
            sheetPhase = .dismissing
            toast = ToastMessage(text: successText, kind: .success)
            shouldDismiss = true
        } catch {
            sheetPhase = .visible
            biometricErrorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't complete the transfer. Try again."
        }
    }

    // MARK: - Helpers

    private static func looksLikeEmail(_ raw: String) -> Bool {
        guard !raw.contains(" ") else { return false }
        let parts = raw.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty else { return false }
        let domain = parts[1]
        guard domain.contains("."), !domain.hasPrefix("."), !domain.hasSuffix(".") else { return false }
        return true
    }

    private static func displayName(for owner: OwnerDTO) -> String {
        if let name = owner.user?.name?.nilIfBlank { return name }
        if let username = owner.user?.username?.nilIfBlank { return "@\(username)" }
        return "Owner · \(String(owner.subjectId.suffix(4)))"
    }

    private static func joinNames(_ names: [String]) -> String {
        switch names.count {
        case 0: ""
        case 1: names[0]
        case 2: "\(names[0]) and \(names[1])"
        default: "\(names.dropLast().joined(separator: ", ")) and \(names[names.count - 1])"
        }
    }

    // MARK: - Defaults

    private static let defaultBiometricEvaluator: BiometricEvaluator = { reason in
        let context = LAContext()
        var error: NSError?
        let policy: LAPolicy = .deviceOwnerAuthentication // biometrics with passcode fallback
        guard context.canEvaluatePolicy(policy, error: &error) else {
            return .failure(error ?? LAError(.biometryNotAvailable))
        }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(policy, localizedReason: reason) { success, evalError in
                if success {
                    continuation.resume(returning: .success(()))
                } else {
                    continuation.resume(returning: .failure(evalError ?? LAError(.authenticationFailed)))
                }
            }
        }
    }

    private static var biometryLabel: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "Passcode"
        @unknown default: return "Face ID"
        }
    }

    private static func message(for error: LAError) -> String {
        switch error.code {
        case .userCancel, .systemCancel, .appCancel:
            "Authentication was cancelled."
        case .authenticationFailed:
            "Authentication failed. Try again."
        case .passcodeNotSet:
            "Set a device passcode to confirm transfers."
        case .biometryNotAvailable, .biometryNotEnrolled, .biometryLockout:
            "Biometric authentication isn't available right now."
        default:
            error.localizedDescription
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
