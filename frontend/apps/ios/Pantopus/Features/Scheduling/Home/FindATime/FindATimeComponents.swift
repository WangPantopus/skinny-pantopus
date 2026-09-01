//
//  FindATimeComponents.swift
//  Pantopus
//
//  Stream I11 — shared SwiftUI atoms for the find-a-time / who's-free screens:
//  a standalone member avatar (the app's existing avatars are row- or
//  ring-bound), an overlapping free/busy member dot stack, a white section
//  card, and a green section overline. Tokens only — no hardcoded colours.
//

import SwiftUI

/// Initials over the member's deterministic gradient (home members are keyed by
/// bare UUID, so colour comes from `MemberAvatarTone.tone(for:)`).
struct MemberAvatarBadge: View {
    let member: FindATimeMember
    var size: CGFloat = 28
    var dimmed: Bool = false
    var showsBorder: Bool = true

    var body: some View {
        let gradient = member.tone.gradient
        Circle()
            .fill(
                LinearGradient(
                    colors: [gradient.start, gradient.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: size, height: size)
            .overlay {
                Text(member.initials)
                    .font(.system(size: size * 0.38, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .overlay {
                if showsBorder {
                    Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2)
                }
            }
            .opacity(dimmed ? 0.4 : 1)
            .accessibilityHidden(true)
    }
}

/// Overlapping member avatars with a free/busy corner dot — the suggested-slot
/// "All 3 free" / "2 of 3 free" cluster (F5) and the proposal-sent cluster.
struct MemberDotStack: View {
    let members: [FindATimeMember]
    let freeIds: Set<String>
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: -6) {
            ForEach(members) { member in
                MemberAvatarBadge(member: member, size: size, dimmed: !freeIds.contains(member.id))
                    .overlay(alignment: .bottomTrailing) {
                        Circle()
                            .fill(freeIds.contains(member.id) ? Theme.Color.home : Theme.Color.appBorderStrong)
                            .frame(width: size * 0.4, height: size * 0.4)
                            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 1.5))
                    }
            }
        }
        .accessibilityElement()
        .accessibilityLabel(Text(membersAccessibilityLabel))
    }

    private var membersAccessibilityLabel: String {
        let freeNames = members.filter { freeIds.contains($0.id) }.map(\.displayName)
        if freeNames.count == members.count { return "Everyone free" }
        return "\(freeNames.count) of \(members.count) free"
    }
}

/// A white rounded section card matching the family-scheduling design system
/// (16pt radius, 1pt border, soft shadow).
struct FindATimeCard<Content: View>: View {
    private let spacing: CGFloat
    private let content: Content

    init(spacing: CGFloat = Spacing.s3, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            content
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        }
    }
}

/// Uppercase section overline (home green by default, matching the design).
struct FindATimeOverline: View {
    let text: String
    var color: Color = Theme.Color.homeDark

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A uniform-accent segmented control (home green selected) — duration,
/// round-robin rule, and the Day/Week toggle. The home-shell design renders the
/// same pill-in-a-sunken-track shape across all these.
struct FindATimeSegmented: View {
    let options: [String]
    let selectedIndex: Int
    var accent: Color = Theme.Color.home
    var height: CGFloat = 34
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(options.enumerated()), id: \.offset) { index, label in
                let isOn = index == selectedIndex
                Button { onSelect(index) } label: {
                    Text(label)
                        .font(.system(size: 12, weight: isOn ? .bold : .semibold))
                        .foregroundStyle(isOn ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: height)
                        .background(isOn ? accent : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

/// A small inline error/help line with a leading alert glyph.
struct FindATimeInlineError: View {
    let message: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
            Icon(.alertCircle, size: 12, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.error)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Home-green filled CTA with an optional leading glyph. The shared
/// `PrimaryButton` is fixed to the sky `primary600`; the family pillar needs a
/// green action, so this pillar-tints it (tokens only).
struct FindATimePrimaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () async -> Void

    var body: some View {
        Button { Task { await action() } } label: {
            HStack(spacing: Spacing.s2) {
                if isLoading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else if let icon {
                    Icon(icon, size: 16, color: foreground)
                }
                if !isLoading {
                    Text(title)
                }
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(isEnabled ? Theme.Color.home : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }

    private var foreground: Color {
        isEnabled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
    }
}

/// Outlined neutral CTA with an optional leading glyph (Send proposal, Widen
/// the window, View responses).
struct FindATimeSecondaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var isLoading: Bool = false
    let action: () async -> Void

    var body: some View {
        Button { Task { await action() } } label: {
            HStack(spacing: Spacing.s2) {
                if isLoading {
                    ProgressView().tint(Theme.Color.appTextStrong)
                } else if let icon {
                    Icon(icon, size: 15, color: Theme.Color.appTextStrong)
                }
                if !isLoading {
                    Text(title)
                }
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(Theme.Color.appTextStrong)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }
}
