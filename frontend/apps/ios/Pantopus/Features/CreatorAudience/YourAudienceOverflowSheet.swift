//
//  YourAudienceOverflowSheet.swift
//  Pantopus
//
//  A22.2 "Your audience" — the per-member overflow (•••) action sheet:
//  Message · Change tier · Mute/Unmute · Remove · Block (destructive).
//  Mute / unmute / remove map to
//  `PATCH /me/audience/:membershipId { action }`; block goes through
//  `PATCH /personas/:id/followers/:membershipId { status: "blocked" }`
//  because the action verb list has no block. Ordering mirrors RN's
//  `src/components/audience/AudienceMemberSheet.tsx:78-115`, which puts
//  the reversible action first so Remove is harder to fat-finger.
//

import SwiftUI

struct YourAudienceOverflowSheet: View {
    let member: AudienceMember
    let onMessage: () -> Void
    let onChangeTier: () -> Void
    let onMute: () -> Void
    let onUnmute: () -> Void
    let onRemove: () -> Void
    let onBlock: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(member.displayName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(member.handle)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.bottom, Spacing.s2)

            actionRow(
                icon: .messageCircle,
                title: "Message",
                tint: Theme.Color.appText,
                id: "audienceOverflow.message"
            ) {
                onMessage()
                dismiss()
            }

            actionRow(
                icon: .crown,
                title: "Change tier",
                tint: Theme.Color.appText,
                id: "audienceOverflow.changeTier"
            ) {
                onChangeTier()
                dismiss()
            }

            if member.isMuted {
                actionRow(
                    icon: .bell,
                    title: "Unmute",
                    subtitle: "Restore their access to your updates",
                    tint: Theme.Color.appText,
                    id: "audienceOverflow.unmute"
                ) {
                    onUnmute()
                    dismiss()
                }
            } else {
                actionRow(
                    icon: .bellOff,
                    title: "Mute this member",
                    subtitle: "They won't receive your broadcasts. Reversible.",
                    tint: Theme.Color.appText,
                    id: "audienceOverflow.mute"
                ) {
                    onMute()
                    dismiss()
                }
            }

            actionRow(
                icon: .userMinus,
                title: "Remove",
                tint: Theme.Color.error,
                id: "audienceOverflow.remove"
            ) {
                onRemove()
                dismiss()
            }

            actionRow(
                icon: .ban,
                title: "Block",
                subtitle: "They lose access to follower-only updates.",
                tint: Theme.Color.error,
                id: "audienceOverflow.block"
            ) {
                onBlock()
                dismiss()
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("audienceOverflowSheet")
    }

    private func actionRow(
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil,
        tint: Color,
        id: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 18, color: tint)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(tint)
                    if let subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer()
            }
            .padding(.vertical, Spacing.s3)
            .padding(.horizontal, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Theme.Color.appSurfaceSunken)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}
