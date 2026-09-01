//
//  PlaceComponents.swift
//  Pantopus
//
//  Place — shared product-UI atoms, ported 1:1 from the design kit
//  `reference/address-anchored/place-components.jsx` (+ the `.pl-*`
//  CSS in the compiled screens). Home-green accent, sky CTAs.
//
//  Design-token mapping (design constant → app token):
//    INK → appText · INK2 → appTextStrong
//    MUTE → appTextSecondary · FAINT → appTextMuted
//    BORDER → appBorder · HOME_GREEN → home
//    HOME_GREEN_BG → homeBg · SKY → primary600
//

import SwiftUI

// MARK: - Card container (`.pl-card`)

/// White card surface: 1px border, radius 16, soft shadow.
struct PlaceCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
    }
}

extension View {
    /// `.pl-card` — the Place card surface.
    func placeCard() -> some View {
        modifier(PlaceCardStyle())
    }
}

// MARK: - Icon tile (`IconTile`)

/// Rounded-square section icon. Tones: home (green), muted, sky.
struct PlaceIconTile: View {
    enum Tone { case home, muted, sky }

    let icon: PantopusIcon
    var tone: Tone = .home
    var size: CGFloat = 34

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(background)
            Icon(icon, size: (size * 0.56).rounded(), strokeWidth: 2, color: foreground)
        }
        .frame(width: size, height: size)
    }

    private var background: Color {
        switch tone {
        case .home: Theme.Color.homeBg
        case .muted: Theme.Color.appSurfaceSunken
        case .sky: Theme.Color.primary100
        }
    }

    private var foreground: Color {
        switch tone {
        case .home: Theme.Color.home
        case .muted: Theme.Color.appTextMuted
        case .sky: Theme.Color.primary600
        }
    }
}

// MARK: - Chevron

/// Right-pointing affordance chevron (18pt, faint).
struct PlaceChevron: View {
    var size: CGFloat = 18

    var body: some View {
        Icon(.chevronRight, size: size, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
    }
}

// MARK: - Semantic chip (`Chip`)

/// Bordered semantic pill — 12pt semibold, tinted bg/fg/border.
struct PlaceChipModel: Equatable {
    enum Tone { case success, warning, error, sky, neutral }

    var tone: Tone = .neutral
    var text: String
    var icon: PantopusIcon?
}

struct PlaceChip: View {
    let model: PlaceChipModel

    var body: some View {
        HStack(spacing: 4) {
            if let icon = model.icon {
                Icon(icon, size: 13, strokeWidth: 2.25, color: foreground)
            }
            Text(model.text)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
        }
        .foregroundStyle(foreground)
        .padding(.leading, model.icon != nil ? 7 : 9)
        .padding(.trailing, 9)
        .padding(.vertical, 3)
        .background(background)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(border, lineWidth: 1))
    }

    private var background: Color {
        switch model.tone {
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .sky: Theme.Color.infoBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private var foreground: Color {
        switch model.tone {
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .sky: Theme.Color.primary700
        case .neutral: Theme.Color.appTextSecondary
        }
    }

    private var border: Color {
        switch model.tone {
        case .success: Theme.Color.successLight
        case .warning: Theme.Color.warningLight
        case .error: Theme.Color.errorLight
        case .sky: Theme.Color.primary200
        case .neutral: Theme.Color.appBorder
        }
    }
}

// MARK: - Verified avatar (`Avatar`)

/// Green-gradient initials disc with a verified-check badge.
struct PlaceVerifiedAvatar: View {
    var initials: String = "RC"
    var size: CGFloat = 38

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.success, Theme.Color.homeDark],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay(
                    Text(initials)
                        .font(.system(size: size * 0.34, weight: .bold))
                        .kerning(0.2)
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            Circle()
                .fill(Theme.Color.home)
                .frame(width: size * 0.42, height: size * 0.42)
                .overlay(
                    Icon(.check, size: size * 0.24, strokeWidth: 3.25, color: Theme.Color.appTextInverse)
                )
                .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
                .offset(x: 2, y: 2)
        }
        .accessibilityLabel("Verified resident")
    }
}

// MARK: - Sky text button (`TextButton`)

/// Verbs-first sky CTA — 14pt semibold, optional trailing arrow.
struct PlaceTextButton: View {
    let title: String
    var arrow: Bool = true
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                if arrow {
                    Icon(.arrowRight, size: 15, strokeWidth: 2.25, color: Theme.Color.primary600)
                }
            }
            .foregroundStyle(Theme.Color.primary600)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Shimmer skeleton (`Skel` / `.pl-skel`)

