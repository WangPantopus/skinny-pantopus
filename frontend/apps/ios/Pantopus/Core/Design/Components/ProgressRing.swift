//
//  ProgressRing.swift
//  Pantopus
//
//  Donut progress indicator — a track circle, an accent arc trimmed to the
//  current progress, and an optional center label / sublabel. Built first for
//  the A10.11 Earn weekly-goal momentum donut, but deliberately generic so it
//  can back any "N% of a goal" ring (profile strength, task completion, …).
//
//  Design reference: `docs/designs/A10/earn-frames.jsx` (weekly-goal momentum)
//  and `docs/new-design-parity-batch2.md` § A10.11.
//
//  Perf: the donut is two `Circle` strokes + a text stack — a trivial draw
//  that stays well inside `docs/perf_budgets.md`. The primitive itself is
//  static; callers animate by changing `progress` and must gate that
//  animation behind `reduceMotion`. Snapshots pass a fixed `progress`.
//

import SwiftUI

/// Donut progress indicator with an optional center label.
///
/// - Parameters:
///   - progress: Completion in `0...1` (clamped).
///   - diameter: Outer diameter; defaults to 72pt.
///   - lineWidth: Ring stroke width; defaults to 8pt.
///   - tint: Accent-arc color; defaults to `primary600`.
///   - trackColor: Unfilled-track color; defaults to `appSurfaceSunken`.
///   - label: Center headline (e.g. "74%"). Optional.
///   - sublabel: Center caption under the label (e.g. "TO GOAL"). Optional.
///   - accessibilityLabel: Overrides the derived a11y string.
@MainActor
public struct ProgressRing: View {
    private let progress: Double
    private let diameter: CGFloat
    private let lineWidth: CGFloat
    private let tint: Color
    private let trackColor: Color
    private let label: String?
    private let sublabel: String?
    private let accessibilityLabelText: String?

    public init(
        progress: Double,
        diameter: CGFloat = 72,
        lineWidth: CGFloat = 8,
        tint: Color = Theme.Color.primary600,
        trackColor: Color = Theme.Color.appSurfaceSunken,
        label: String? = nil,
        sublabel: String? = nil,
        accessibilityLabel: String? = nil
    ) {
        self.progress = max(0, min(1, progress))
        self.diameter = diameter
        self.lineWidth = lineWidth
        self.tint = tint
        self.trackColor = trackColor
        self.label = label
        self.sublabel = sublabel
        accessibilityLabelText = accessibilityLabel
    }

    public var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(
                    tint,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            centerStack
        }
        .frame(width: diameter, height: diameter)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(resolvedAccessibilityLabel)
        .accessibilityIdentifier("progressRing")
    }

    @ViewBuilder private var centerStack: some View {
        if label != nil || sublabel != nil {
            VStack(spacing: 1) {
                if let label {
                    Text(label)
                        .font(.system(size: labelSize, weight: .heavy))
                        .tracking(-0.3)
                        .foregroundStyle(Theme.Color.appText)
                        .monospacedDigit()
                }
                if let sublabel {
                    Text(sublabel)
                        .font(.system(size: sublabelSize, weight: .bold))
                        .tracking(0.5)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.horizontal, Spacing.s1)
        }
    }

    /// Scale the center headline with the ring so small rings stay legible
    /// and large goal donuts read as a hero number.
    private var labelSize: CGFloat {
        max(13, diameter * 0.24)
    }

    private var sublabelSize: CGFloat {
        max(8, diameter * 0.11)
    }

    private var resolvedAccessibilityLabel: String {
        if let accessibilityLabelText { return accessibilityLabelText }
        let pct = Int((progress * 100).rounded())
        if let label, let sublabel {
            return "\(label) \(sublabel), \(pct) percent"
        }
        return "\(pct) percent complete"
    }
}

#Preview("ProgressRing — 0 / partial / full") {
    HStack(spacing: Spacing.s5) {
        ProgressRing(progress: 0, label: "0%", sublabel: "to goal")
        ProgressRing(
            progress: 0.66,
            tint: Theme.Color.success,
            label: "66%",
            sublabel: "to goal"
        )
        ProgressRing(
            progress: 1,
            tint: Theme.Color.success,
            label: "Done",
            sublabel: "this week"
        )
    }
    .padding(Spacing.s5)
    .background(Theme.Color.appBg)
}
