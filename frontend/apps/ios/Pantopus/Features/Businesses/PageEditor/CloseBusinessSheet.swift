//
//  CloseBusinessSheet.swift
//  Pantopus
//
//  The owner's confirm gate in front of `DELETE /api/businesses/:businessId`,
//  as on web (Settings → Close business) and Android (the page editor's
//  dialog). Typing CLOSE arms the button. A failure is shown in the sheet
//  and the typed word stays, so a 503 can be retried at once.
//

import SwiftUI

struct CloseBusinessSheet: View {
    /// The word an owner types to arm the button, as on web and Android.
    static let confirmWord = "CLOSE"

    static let explanation = "Its public page disappears and everyone on its team loses access, "
        + "including you. Existing records are kept."

    let businessName: String
    let isClosing: Bool
    let failure: CloseBusinessFailure?
    let onCancel: @MainActor () -> Void
    let onConfirm: @MainActor () async -> Void

    @State private var confirmText = ""

    private var isConfirmed: Bool {
        confirmText.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == Self.confirmWord
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                Circle()
                    .fill(Theme.Color.errorBg)
                    .frame(width: 56, height: 56)
                    .overlay(Icon(.alertTriangle, size: 28, color: Theme.Color.error))
                    .accessibilityHidden(true)
                    .padding(.top, Spacing.s5)
                Text("Close \(businessName)?")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s4)
                Text(Self.explanation)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s2)
                Text("You can't undo this in the app.")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.s3)
                if let failure {
                    errorBanner(failure.message)
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
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("closeBusinessSheet")
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
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("closeBusinessError")
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
                identifier: "closeBusinessConfirmField"
            )
            .disabled(isClosing)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled(true)
            .submitLabel(.done)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var buttons: some View {
        HStack(spacing: Spacing.s3) {
            GhostButton(title: "Cancel", isEnabled: !isClosing) {
                onCancel()
            }
            .accessibilityIdentifier("closeBusinessCancel")
            DestructiveButton(
                title: failure?.canRetry == true ? "Retry" : "Close business",
                isLoading: isClosing,
                isEnabled: isConfirmed && !isClosing
            ) {
                await onConfirm()
            }
            .accessibilityIdentifier("closeBusinessConfirm")
        }
    }
}

#Preview("Idle") {
    CloseBusinessSheet(businessName: "Golden Hour Cafe", isClosing: false, failure: nil, onCancel: {}, onConfirm: {})
}

#Preview("Unavailable") {
    CloseBusinessSheet(
        businessName: "Golden Hour Cafe",
        isClosing: false,
        failure: CloseBusinessFailure(
            message: "Business closure is temporarily unavailable. Please try again.",
            canRetry: true
        ),
        onCancel: {},
        onConfirm: {}
    )
}
