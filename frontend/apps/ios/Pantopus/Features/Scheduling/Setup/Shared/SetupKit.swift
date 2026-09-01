//
//  SetupKit.swift
//  Pantopus
//
//  I1-local building blocks for the Setup & Hub screens (A1–A6). These are the
//  bespoke pieces the design needs that the Foundation SharedUI kit doesn't
//  provide (top bar, identity pill switcher, pillar-accented CTA, card surface,
//  mini toggle, section overline). Identity accent comes from
//  `SchedulingIdentityTheme`; everything else is design tokens only.
//

import SwiftUI

// MARK: - Top bar (56pt)

/// The 56pt top bar used by the hub + settings (non-wizard) screens.
struct SetupTopBar: View {
    enum Leading { case none, back, close }

    let title: String
    var leading: Leading = .back
    var onLeading: (() -> Void)?
    var trailingIcon: PantopusIcon?
    var trailingLabel: String?
    var onTrailing: (() -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s0) {
            leadingControl.frame(width: 36, height: 36)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            trailingControl.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 56)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }

    @ViewBuilder private var leadingControl: some View {
        switch leading {
        case .none:
            Color.clear
        case .back, .close:
            Button { onLeading?() } label: {
                Icon(leading == .back ? .chevronLeft : .x, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .accessibilityIdentifier(leading == .back ? "schedulingTopBarBack" : "schedulingTopBarClose")
            .accessibilityLabel(leading == .back ? "Back" : "Close")
        }
    }

    @ViewBuilder private var trailingControl: some View {
        if let trailingIcon {
            Button { onTrailing?() } label: {
                Icon(trailingIcon, size: 22, color: Theme.Color.appText).frame(width: 36, height: 36)
            }
            .accessibilityIdentifier("schedulingTopBarTrailing")
            .accessibilityLabel(trailingLabel ?? "More options")
        } else {
            Color.clear
        }
    }
}

// MARK: - Identity pill switcher (A1)

/// Personal / Home / Business switcher. Active pillar tints a soft top gradient
/// and fills its pill; tapping re-scopes the hub.
struct SetupIdentityPills: View {
    let active: SchedulingOwner
    let onSelect: (SchedulingPillarChoice) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(SchedulingPillarChoice.allCases) { choice in
                pill(choice)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurface)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, 14)
        .background(
            LinearGradient(colors: [active.theme.accentBg, Theme.Color.appSurface], startPoint: .top, endPoint: .bottom)
        )
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1) }
    }

    private func pill(_ choice: SchedulingPillarChoice) -> some View {
        let on = choice.matches(active)
        return Button { onSelect(choice) } label: {
            HStack(spacing: 5) {
                Icon(choice.icon, size: 12, strokeWidth: 2.4, color: on ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                Text(choice.title)
                    .font(.system(size: 12, weight: .bold))
                    .tracking(-0.05)
                    .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 32)
            .background(on ? choice.accent : Color.clear)
            .clipShape(Capsule())
        }
        .accessibilityIdentifier("schedulingPillar_\(choice.rawValue)")
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }
}

