//
//  FollowingActionSheet.swift
//  Pantopus
//
//  §1A① Frames 2 + 3 — the row overflow action sheet and its mute
//  sub-step, presented as one bottom sheet that swaps between an "actions"
//  step and a "mute duration" step (back chevron returns). Driven by the
//  VM's `actionTarget` binding.
//

import SwiftUI

struct FollowingActionSheet: View {
    let target: FollowingActionTarget
    let onMarkSeen: @MainActor () -> Void
    let onMute: @MainActor (Int?) -> Void
    let onUnfollow: @MainActor () -> Void
    var onNotificationLevel: @MainActor (FollowingNotificationLevel) -> Void = { _ in }
    let onCancel: @MainActor () -> Void

    private enum Step { case actions, mute }
    @State private var step: Step = .actions
    @State private var showCustom = false
    @State private var customDays = 90

    var body: some View {
        VStack(spacing: Spacing.s2) {
            switch step {
            case .actions: actionsCard
            case .mute: muteCard
            }
            cancelCard
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .background(Theme.Color.appSurfaceMuted)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Actions step (Frame 2)

    private var actionsCard: some View {
        VStack(spacing: 0) {
            contextHeader
            divider
            notificationLevelPicker
            divider
            sheetRow(icon: .checkCheck, label: "Mark seen", id: "followingAction.markSeen") {
                onMarkSeen()
            }
            divider
            sheetRow(
                icon: .bellOff,
                label: "Mute",
                sub: "No updates while muted",
                trailingChevron: true,
                id: "followingAction.mute"
            ) {
                step = .mute
            }
            divider
            sheetRow(icon: .userMinus, label: "Unfollow", destructive: true, id: "followingAction.unfollow") {
                onUnfollow()
            }
        }
        .background(card)
        .accessibilityIdentifier("followingActionSheet")
    }

    /// All / Highlights / Off segmented picker — the same three levels the
    /// inline row bell cycles, spelled out. Mirrors RN `FollowingRowSheet`'s
    /// notification section.
    private var notificationLevelPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Notifications")
                .font(.system(size: 12, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
            HStack(spacing: 2) {
                ForEach(FollowingNotificationLevel.allCases, id: \.self) { level in
                    let active = level == target.notificationLevel
                    Button { onNotificationLevel(level) } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(
                                level.icon,
                                size: 13,
                                color: active ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                            )
                            Text(level.label)
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(active ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .fill(active ? Theme.Color.appSurface : Color.clear)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("followingNotify.\(level.rawValue)")
                }
            }
            .padding(3)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
            )
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .accessibilityIdentifier("followingNotifyPicker")
    }

    private var contextHeader: some View {
        HStack(spacing: Spacing.s3) {
            FollowingAvatar(
                initials: target.initials,
                color: target.tone.color,
                imageURL: nil,
                verified: target.verified,
                size: 38
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(target.displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("@\(target.handle)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    // MARK: - Mute step (Frame 3)

    private var muteCard: some View {
        VStack(spacing: 0) {
            muteHeader
            ForEach(FollowingMutePreset.allCases, id: \.self) { preset in
                divider
                sheetRow(icon: .clock, label: preset.label, id: preset.accessibilityID) {
                    onMute(preset.days)
                }
            }
            divider
            sheetRow(
                icon: .slidersHorizontal,
                label: "Custom\u{2026}",
                sub: "Up to 1 year",
                trailingChevron: !showCustom,
                id: "followingMute.custom"
            ) {
                withAnimation { showCustom.toggle() }
            }
            if showCustom { customPicker }
        }
        .background(card)
        .accessibilityIdentifier("followingMuteSheet")
    }

    private var muteHeader: some View {
        HStack(spacing: Spacing.s2) {
            Button {
                showCustom = false
                step = .actions
            } label: {
                Icon(.chevronLeft, size: 21, strokeWidth: 2.2, color: Theme.Color.appTextStrong)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            VStack(alignment: .leading, spacing: 1) {
                Text("Mute \(target.displayName)")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("You can unmute anytime in settings")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s3)
    }

    private var customPicker: some View {
        VStack(spacing: Spacing.s3) {
            Stepper(value: $customDays, in: 1...followingMuteMaxDays) {
                Text("\(customDays) day\(customDays == 1 ? "" : "s")")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
            }
            .accessibilityIdentifier("followingMute.customStepper")
            Button {
                onMute(customDays)
            } label: {
                Text("Mute for \(customDays) day\(customDays == 1 ? "" : "s")")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.s3)
                    .background(RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.primary600))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("followingMute.customApply")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    // MARK: - Cancel

    private var cancelCard: some View {
        Button(action: onCancel) {
            Text("Cancel")
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .background(card)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("followingActionCancel")
    }

    // MARK: - Building blocks

    private func sheetRow(
        icon: PantopusIcon,
        label: String,
        sub: String? = nil,
        destructive: Bool = false,
        trailingChevron: Bool = false,
        id: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 20, color: destructive ? Theme.Color.error : Theme.Color.appText)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 15.5, weight: .medium))
                        .foregroundStyle(destructive ? Theme.Color.error : Theme.Color.appText)
                    if let sub {
                        Text(sub)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: 0)
                if trailingChevron {
                    Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorderSubtle)
            .frame(height: 1)
            .padding(.leading, Spacing.s12)
    }

    private var card: some View {
        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
            .fill(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}
