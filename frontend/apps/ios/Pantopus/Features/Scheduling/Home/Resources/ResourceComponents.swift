//
//  ResourceComponents.swift
//  Pantopus
//
//  Stream I12 — shared SwiftUI components for the home resources & visits
//  surfaces (F9–F14). Home-green pillar identity; theme tokens only.
//

import SwiftUI

// MARK: - Member avatar

/// Initials disc tinted from the member's stable palette tone. Falls back to
/// a remote avatar image when present.
struct ResourceHomeMemberAvatar: View {
    let member: ResourceHomeMember
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            Circle().fill(tone.background)
            if let url = member.avatarURL {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    initials
                }
                .clipShape(Circle())
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        .accessibilityLabel(member.name)
    }

    private var initials: some View {
        Text(member.initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(tone.foreground)
    }

    private var tone: (background: Color, foreground: Color) {
        switch member.tone {
        case .green: (Theme.Color.homeBg, Theme.Color.home)
        case .sky: (Theme.Color.personalBg, Theme.Color.personal)
        case .violet: (Theme.Color.businessBg, Theme.Color.business)
        case .amber: (Theme.Color.warningBg, Theme.Color.warning)
        case .rose: (Theme.Color.errorBg, Theme.Color.error)
        case .teal: (Theme.Color.successBg, Theme.Color.success)
        }
    }
}

/// Overlapping avatar stack for the visit host-members card.
struct HomeMemberStack: View {
    let members: [ResourceHomeMember]
    var size: CGFloat = 30

    var body: some View {
        HStack(spacing: -9) {
            ForEach(members) { member in
                ResourceHomeMemberAvatar(member: member, size: size)
            }
        }
    }
}

// MARK: - Buttons (home-green pillar)

/// Full-width home-green primary CTA. Mirrors the design's `PrimaryBtn`
/// (46pt, 12pt radius, soft green glow).
struct HomePrimaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var isEnabled: Bool = true
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    HStack(spacing: Spacing.s2) {
                        if let icon {
                            Icon(icon, size: 16, color: foreground)
                        }
                        Text(title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(foreground)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(isEnabled ? Theme.Color.home : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .shadow(color: isEnabled ? Theme.Color.home.opacity(0.28) : .clear, radius: 8, y: 4)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
    }

    private var foreground: Color {
        isEnabled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
    }
}

/// Compact inline action (34pt) — home-green filled or bordered. Used for the
/// approval queue and side-by-side footer actions.
struct InlineHomeButton: View {
    let title: String
    var icon: PantopusIcon?
    var filled: Bool = true
    var tone: Color?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                if let icon {
                    Icon(icon, size: 13, color: foreground)
                }
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(foreground)
            }
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(filled ? (tone ?? Theme.Color.home) : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(filled ? .clear : Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var foreground: Color {
        filled ? Theme.Color.appTextInverse : (tone ?? Theme.Color.appTextStrong)
    }
}

/// White / bordered secondary CTA.
struct HomeSecondaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var tone: Color = Theme.Color.appTextStrong
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon {
                    Icon(icon, size: 15, color: tone)
                }
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tone)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

// MARK: - Rule chip

/// Small icon + label pill used for resource rule summaries. `.home` tone for
/// the resource detail header, `.neutral` for the booking-screen reminder.
struct RuleChip: View {
    enum Tone { case home, neutral }

    let icon: PantopusIcon
    let text: String
    var tone: Tone = .home

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 11, color: foreground)
            Text(text)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 4)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var foreground: Color {
        tone == .home ? Theme.Color.home : Theme.Color.appTextSecondary
    }

    private var background: Color {
        tone == .home ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken
    }
}

/// Sunken type badge (e.g. "Charger") shown under a resource name.
struct TypeBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

// MARK: - Section card

/// White card with an optional home-green overline + trailing action. Used by
/// the read-only detail surfaces (F11 / F14) that don't sit inside a FormShell.
struct SectionCard<Content: View>: View {
    var overline: String?
    var trailing: AnyView?
    @ViewBuilder var content: () -> Content

    init(
        overline: String? = nil,
        trailing: AnyView? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.overline = overline
        self.trailing = trailing
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if overline != nil || trailing != nil {
                HStack {
                    if let overline {
                        // Design spec: Section overlines use H.accent700 (darker home
                        // green), not H.accent (home-600). `homeDark` is the closest
                        // token — see F12 nit finding.
                        Text(overline.uppercased())
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(Theme.Color.homeDark)
                            .accessibilityAddTraits(.isHeader)
                    }
                    Spacer()
                    if let trailing {
                        trailing
                    }
                }
            }
            content()
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

/// Uppercase grey section label rendered above a list of detail rows.
struct ResourceOverlineLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Selection check

/// Circular selection check used in the member pickers (F10 / F13).
struct SelectionCheck: View {
    let isOn: Bool

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(isOn ? Theme.Color.home : Theme.Color.appBorderStrong, lineWidth: 1.5)
                .background(Circle().fill(isOn ? Theme.Color.home : .clear))
            if isOn {
                Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
        }
        .frame(width: 20, height: 20)
        .accessibilityHidden(true)
    }
}
