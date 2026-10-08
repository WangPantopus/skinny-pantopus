//
//  NamePrompt.swift
//  Pantopus
//
//  "What should we call you?" — asked once of an account that has no first
//  or last name: accounts made while sign-up asked only for an email and a
//  password, and Google or Apple sign-ins that brought no name. Without a
//  name, the household, neighbors and helpers see a stand-in instead of the
//  person. Save or Not now; either way this device doesn't ask that account
//  again (Edit Profile still can). Web: `components/profile/NamePrompt.tsx`;
//  Android: `NamePrompt.kt`.
//

import SwiftUI

/// Remembers, per account, that the sheet was shown on this device.
enum NamePromptMemory {
    private static func key(_ userId: String) -> String {
        "namePrompt.\(userId).asked"
    }

    static func wasAsked(_ userId: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(userId))
    }

    static func markAsked(_ userId: String) {
        UserDefaults.standard.set(true, forKey: key(userId))
    }
}

/// Raises the sheet over the signed-in shell. Attach once, at the root.
struct NamePromptModifier: ViewModifier {
    /// The signed-in account, or nil when nobody is signed in.
    let userId: String?

    @State private var model: NamePromptViewModel?

    func body(content: Content) -> some View {
        content
            .task(id: userId) { await evaluate() }
            .sheet(isPresented: Binding(get: { model != nil }, set: { if !$0 { model = nil } })) {
                if let model {
                    NamePromptSheet(model: model) { self.model = nil }
                }
            }
    }

    @MainActor
    private func evaluate() async {
        guard let userId, !NamePromptMemory.wasAsked(userId) else { return }
        guard let response: ProfileResponse = try? await APIClient.shared.request(UsersEndpoints.profile()),
              response.user.id == userId,
              response.user.accountType != "business",
              NamePromptViewModel.isMissingName(response.user)
        else { return }
        // Let a link opened before sign-in land first, and wait until nothing
        // covers the shell (the same gates as the app-lock offer).
        while AppLockSetupPromptModifier.isDeepLinkInFlight || AppLockSetupPromptModifier.isShellCovered {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
        }
        // Asked once: remembered as soon as it shows.
        NamePromptMemory.markAsked(userId)
        model = NamePromptViewModel(profile: response.user)
    }
}

extension View {
    /// The one-time "What should we call you?" sheet for an account with no name.
    func namePrompt(userId: String?) -> some View {
        modifier(NamePromptModifier(userId: userId))
    }
}

@Observable
@MainActor
final class NamePromptViewModel {
    var firstName: String
    var middleName: String
    var lastName: String
    private(set) var firstNameError: String?
    private(set) var lastNameError: String?
    private(set) var saveError: String?
    private(set) var isSaving = false

    private let api: APIClient

    init(profile: UserProfile, api: APIClient = .shared) {
        firstName = profile.firstName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        middleName = profile.middleName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        lastName = profile.lastName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.api = api
    }

    static func isMissingName(_ profile: UserProfile) -> Bool {
        (profile.firstName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || (profile.lastName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Typing in a field clears that field's error (and a failed save's).
    func clearFirstNameError() {
        firstNameError = nil
        saveError = nil
    }

    func clearLastNameError() {
        lastNameError = nil
        saveError = nil
    }

    /// Saves the name; true when it landed.
    func save() async -> Bool {
        firstNameError = AuthValidation.requiredName(firstName, missing: "Enter your first name.")
        lastNameError = AuthValidation.requiredName(lastName, missing: "Enter your last name.")
        saveError = nil
        guard firstNameError == nil, lastNameError == nil else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let _: ProfileUpdateResponse = try await api.request(UsersEndpoints.updateProfile(ProfileUpdateRequest(
                firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                middleName: middleName.trimmingCharacters(in: .whitespacesAndNewlines),
                lastName: lastName.trimmingCharacters(in: .whitespacesAndNewlines)
            )))
            _ = await AuthManager.shared.refreshCurrentUser()
            NotificationCenter.default.post(name: .pantopusProfileDidChange, object: nil)
            return true
        } catch {
            saveError = (error as? APIError)?.errorDescription ?? "Your name wasn't saved. Try again."
            return false
        }
    }
}

struct NamePromptSheet: View {
    @Bindable var model: NamePromptViewModel
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("What should we call you?")
                        .pantopusTextStyle(.h2)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("Add your name so your household and neighbors know who you are.")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                PantopusTextField(
                    "First name",
                    text: $model.firstName,
                    state: model.firstNameError.map { .error($0) } ?? .default,
                    isRequired: true,
                    contentType: .givenName,
                    identifier: "namePromptFirstName"
                )
                PantopusTextField(
                    "Middle name (optional)",
                    text: $model.middleName,
                    contentType: .middleName,
                    identifier: "namePromptMiddleName"
                )
                PantopusTextField(
                    "Last name",
                    text: $model.lastName,
                    state: model.lastNameError.map { .error($0) } ?? .default,
                    isRequired: true,
                    contentType: .familyName,
                    identifier: "namePromptLastName"
                )
                if let saveError = model.saveError {
                    Text(saveError)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("namePromptError")
                }
                PrimaryButton(title: "Save", isLoading: model.isSaving) {
                    if await model.save() { onDone() }
                }
                .accessibilityIdentifier("namePromptSave")
                GhostButton(title: "Not now", isEnabled: !model.isSaving) {
                    onDone()
                }
                .accessibilityIdentifier("namePromptNotNow")
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .onChange(of: model.firstName) { _, _ in model.clearFirstNameError() }
        .onChange(of: model.lastName) { _, _ in model.clearLastNameError() }
        .interactiveDismissDisabled(model.isSaving)
        .presentationDetents([.large])
    }
}
