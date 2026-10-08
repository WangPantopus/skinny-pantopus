//
//  UsernameShareSheet.swift
//  Pantopus
//
//  "Pick a username for your link" — asked the first time someone shares
//  their own profile while its link still uses the username the server made
//  up (pantopus.com/u/user_3f9a…). Save and share, or share the link as it
//  is; either way this device doesn't ask that account again. Web:
//  `components/profile/UsernamePrompt.tsx`; Android: `UsernameShareSheet.kt`.
//

import SwiftUI

/// Remembers, per account, that the sheet was shown on this device.
enum UsernamePromptMemory {
    private static func key(_ userId: String) -> String {
        "usernamePrompt.\(userId).asked"
    }

    static func wasAsked(_ userId: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(userId))
    }

    static func markAsked(_ userId: String) {
        UserDefaults.standard.set(true, forKey: key(userId))
    }
}

@Observable
@MainActor
final class UsernameShareSheetModel {
    private(set) var text = ""
    let checker: UsernameAvailabilityChecker
    private(set) var serverError: String?
    private(set) var isSaving = false
    private let api: APIClient

    init(currentUsername: String, api: APIClient = .shared) {
        self.api = api
        checker = UsernameAvailabilityChecker(api: api)
        checker.reset(current: currentUsername, isMadeUp: true)
    }

    func update(_ value: String) {
        text = value
        serverError = nil
        checker.check(value)
    }

    var canSave: Bool {
        checker.state == .available && !isSaving
    }

    /// Saves the username; returns the new one when it landed.
    func save() async -> String? {
        let username = UsernameAvailabilityChecker.normalize(text)
        guard canSave, !username.isEmpty else { return nil }
        isSaving = true
        defer { isSaving = false }
        do {
            let response: ProfileUpdateResponse = try await api.request(
                UsersEndpoints.updateProfile(ProfileUpdateRequest(username: username))
            )
            _ = await AuthManager.shared.refreshCurrentUser()
            NotificationCenter.default.post(name: .pantopusProfileDidChange, object: nil)
            return response.user.username
        } catch {
            if case let .clientError(_, message)? = error as? APIError, let message {
                serverError = message
            } else {
                serverError = (error as? APIError)?.errorDescription ?? "Your username wasn't saved. Try again."
            }
            return nil
        }
    }
}

struct UsernameShareSheet: View {
    let model: UsernameShareSheetModel
    let onShareAsIs: () -> Void
    let onSaved: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Pick a username for your link")
                        .pantopusTextStyle(.h2)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(
                        "Your profile link uses a made-up name: "
                            + "\(UsernameAvailabilityChecker.linkLabel(model.checker.current)). "
                            + "Choose one people will recognize."
                    )
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
                UsernameFieldBlock(
                    checker: model.checker,
                    text: Binding(get: { model.text }, set: { model.update($0) }),
                    serverError: model.serverError,
                    showCurrentLink: false,
                    identifier: "usernameShareField"
                )
                PrimaryButton(title: "Save and share", isLoading: model.isSaving, isEnabled: model.canSave) {
                    if let username = await model.save() { onSaved(username) }
                }
                .accessibilityIdentifier("usernameShareSave")
                GhostButton(title: "Share as is", isEnabled: !model.isSaving) {
                    onShareAsIs()
                }
                .accessibilityIdentifier("usernameShareAsIs")
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .interactiveDismissDisabled(model.isSaving)
        .presentationDetents([.large])
    }
}
