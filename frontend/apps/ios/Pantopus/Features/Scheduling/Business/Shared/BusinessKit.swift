//
//  BusinessKit.swift
//  Pantopus
//
//  Stream I13 (Business config & team) — shared violet primitives reused across
//  G1 Round-robin, G2 Collective, G3 Team availability, G4 Member hours, and
//  G5 Business settings. Mirrors `biz-kit.jsx` from the design suite. Tokens
//  only (Theme.Color.* / Spacing / Radii / Icon) — no hardcoded colors.
//  Business pillar accent is `Theme.Color.business`; functional CTAs stay
//  product sky (`Theme.Color.primary600`) per the design's non-negotiables.
//

import SwiftUI

// MARK: - Owner helper

extension SchedulingOwner {
    /// The business user id when this owner is a business, else nil. Drives the
    /// `/api/businesses/:id/*` roster + access reads and the `team-availability`
    /// owner scoping.
    var businessIdValue: String? {
        if case let .business(id) = self { return id }
        return nil
    }
}

// MARK: - Semantic tones

/// Inline-note / chip tones mapped to design-system tokens.
enum BizTone {
    case info // business-tinted neutral note (design `Note tone="info"`)
    case infoBlue
    case warning
    case error
    case success
    case neutral
    case biz

    var bg: Color {
        switch self {
        case .info: Theme.Color.businessBg
        case .infoBlue: Theme.Color.infoBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .success: Theme.Color.successBg
        case .neutral: Theme.Color.appSurfaceSunken
        case .biz: Theme.Color.businessBg
        }
    }

    var fg: Color {
        switch self {
        case .info: Theme.Color.appTextStrong
        case .infoBlue: Theme.Color.appTextStrong
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .success: Theme.Color.success
        case .neutral: Theme.Color.appTextStrong
        case .biz: Theme.Color.business
        }
    }

    var icon: Color {
        switch self {
        case .info, .biz: Theme.Color.business
        case .infoBlue: Theme.Color.info
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .success: Theme.Color.success
        case .neutral: Theme.Color.appTextSecondary
        }
    }

    /// Border color (nil → no border, for the soft `info` note).
    var border: Color? {
        switch self {
        case .info: nil
        case .infoBlue: Theme.Color.infoLight
        case .warning: Theme.Color.warningLight
        case .error: Theme.Color.errorLight
        case .success: Theme.Color.successLight
        case .neutral: Theme.Color.appBorder
        case .biz: nil
        }
    }
}

// MARK: - Card

/// White card · 1px border · 16pt radius · soft shadow. Mirrors `biz-kit Card`.
struct BizCard<Content: View>: View {
    var padding = EdgeInsets(top: Spacing.s1, leading: 13, bottom: Spacing.s1, trailing: 13)
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .pantopusShadow(.sm)
    }
}

// MARK: - Overline

