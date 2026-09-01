//
//  HomeVerificationFrame.swift
//  Pantopus
//
//  Renders `HomeVerificationContent` — the Verification Center frame of
//  the A18.4 room. Reuses `HaloCircle` for the status disc, then stacks
//  the headline / body / optional date card / full-width action cards
//  the way RN does (`src/app/homes/[id]/waiting-room.tsx:83-225`).
//
//  Pure presentational: every tap is handed back through `onAction`.
//  Mirrors Android `HomeVerificationFrame` in `WaitingRoomScreen.kt`.
//

import SwiftUI

struct HomeVerificationFrame: View {
    let content: HomeVerificationContent
    let onAction: @MainActor (HomeVerificationAction) -> Void
    let onDone: @MainActor () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                HaloCircle(
                    tone: content.halo.tone,
                    icon: content.halo.icon,
                    isPulsing: content.halo.isPulsing
                )
                .padding(.top, Spacing.s2)
                headlineBlock
                if let countdown = content.countdown {
                    countdownCard(countdown)
                }
                actionStack
                doneButton
                Spacer(minLength: Spacing.s4)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.vertical, Spacing.s4)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier("waitingRoomVerification")
    }

    // MARK: - Slots

    private var headlineBlock: some View {
        VStack(spacing: Spacing.s2) {
            Text(content.headline)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("verificationHeadline")
            Text(content.body)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("verificationBody")
        }
        .frame(maxWidth: .infinity)
    }

    private func countdownCard(_ countdown: HomeVerificationCountdown) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(countdown.icon, size: 20, strokeWidth: 2.2, color: Theme.Color.primary600)
            VStack(alignment: .leading, spacing: 2) {
                Text(countdown.label)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(countdown.value)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3 + 2)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("verificationCountdown")
    }

    private var actionStack: some View {
        VStack(spacing: Spacing.s2 + 2) {
            ForEach(content.actions) { action in
                Button { onAction(action) } label: {
                    actionCard(action)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("verificationAction_\(action.id)")
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("verificationActions")
    }

    private func actionCard(_ action: HomeVerificationAction) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(action.icon, size: 22, strokeWidth: 2.2, color: foreground(for: action.tone))
            VStack(alignment: .leading, spacing: 2) {
                Text(action.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(foreground(for: action.tone))
                    .multilineTextAlignment(.leading)
                if let subtitle = action.subtitle {
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: Spacing.s2)
            Icon(.chevronRight, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
        }
        .padding(Spacing.s3 + 2)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(border(for: action.tone), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var doneButton: some View {
        Button(action: onDone) {
            Text(content.doneLabel)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("verificationDone")
    }

    // MARK: - Palette

    private func foreground(for tone: WaitingRoomActionTone) -> Color {
        switch tone {
        case .standard: Theme.Color.appText
        case .primary: Theme.Color.primary700
        case .danger: Theme.Color.error
        }
    }

    private func border(for tone: WaitingRoomActionTone) -> Color {
        switch tone {
        case .standard: Theme.Color.appBorder
        case .primary: Theme.Color.primary200
        case .danger: Theme.Color.errorLight
        }
    }
}

#Preview("Verification Center · pending postcard") {
    HomeVerificationFrame(
        content: HomeVerificationContent.make(
            status: .pendingPostcard,
            postcardExpiresAt: "2026-09-01T00:00:00Z"
        ),
        onAction: { _ in },
        onDone: {}
    )
}
