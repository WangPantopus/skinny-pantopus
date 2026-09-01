//
//  EdgeComponents.swift
//  Pantopus
//
//  Stream I7 (Invitee edge & customer) — the small, token-only design atoms the
//  edge screens (D5–D12) share, matched to the Calendarly mockups: the A18
//  tone-driven icon halo, the sticky bottom dock, the amber/green note card,
//  the booking summary card, the status badge, action rows, the timezone pill,
//  and the host-pillar avatar. Tokens only — no hardcoded colors/spacing.
//

import SwiftUI

// MARK: - Tone

/// The A18 semantic tone shared by halos, note cards and chips. Maps to the
/// design's fg / bg / ring triples without touching hex.
enum EdgeTone: Equatable {
    case warning, success, info, error, neutral

    var foreground: Color {
        switch self {
        case .warning: Theme.Color.warning
        case .success: Theme.Color.success
        case .info: Theme.Color.info
        case .error: Theme.Color.error
        case .neutral: Theme.Color.appTextMuted
        }
    }

    var background: Color {
        switch self {
        case .warning: Theme.Color.warningBg
        case .success: Theme.Color.successBg
        case .info: Theme.Color.infoBg
        case .error: Theme.Color.errorBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    var ring: Color {
        switch self {
        case .warning: Theme.Color.warningLight
        case .success: Theme.Color.successLight
        case .info: Theme.Color.primary100
        case .error: Theme.Color.errorLight
        case .neutral: Theme.Color.appBorder
        }
    }
}

// MARK: - Icon halo (A18 double-circle hero)

/// The calm "status halo": a soft outer disc behind a ringed inner disc with a
/// centered glyph. Used by the slot-taken, payment, terminal and hand-off
/// screens.
struct EdgeIconHalo: View {
    let icon: PantopusIcon
    var tone: EdgeTone = .neutral
    /// Outer diameter; inner disc + glyph scale from it.
    var size: CGFloat = 84

    var body: some View {
        ZStack {
            Circle()
                .fill(tone.background.opacity(0.6))
                .frame(width: size, height: size)
            Circle()
                .fill(tone.background)
                .overlay(Circle().stroke(tone.ring, lineWidth: 2))
                .frame(width: size * 0.78, height: size * 0.78)
            Icon(icon, size: size * 0.36, strokeWidth: 1.9, color: tone.foreground)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Sticky bottom dock

/// The translucent bottom dock the edge designs pin their CTAs to. Place via
/// `.safeAreaInset(edge: .bottom) { EdgeDock { … } }`.
struct EdgeDock<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: Spacing.s2) {
            content
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

// MARK: - Overline

/// Uppercase muted section label; the `alert` tone adds the attention glyph
/// (D11 "NEEDS ATTENTION").
struct EdgeOverline: View {
    let text: String
    var alert: Bool = false

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if alert {
                Icon(.alertCircle, size: 12, strokeWidth: 2.2, color: Theme.Color.warning)
            }
            Text(text.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(alert ? Theme.Color.warning : Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Note card (A18 amber/green policy note)

/// A tone-tinted note card: a glyph tile, a bold title, a body line, and an
/// optional "still" footer (the design's secondary "you can still …" row).
struct EdgeNoteCard: View {
    let icon: PantopusIcon
    var tone: EdgeTone = .warning
    let title: String
    let message: String
    var stillNote: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(icon, size: 16, strokeWidth: 2.1, color: tone.foreground)
                    .frame(width: 30, height: 30)
                    .background(Theme.Color.appSurface.opacity(0.7))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .stroke(tone.ring, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(message)
                        .font(.system(size: 11.5))
                        .foregroundStyle(tone.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if let stillNote {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.info, size: 12, strokeWidth: 2.2, color: tone.foreground)
                    Text(stillNote)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(.top, Spacing.s2)
                .padding(.leading, 42)
                .overlay(alignment: .top) {
                    Rectangle().fill(tone.ring).frame(height: 1).padding(.top, Spacing.s1)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

// MARK: - Conditional shadow

extension View {
    /// Apply a `PantopusShadow` only when one is provided (the shared
    /// `pantopusShadow` takes a non-optional, so this guards the selected-only
    /// shadow on chips/segments). Mirrors the I4 `bookingShadow` idiom locally.
    @ViewBuilder
    func edgeShadow(_ shadow: PantopusShadow?) -> some View {
        if let shadow { pantopusShadow(shadow) } else { self }
    }
}

// MARK: - Timezone pill

/// Globe + DST-aware abbreviation chip ("PDT") shown on summary rows.
struct EdgeTimezonePill: View {
    let tz: String
    var accent: Color = Theme.Color.primary600

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.globe, size: 10, strokeWidth: 2.2, color: accent)
            Text(abbreviation)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(accent.opacity(0.12))
        .clipShape(Capsule())
        .accessibilityLabel("Times shown in \(abbreviation)")
    }

    private var abbreviation: String {
        let zone = TimeZone(identifier: tz)
        if let abbr = zone?.abbreviation(), !abbr.isEmpty, !abbr.hasPrefix("GMT") {
            return abbr
        }
        return tz.split(separator: "/").last.map { $0.replacingOccurrences(of: "_", with: " ") } ?? tz
    }
}

// MARK: - Host-pillar avatar

/// Gradient disc + initials with a pillar identity dot. The accent + glyph come
/// from the booking/page `owner_type`.
struct EdgePillarAvatar: View {
    let name: String?
    var ownerType: String?
    var size: CGFloat = 42

    private var accent: Color {
        EdgeOwnerTheme.accent(forOwnerType: ownerType)
    }

    /// Design gradient stops (my-bookings-frames.jsx:24-27):
    /// personal: primary400 (38bdf8) → primary700 (0369a1)
    /// home:     home (16a34a, light stop) → homeDark (15803d, dark stop)
    /// business: business (7c3aed, light stop) → businessDark (5B21B6, dark stop)
    /// Token-only; no hex literals.
    private var gradientColors: [Color] {
        let owner = EdgeOwnerTheme.owner(forOwnerType: ownerType)
        switch owner {
        case .personal:
            return [Theme.Color.primary400, Theme.Color.primary700]
        case .home:
            return [Theme.Color.home, Theme.Color.homeDark]
        case .business:
            return [Theme.Color.business, Theme.Color.businessDark]
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                LinearGradient(
                    colors: gradientColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Text(EdgeOwnerTheme.initials(name))
                    .font(.system(size: size * 0.32, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: size, height: size)
            .clipShape(Circle())

            ZStack {
                Circle().fill(accent)
                Icon(EdgeOwnerTheme.icon(forOwnerType: ownerType), size: size * 0.24, color: Theme.Color.appTextInverse)
            }
            .frame(width: size * 0.32, height: size * 0.32)
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Action row

/// A tappable manage action: glyph tile + title + sub + chevron. Used by the
/// within-policy state (D10).
struct EdgeActionRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    var tone: EdgeTone = .info
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 16, strokeWidth: 2, color: tone.foreground)
                    .frame(width: 32, height: 32)
                    .background(tone.background)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(tone == .error ? Theme.Color.error : Theme.Color.appText)
                    Text(subtitle)
                        .font(.system(size: 10.5))
                        .foregroundStyle(tone == .error ? Theme.Color.error : Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.edge.actionRow.\(title)")
    }
}
