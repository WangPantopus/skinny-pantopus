//
//  HaloCircle.swift
//  Pantopus
//
//  96pt double-ring status halo for A18 status / A21 ceremonial moments.
//  Outer 96pt fill (light tone bg) + 4pt translucent ring outside + 72pt
//  inner disc (strong tone or sky gradient) + 32pt centered white icon.
//
//  Optional pulsing glow ring honours `accessibilityReduceMotion`.
//

import SwiftUI

/// The ceremonial tone the halo broadcasts. Drives the inner-disc fill,
/// the default icon, the outer-ring tint, and the pulse glow color.
public enum HaloCircleTone: String, Sendable, CaseIterable {
    /// Success — green inner disc + check icon. A18.2 / A21.2 confirmation.
    case success
    /// Info — primary600 inner disc + clock icon. A18.4 active-wait state.
    case info
    /// Warning — amber inner disc + alert-circle icon. A18.4 action-needed.
    case warning
    /// Celebration — sky gradient inner disc + badge-check icon.
    /// A18.2 approved / A18.3 verified moments.
    case celebration

    /// Default icon for this tone when the caller doesn't override.
    public var defaultIcon: PantopusIcon {
        switch self {
        case .success: .check
        case .info: .clock
        case .warning: .alertCircle
        case .celebration: .badgeCheck
        }
    }
}

/// 96pt ceremonial halo: 4pt outer ring · 96pt light fill · 72pt strong
/// inner disc · 32pt white icon. Pass `isPulsing: true` to add a 3s
/// breathing glow (auto-disabled under reduce-motion).
public struct HaloCircle: View {
    private let tone: HaloCircleTone
    private let icon: PantopusIcon?
    private let isPulsing: Bool
    private let reduceMotionOverride: Bool?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsePhase = false

    public init(
        tone: HaloCircleTone,
        icon: PantopusIcon? = nil,
        isPulsing: Bool = false
    ) {
        self.init(
            tone: tone,
            icon: icon,
            isPulsing: isPulsing,
            reduceMotionOverride: nil
        )
    }

    init(
        tone: HaloCircleTone,
        icon: PantopusIcon? = nil,
        isPulsing: Bool = false,
        reduceMotionOverride: Bool?
    ) {
        self.tone = tone
        self.icon = icon
        self.isPulsing = isPulsing
        self.reduceMotionOverride = reduceMotionOverride
    }

    public var body: some View {
        let resolvedIcon = icon ?? tone.defaultIcon
        let motionReduced = reduceMotionOverride ?? reduceMotion
        let glowEnabled = isPulsing && !motionReduced

        ZStack {
            if isPulsing {
                pulseLayer(enabled: glowEnabled)
            }
            outerFill
            outerRing
            innerDisc
            Icon(
                resolvedIcon,
                size: 32,
                strokeWidth: 2.5,
                color: Theme.Color.appTextInverse
            )
        }
        .frame(width: 104, height: 104)
        .onAppear { if glowEnabled { pulsePhase = true } }
        .accessibilityHidden(true)
        .accessibilityIdentifier("haloCircle_\(tone.rawValue)")
    }

    // MARK: - Layers

    /// Pulse glow disc sized to the halo's outer extent (104pt). Scaling
    /// to 1.06 expands ~3pt past the static halo while the alpha fades
    /// from 0.4 to 0 — visible as a soft ring radiating outward.
    private func pulseLayer(enabled: Bool) -> some View {
        Circle()
            .fill(pulseTint.opacity(enabled && pulsePhase ? 0 : 0.4))
            .frame(width: 104, height: 104)
            .scaleEffect(enabled && pulsePhase ? 1.06 : 1.0)
            .animation(
                enabled
                    ? .easeInOut(duration: 3).repeatForever(autoreverses: false)
                    : nil,
                value: pulsePhase
            )
            .accessibilityHidden(true)
    }

    /// 4pt translucent ring drawn just outside the 96pt fill. `strokeBorder`
    /// keeps the stroke inside the 104pt frame, so it occupies radii 48–52
    /// — exactly the band outside the 96pt (radius 48) fill.
    private var outerRing: some View {
        Circle()
            .strokeBorder(ringStrokeColor, lineWidth: 4)
            .frame(width: 104, height: 104)
    }

    private var outerFill: some View {
        Circle()
            .fill(outerFillColor)
            .frame(width: 96, height: 96)
    }

    @ViewBuilder
    private var innerDisc: some View {
        switch tone {
        case .celebration:
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.primary500, Theme.Color.primary700],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 72, height: 72)
        case .success, .info, .warning:
            Circle()
                .fill(accentColor)
                .frame(width: 72, height: 72)
        }
    }

    // MARK: - Tone palette

    private var accentColor: Color {
        switch tone {
        case .success: Theme.Color.success
        case .info: Theme.Color.primary600
        case .warning: Theme.Color.warning
        case .celebration: Theme.Color.primary600
        }
    }

    private var outerFillColor: Color {
        switch tone {
        case .success: Theme.Color.successBg
        case .info: Theme.Color.primary50
        case .warning: Theme.Color.warningBg
        case .celebration: Theme.Color.primary50
        }
    }

    private var ringStrokeColor: Color {
        accentColor.opacity(0.15)
    }

    private var pulseTint: Color {
        accentColor
    }
}

#Preview("Tones") {
    HStack(spacing: Spacing.s4) {
        HaloCircle(tone: .success)
        HaloCircle(tone: .info)
        HaloCircle(tone: .warning)
        HaloCircle(tone: .celebration)
    }
    .padding()
    .background(Theme.Color.appSurface)
}

#Preview("Pulsing") {
    HaloCircle(tone: .info, isPulsing: true)
        .padding()
        .background(Theme.Color.appSurface)
}
