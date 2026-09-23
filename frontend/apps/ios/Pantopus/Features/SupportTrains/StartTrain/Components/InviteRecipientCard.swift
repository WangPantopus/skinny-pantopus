//
//  InviteRecipientCard.swift
//  Pantopus
//
//  A12.11 — Frame 2 recipient branch: the organizer typed a name that
//  matched no one on Pantopus. Typed-search row → warm-amber "no one by
//  that name" section. The wizard has no contact entry and sends no
//  invite yet, so the invite-by-phone / email rows and the "gets a link"
//  hint are not shown.
//

import SwiftUI

/// Recipient card for a name that matched no one. Pairs with the step's
/// "RECIPIENT" overline.
struct InviteRecipientCard: View {
    let candidate: StartSupportTrainInviteCandidate
    let selectedMethod: StartSupportTrainInviteMethod
    let onClear: () -> Void
    let onSelectMethod: (StartSupportTrainInviteMethod) -> Void

    /// `selectedMethod` / `onSelectMethod` stay for when real invites exist.
    /// The wizard has no contact entry and sends no invite yet, so the card
    /// doesn't offer invite methods or promise a link.
    var body: some View {
        card
    }

    private var card: some View {
        VStack(spacing: Spacing.s0) {
            searchRow
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            noMatchSection
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("startSupportTrainInviteRecipientCard")
    }

    private var searchRow: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 14, color: Theme.Color.appTextMuted)
            Text(candidate.typedName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onClear) {
                Icon(.x, size: 12, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Clear recipient search")
            .accessibilityIdentifier("startSupportTrainClearInviteSearch")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    private var noMatchSection: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(Theme.Color.warmAmber).frame(width: 28, height: 28)
                Icon(.search, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("No one on Pantopus by that name")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.warmAmber)
                Text("You can still start a train for \(firstName).")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.warmAmber)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warmAmberBg)
    }

    private var firstName: String {
        candidate.typedName.split(separator: " ").first.map(String.init) ?? candidate.typedName
    }
}

#Preview {
    InviteRecipientCard(
        candidate: StartSupportTrainSampleData.inviteCandidate,
        selectedMethod: .phone,
        onClear: {},
        onSelectMethod: { _ in }
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
