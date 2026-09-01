//
//  InviteRecipientCard.swift
//  Pantopus
//
//  A12.11 — Frame 2 recipient branch: the organizer typed a name that
//  matched no verified neighbor, so the card pivots to an invite flow.
//  Typed-search row → warm-amber "no verified neighbor" section →
//  invite-by-phone (recommended) / invite-by-email rows → a privacy hint
//  clarifying the invitee doesn't need a Pantopus account.
//
//  The typeahead is stubbed (real contact-picker integration is out of
//  scope, P7.4); the contact handles come from the `InviteCandidate`.
//

import SwiftUI

/// Invite-a-non-member recipient card. Pairs with the step's "RECIPIENT"
/// overline; the CTA flips to "Send invite & continue" in this branch.
struct InviteRecipientCard: View {
    let candidate: StartSupportTrainInviteCandidate
    let selectedMethod: StartSupportTrainInviteMethod
    let onClear: () -> Void
    let onSelectMethod: (StartSupportTrainInviteMethod) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            card
            privacyHint
        }
    }

    private var card: some View {
        VStack(spacing: Spacing.s0) {
            searchRow
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            noMatchSection
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ForEach(Array(StartSupportTrainInviteMethod.allCases.enumerated()), id: \.element.id) { index, method in
                inviteMethodRow(method)
                if index < StartSupportTrainInviteMethod.allCases.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
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
                Text("No verified neighbor by that name")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.warmAmber)
                Text(
                    "We searched verified addresses near yours. You can still start a train " +
                        "and invite \(firstName) directly."
                )
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.warmAmber)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warmAmberBg)
    }

    private func inviteMethodRow(_ method: StartSupportTrainInviteMethod) -> some View {
        Button {
            onSelectMethod(method)
        } label: {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .frame(width: 32, height: 32)
                    .overlay(Icon(method.icon, size: 15, strokeWidth: 2.2, color: Theme.Color.primary600))
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(method.title)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        if method == .phone {
                            Text("RECOMMENDED")
                                .font(.system(size: 9, weight: .bold))
                                .kerning(0.3)
                                .foregroundStyle(Theme.Color.success)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.Color.successBg)
                                .clipShape(Capsule())
                        }
                    }
                    Text(candidate.value(for: method))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Icon(
                    selectedMethod == method ? .checkCircle : .chevronRight,
                    size: 16,
                    color: selectedMethod == method ? Theme.Color.primary600 : Theme.Color.appTextMuted
                )
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedMethod == method ? .isSelected : [])
        .accessibilityIdentifier("startSupportTrainInviteMethod_\(method.rawValue)")
    }

    private var privacyHint: some View {
        HStack(alignment: .top, spacing: 6) {
            Icon(.info, size: 12, color: Theme.Color.appTextMuted)
                .padding(.top, 1)
            Text(
                "\(firstName) gets a link to confirm the train and choose what's visible. " +
                    "They don't need a Pantopus account to receive help."
            )
            .font(.system(size: 11))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s1)
        .accessibilityIdentifier("startSupportTrainInviteInfoHint")
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