/// Uppercase section overline. Business violet by default.
struct BizOverline: View {
    let text: String
    var color: Color = Theme.Color.business

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Inline note

/// Semantic-tinted SLA / warning / info row. Mirrors `biz-kit Note`.
struct BizNote: View {
    let tone: BizTone
    var icon: PantopusIcon?
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            if let icon {
                Icon(icon, size: 16, color: tone.icon)
                    .padding(.top, 1)
            }
            Text(text)
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(tone.fg)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(tone.bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(tone.border ?? .clear, lineWidth: tone.border == nil ? 0 : 1)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Chip

/// Pill status chip (uppercase). Mirrors `biz-kit Chip`.
struct BizChip: View {
    let tone: BizTone
    var icon: PantopusIcon?
    let text: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon { Icon(icon, size: 10, strokeWidth: 2.8, color: tone.fg) }
            Text(text.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(tone.fg)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(tone.bg)
        .clipShape(Capsule())
    }
}

// MARK: - Avatar

/// Initials/photo disc. Per-member tint is picked from identity tokens by a
/// stable hash (tokens only — no arbitrary gradients).
struct BizAvatar: View {
    let name: String
    /// Stable identity for the tint hash — pass the member's user-id so the
    /// colour survives renames and app relaunches; falls back to `name`.
    var tintKey: String?
    var imageURL: String?
    var size: CGFloat = 34

    private static let tints: [Color] = [
        Theme.Color.business, Theme.Color.info, Theme.Color.success,
        Theme.Color.warmAmber, Theme.Color.rose
    ]

    private var tint: Color {
        // FNV-1a over UTF-8: deterministic across launches. `String.hashValue`
        // is SipHash with a per-process random seed (Swift ≥4.2), so the same
        // member drew a different colour every cold start; `abs()` also traps
        // on Int.min, so index via `.magnitude`.
        var hash: UInt64 = 0xCBF2_9CE4_8422_2325
        for byte in (tintKey ?? name).utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return Self.tints[Int(hash % UInt64(Self.tints.count))]
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init)
        return letters.isEmpty ? "•" : letters.joined().uppercased()
    }

    var body: some View {
        ZStack {
            Circle().fill(tint)
            if let imageURL, let url = URL(string: imageURL) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        initialsLabel
                    }
                }
                .clipShape(Circle())
            } else {
                initialsLabel
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var initialsLabel: some View {
        Text(initials)
            .font(.system(size: size * 0.36, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
    }
}

// MARK: - Checkbox

/// Square multi-select checkbox. Business-filled when on. Mirrors `biz-kit Checkbox`.
struct BizCheckbox: View {
    let on: Bool
    var color: Color = Theme.Color.business

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(on ? color : Color.clear)
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .stroke(on ? Color.clear : Theme.Color.appBorderStrong, lineWidth: 1.5)
            if on { Icon(.check, size: 13, strokeWidth: 3.2, color: Theme.Color.appTextInverse) }
        }
        .frame(width: 22, height: 22)
        .accessibilityHidden(true)
    }
}

// MARK: - Stepper

/// − value + pill stepper. The value chip can carry the business accent.
struct BizStepper: View {
    let value: Int
    var accent: Color = Theme.Color.business
    var prefix: String = ""
    var canDecrement: Bool = true
    var canIncrement: Bool = true
    let onDecrement: () -> Void
    let onIncrement: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s1) {
            stepButton(.minus, enabled: canDecrement, color: Theme.Color.appTextStrong, action: onDecrement)
                .accessibilityLabel("Decrease")
            Text("\(prefix)\(value)")
                .font(.system(size: 11.5, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(accent)
                .frame(minWidth: 30)
                .padding(.vertical, 3)
                .background(prefix.isEmpty ? Color.clear : accent.opacity(0.12))
                .clipShape(Capsule())
            stepButton(.plus, enabled: canIncrement, color: accent, action: onIncrement)
                .accessibilityLabel("Increase")
        }
    }

    private func stepButton(_ icon: PantopusIcon, enabled: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().stroke(Theme.Color.appBorder, lineWidth: 1)
                Icon(icon, size: 12, color: enabled ? color : Theme.Color.appTextMuted)
            }
            .frame(width: 26, height: 26)
            .background(Theme.Color.appSurface, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: - Sheet chrome

/// Bottom-sheet header: title + optional subhead + circular close. Pair with
/// `.presentationDragIndicator(.visible)` on the sheet.
struct BizSheetHeader: View {
    let title: String
    var subhead: String?
    let onClose: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(Theme.Color.appText)
                if let subhead {
                    Text(subhead)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onClose) {
                ZStack {
                    Circle().fill(Theme.Color.appSurfaceSunken)
                    Icon(.x, size: 16, color: Theme.Color.appTextStrong)
                }
                .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s2)
    }
}

/// Full-width primary CTA used in sheet footers. Functional chrome → product sky.
struct BizPrimaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var isSaving: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if isSaving {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else if let icon {
                    Icon(icon, size: 16, color: Theme.Color.appTextInverse)
                }
                Text(title)
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.Color.primary600.opacity(isDisabled ? 0.45 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(isDisabled ? .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0) : .primary)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isSaving)
    }
}

/// Sticky footer container above the home indicator.
struct BizSheetFooter<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            content
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s5)
        }
        .background(Theme.Color.appSurface)
    }
}

// MARK: - Divider

/// Hairline row divider inset to align under text. Mirrors the card row rule.
struct BizRowDivider: View {
    var body: some View {
        Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
    }
}

// MARK: - Shimmer helpers

/// A skeleton roster/seat row used by loading states.
struct BizShimmerRow: View {
    var showCheckbox: Bool = false
    var showTrailingPill: Bool = false

    var body: some View {
        HStack(spacing: 11) {
            if showCheckbox {
                Shimmer(width: 22, height: 22, cornerRadius: Radii.sm)
            }
            Shimmer(width: 34, height: 34, cornerRadius: Radii.pill)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Shimmer(width: 120, height: 11, cornerRadius: Radii.sm)
                Shimmer(width: 160, height: 9, cornerRadius: Radii.sm)
            }
            Spacer(minLength: Spacing.s0)
            if showTrailingPill {
                Shimmer(width: 46, height: 28, cornerRadius: Radii.pill)
            }
        }
        .padding(.vertical, Spacing.s3)
    }
}
