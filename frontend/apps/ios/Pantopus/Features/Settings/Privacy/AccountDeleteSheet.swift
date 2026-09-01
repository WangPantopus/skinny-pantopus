//
//  AccountDeleteSheet.swift
//  Pantopus
//
//  T1 — the confirm gate in front of `DELETE /api/users/account`
//  (`backend/routes/users.js:3945`). Port of RN's
//  `src/components/profile/AccountDeleteSheet.tsx`: warning disc, the
//  five-line "this is what goes" list, the irreversibility line, and a
//  typed `DELETE` confirmation that arms the destructive CTA.
//
//  The CTA does *not* delete on its own — the host view-model runs a
//  device-credential re-auth first (RN's `useSensitiveActionGuard`) and
//  only then fires the request. Failures come back through `errorMessage`
//  and are rendered in-sheet so a 409 ("finish your gigs first") stays
//  readable instead of flashing past in a toast.
//

import SwiftUI

public struct AccountDeleteSheet: View {
    /// The literal a user must type to arm the CTA — RN uses the same word.
    static let confirmWord = "DELETE"

    private let isDeleting: Bool
    private let errorMessage: String?
    private let onCancel: @MainActor () -> Void
    private let onConfirm: @MainActor () async -> Void

    @State private var confirmText = ""

    public init(
        isDeleting: Bool,
        errorMessage: String?,
        onCancel: @escaping @MainActor () -> Void,
        onConfirm: @escaping @MainActor () async -> Void
    ) {
        self.isDeleting = isDeleting
        self.errorMessage = errorMessage
        self.onCancel = onCancel
        self.onConfirm = onConfirm
    }

    private var isConfirmed: Bool {
        confirmText.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == Self.confirmWord
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                warningDisc
                    .padding(.top, Spacing.s5)
                Text("Delete your account?")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s4)
                Text("This will permanently delete your account, including:")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s2)
                bullets
                    .padding(.top, Spacing.s3)
                Text("This action cannot be undone.")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s3)
                if let errorMessage {
                    errorBanner(errorMessage)
                        .padding(.top, Spacing.s3)
                }
                confirmField
                    .padding(.top, Spacing.s5)
                buttons
                    .padding(.top, Spacing.s5)
                    .padding(.bottom, Spacing.s6)
            }
            .padding(.horizontal, Spacing.s6)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("accountDeleteSheet")
    }

    private var warningDisc: some View {
        Circle()
            .fill(Theme.Color.errorBg)
            .frame(width: 56, height: 56)
            .overlay(Icon(.alertTriangle, size: 28, color: Theme.Color.error))
            .accessibilityHidden(true)
    }

    private var bullets: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            ForEach(Self.bulletItems, id: \.self) { item in
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Text("•")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.error)
                    Text(item)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("accountDeleteSheetError")
    }

    private var confirmField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Type \(Self.confirmWord) to confirm")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
            PantopusTextField(
                "Confirmation",
                text: $confirmText,
                placeholder: Self.confirmWord,
                identifier: "accountDeleteConfirmField"
            )
            .disabled(isDeleting)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled(true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var buttons: some View {
        HStack(spacing: Spacing.s3) {
            GhostButton(title: "Cancel", isEnabled: !isDeleting) {
                onCancel()
            }
            .accessibilityIdentifier("accountDeleteCancel")
            DestructiveButton(
                title: "Delete My Account",
                isLoading: isDeleting,
                isEnabled: isConfirmed && !isDeleting
            ) {
                await onConfirm()
            }
            .accessibilityIdentifier("accountDeleteConfirm")
        }
    }

    /// RN's bullet list, verbatim (`AccountDeleteSheet.tsx:64-68`).
    static let bulletItems: [String] = [
        "Your profile and all personal data",
        "Your task history and reviews",
        "Your home memberships",
        "Your business profiles",
        "Your messages and connections"
    ]
}

#Preview("Idle") {
    AccountDeleteSheet(isDeleting: false, errorMessage: nil, onCancel: {}, onConfirm: {})
}

#Preview("Blocked by active gigs") {
    AccountDeleteSheet(
        isDeleting: false,
        errorMessage: "Cannot delete account while you have gigs in progress. "
            + "Please complete or cancel them first.",
        onCancel: {},
        onConfirm: {}
    )
}