/// Shimmering placeholder bar. Static under Reduce Motion.
struct PlaceSkeleton: View {
    var width: CGFloat?
    var widthFraction: CGFloat?
    var height: CGFloat = 12
    var radius: CGFloat = 6

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    var body: some View {
        GeometryReader { proxy in
            let resolvedWidth = width ?? (widthFraction.map { proxy.size.width * $0 } ?? proxy.size.width)
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(width: resolvedWidth, height: height)
                .overlay(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [.clear, Theme.Color.appSurface.opacity(0.65), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: resolvedWidth, height: height)
                        .offset(x: phase * resolvedWidth)
                        .clipped()
                )
                .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        }
        .frame(height: height)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                phase = 1
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Group label (`GroupLabel`)

/// Uppercase overline above a card group.
struct PlaceGroupLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .kerning(0.88)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Density dots (`DensityDots`)

/// Four-dot activity meter — filled dots = bucket level, never a count.
struct PlaceDensityDots: View {
    let level: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<4, id: \.self) { index in
                Circle()
                    .fill(index < level ? Theme.Color.home : Theme.Color.appBorder)
                    .frame(width: 8, height: 8)
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Sparkline (`Sparkline`)

/// Qualitative trend line with gradient fill and end dot (home-green).
struct PlaceSparkline: View {
    /// Normalized points in the design's 126×30 coordinate space.
    var points: [CGPoint] = PlaceSparkline.designPoints

    static let designPoints: [CGPoint] = [
        CGPoint(x: 0, y: 26), CGPoint(x: 14, y: 24), CGPoint(x: 28, y: 25),
        CGPoint(x: 42, y: 20), CGPoint(x: 56, y: 21), CGPoint(x: 70, y: 15),
        CGPoint(x: 84, y: 13), CGPoint(x: 98, y: 8), CGPoint(x: 112, y: 9),
        CGPoint(x: 126, y: 4)
    ]

    var body: some View {
        Canvas { context, size in
            guard points.count > 1 else { return }
            let scaleX = size.width / 126
            let scaleY = size.height / 30
            let scaled = points.map { CGPoint(x: $0.x * scaleX, y: $0.y * scaleY) }

            var fill = Path()
            fill.move(to: CGPoint(x: 0, y: size.height))
            scaled.forEach { fill.addLine(to: $0) }
            fill.addLine(to: CGPoint(x: size.width, y: size.height))
            fill.closeSubpath()
            context.fill(
                fill,
                with: .linearGradient(
                    Gradient(colors: [Theme.Color.home.opacity(0.16), Theme.Color.home.opacity(0)]),
                    startPoint: .zero,
                    endPoint: CGPoint(x: 0, y: size.height)
                )
            )

            var line = Path()
            line.move(to: scaled[0])
            scaled.dropFirst().forEach { line.addLine(to: $0) }
            context.stroke(
                line,
                with: .color(Theme.Color.home),
                style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
            )

            if let last = scaled.last {
                let dot = Path(ellipseIn: CGRect(x: last.x - 2.6, y: last.y - 2.6, width: 5.2, height: 5.2))
                context.fill(dot, with: .color(Theme.Color.home))
            }
        }
        .frame(width: 118, height: 34)
        .accessibilityHidden(true)
    }
}

// MARK: - Previews

#Preview("Place atoms") {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            PlaceGroupLabel(text: "Atoms")
            HStack(spacing: Spacing.s3) {
                PlaceIconTile(icon: .wind, tone: .home)
                PlaceIconTile(icon: .lock, tone: .muted)
                PlaceIconTile(icon: .mapPin, tone: .sky)
                PlaceVerifiedAvatar()
                PlaceChevron()
            }
            HStack(spacing: Spacing.s2) {
                PlaceChip(model: PlaceChipModel(tone: .success, text: "All clear", icon: .check))
                PlaceChip(model: PlaceChipModel(tone: .warning, text: "Air quality", icon: .wind))
                PlaceChip(model: PlaceChipModel(tone: .sky, text: "Verified"))
                PlaceChip(model: PlaceChipModel(tone: .neutral, text: "Current"))
            }
            PlaceTextButton(title: "Be one of the first to verify on your block")
            PlaceSkeleton(widthFraction: 0.62, height: 15)
            PlaceSkeleton(widthFraction: 0.84, height: 12)
            HStack(spacing: Spacing.s3) {
                PlaceDensityDots(level: 2)
                PlaceSparkline()
            }
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
