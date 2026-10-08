//
//  UsernameAvailability.swift
//  Pantopus
//
//  A person's username is the address of their profile link
//  (`pantopus.com/u/<username>`). Nobody picks one at sign-up, so until
//  they do it's one the server made up. `UsernameAvailabilityChecker`
//  checks a typed username after a pause (`GET /api/users/username-
//  availability`); `UsernameFieldBlock` is the field plus its status and
//  a plain note that changing it changes the link and old links stop
//  working. Used by Edit Profile and the share-profile username sheet.
//

import SwiftUI

/// Where the username a person typed stands.
enum UsernameCheckState: Equatable {
    /// Empty, or the same as the current username.
    case unchanged
    case checking
    case available
    case unavailable(String)
    /// The check itself failed (offline, server error); the save checks again.
    case failed
}

@Observable
@MainActor
final class UsernameAvailabilityChecker {
    private(set) var state: UsernameCheckState = .unchanged
    /// The account's username as the server has it.
    private(set) var current: String = ""
    /// True when `current` is the one the server made up.
    private(set) var currentIsMadeUp = false

    private let api: APIClient
    private var task: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    func reset(current: String, isMadeUp: Bool) {
        task?.cancel()
        self.current = current
        currentIsMadeUp = isMadeUp
        state = .unchanged
    }

    /// True while the typed name can't be saved (or is still being checked).
    var blocksSave: Bool {
        switch state {
        case .checking, .unavailable: true
        default: false
        }
    }

    /// A username as it would be saved: no spaces, no leading @, lowercase.
    nonisolated static func normalize(_ value: String) -> String {
        var text = value.replacingOccurrences(of: " ", with: "").lowercased()
        while text.hasPrefix("@") {
            text.removeFirst()
        }
        return text
    }

    /// Check `value` after a short pause; a newer call replaces an older one.
    func check(_ value: String) {
        task?.cancel()
        let desired = Self.normalize(value)
        guard !desired.isEmpty, desired != current.lowercased() else {
            state = .unchanged
            return
        }
        if let local = AuthValidation.username(desired) {
            state = .unavailable(local)
            return
        }
        state = .checking
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled, let self else { return }
            do {
                let answer: PersonalUsernameAvailabilityDTO = try await api.request(
                    UsersEndpoints.usernameAvailability(desired)
                )
                guard !Task.isCancelled else { return }
                if answer.available {
                    state = answer.reason == "current" ? .unchanged : .available
                } else {
                    state = .unavailable(answer.message ?? "That username isn't available. Try another.")
                }
            } catch {
                guard !Task.isCancelled else { return }
                state = .failed
            }
        }
    }

    /// The profile link for `username`, without the scheme, for reading.
    static func linkLabel(_ username: String) -> String {
        InviteLinks.profileURLString(username: username)
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
    }
}

/// The username field with its availability line and the link note. The
/// owner's binding setter calls `checker.check(_:)`.
struct UsernameFieldBlock: View {
    let checker: UsernameAvailabilityChecker
    @Binding var text: String
    var serverError: String?
    var isDirty = false
    var showCurrentLink = true
    var identifier = "field_username"

    private var desired: String {
        UsernameAvailabilityChecker.normalize(text)
    }

    private var changed: Bool {
        !desired.isEmpty && desired != checker.current.lowercased()
    }

    private var errorMessage: String? {
        if let serverError { return serverError }
        if case let .unavailable(message) = checker.state { return message }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PantopusTextField(
                "Username",
                text: $text,
                placeholder: checker.currentIsMadeUp ? "Choose a username" : checker.current,
                state: errorMessage.map { .error($0) } ?? (checker.state == .available ? .valid : .default),
                isDirty: isDirty,
                contentType: .username,
                identifier: identifier
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            statusLine
            Text("3 to 30 lowercase letters, numbers or underscores.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    @ViewBuilder private var statusLine: some View {
        if errorMessage == nil {
            switch checker.state {
            case .checking:
                note("Checking…")
            case .failed:
                note("Couldn't check that username. It's checked again when you save.")
            case .available:
                Text("@\(desired) is available.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.success)
            default:
                EmptyView()
            }
            if changed {
                note(
                    "Your profile link becomes \(UsernameAvailabilityChecker.linkLabel(desired)). " +
                        "Links to \(UsernameAvailabilityChecker.linkLabel(checker.current)) will stop working."
                )
            } else if showCurrentLink, !checker.current.isEmpty {
                note(checker.currentIsMadeUp
                    ? "You haven't chosen one yet, so your profile link is " +
                    "\(UsernameAvailabilityChecker.linkLabel(checker.current)) for now."
                    : "Your profile link is \(UsernameAvailabilityChecker.linkLabel(checker.current)).")
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