/// The pillar a user can switch to from the hub. Distinct from `SchedulingOwner`
/// because Home/Business owners need an id resolved before switching.
enum SchedulingPillarChoice: String, CaseIterable, Identifiable {
    case personal, home, business
    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .personal: .user
        case .home: .house
        // The A1 Hub identity switcher uses the storefront glyph for Business
        // (per scheduling-hub-frames); the editors/onboarding pills use
        // `briefcase` via SchedulingIdentityTheme.
        case .business: .store
        }
    }

    var accent: Color {
        switch self {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    func matches(_ owner: SchedulingOwner) -> Bool {
        switch (self, owner) {
        case (.personal, .personal), (.home, .home), (.business, .business): true
        default: false
        }
    }
}

// MARK: - CTAs (pillar-accented)

/// Full-width pillar-accented CTA (footer / empty-state). Sky for personal,
/// green for home, violet for business.
struct SetupPrimaryCTA: View {
    let title: String
    var icon: PantopusIcon?
    var iconTrailing: Bool = true
    var owner: SchedulingOwner
    var height: CGFloat = 48
    var enabled: Bool = true
    var fontSize: CGFloat = 14.5
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon, !iconTrailing {
                    Icon(icon, size: 17, strokeWidth: 2.2, color: labelColor)
                }
                Text(title).font(.system(size: fontSize, weight: .bold)).tracking(-0.1).foregroundStyle(labelColor)
                if let icon, iconTrailing {
                    Icon(icon, size: 16, color: labelColor)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(enabled ? owner.theme.accent : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(enabled ? owner.theme.ctaShadow : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
        }
        .disabled(!enabled)
        .accessibilityIdentifier("schedulingPrimaryCTA")
    }

    private var labelColor: Color {
        enabled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
    }
}

/// Bordered neutral button.
struct SetupGhostCTA: View {
    let title: String
    var icon: PantopusIcon?
    var height: CGFloat = 48
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon { Icon(icon, size: 15, color: Theme.Color.appTextStrong) }
                Text(title).font(.system(size: 13, weight: .semibold)).tracking(-0.1).foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .padding(.horizontal, 14)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
    }
}

// MARK: - Card surface

extension View {
    /// White card surface: 1px border + soft shadow + rounded corners.
    func setupCard(radius: CGFloat = Radii.xl, shadow: PantopusShadow = .sm) -> some View {
        background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .pantopusShadow(shadow)
    }
}

// MARK: - Mini toggle (32×18)

struct SetupMiniToggle: View {
    let isOn: Bool
    let accent: Color

    var body: some View {
        ZStack(alignment: isOn ? .trailing : .leading) {
            Capsule().fill(isOn ? accent : Theme.Color.appBorderStrong).frame(width: 32, height: 18)
            Circle().fill(Theme.Color.appSurface).frame(width: 14, height: 14).pantopusShadow(.sm).padding(.horizontal, 2)
        }
        .animation(.easeInOut(duration: 0.15), value: isOn)
        .accessibilityAddTraits(isOn ? [.isSelected] : [])
    }
}

// MARK: - Section header (overline + optional action)

struct SetupSectionHeader: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .center) {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.84)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 2) {
                        Text(actionTitle).font(.system(size: 12, weight: .semibold)).tracking(-0.05)
                        Icon(.chevronRight, size: 13, color: Theme.Color.primary600)
                    }
                    .foregroundStyle(Theme.Color.primary600)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s5)
        .padding(.bottom, Spacing.s2)
    }
}

// MARK: - Inline chip

enum SetupChipTone { case success, warning, primary, neutral

    var bg: Color {
        switch self {
        case .success: Theme.Color.successLight
        case .warning: Theme.Color.warmAmberBg
        case .primary: Theme.Color.primary50
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    var fg: Color {
        switch self {
        case .success: Theme.Color.success
        case .warning: Theme.Color.warmAmber
        case .primary: Theme.Color.primary700
        case .neutral: Theme.Color.appTextStrong
        }
    }
}

struct SetupChip: View {
    let text: String
    var icon: PantopusIcon?
    var tone: SetupChipTone = .neutral

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon { Icon(icon, size: 10, strokeWidth: 3, color: tone.fg) }
            Text(text.uppercased()).font(.system(size: 10.5, weight: .bold)).tracking(0.4).foregroundStyle(tone.fg)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(tone.bg)
        .clipShape(Capsule())
    }
}

// MARK: - Small helpers

/// Rounded icon tile (leading glyph in rows / banners).
func setupIconTile(_ icon: PantopusIcon, bg: Color, fg: Color, size: CGFloat = 34, glyph: CGFloat = 18) -> some View {
    ZStack {
        RoundedRectangle(cornerRadius: 9, style: .continuous).fill(bg)
        Icon(icon, size: glyph, color: fg)
    }
    .frame(width: size, height: size)
}

/// Two-letter initials from a name.
func setupInitials(_ name: String?) -> String {
    guard let name, !name.isEmpty else { return "?" }
    let parts = name.split(separator: " ").prefix(2)
    return parts.compactMap(\.first).map(String.init).joined().uppercased()
}
