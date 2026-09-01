//
//  HoldStatusHero.swift
//  Pantopus
//
//  A14.8 — Sky-gradient status card for the active variant of the
//  Vacation Hold screen. Renders the "Hold active" pill (pulsing sky-300
//  dot), the "until <date>" mono caption, a huge 32pt days-left readout,
//  and a 3-cell stats grid (packages / mail / forwarded).
//
//  Mirrors the `HoldStatusHero` block in `vacation-frames.jsx`. The
//  primitive is feature-local because A14.8 is the only consumer today;
//  if a second surface needs the same chrome we can promote it to
//  `Core/Design/Components/`.
//

import SwiftUI

@MainActor
struct HoldStatusHero: View {
    let daysLeft: Int
    let untilLabel: String
    let stats: [VacationHoldStat]

    /// Reduce-motion override hook for tests / previews. Defaults to
    /// reading the accessibility trait at render time.
    let reduceMotionOverride: Bool?

    init(
        daysLeft: Int,
        untilLabel: String,
        stats: [VacationHoldStat],
        reduceMotionOverride: Bool? = nil
    ) {
        self.daysLeft = daysLeft
        self.untilLabel = untilLabel
        self.stats = stats
        self.reduceMotionOverride = reduceMotionOverride
    }

    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            headerRow
            daysRow
            divider
            statsGrid
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s4)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                stops: [
                    .init(color: Theme.Color.primary600, location: 0),
                    .init(color: Theme.Color.primary800, location: 1)
                ],
                startPoint: UnitPoint(x: 0.18, y: 0),
                endPoint: UnitPoint(x: 0.82, y: 1)
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Vacation hold active, \(daysLeft) days left until \(untilLabel)")
        .accessibilityIdentifier("vacationHoldStatusHero")
    }

    private var reduceMotion: Bool {
        reduceMotionOverride ?? systemReduceMotion
    }

    private var headerRow: some View {
        HStack(alignment: .center) {
            activePill
            Spacer(minLength: Spacing.s2)
            Text("until \(untilLabel)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color.white.opacity(0.7))
                .accessibilityHidden(true)
        }
        .padding(.bottom, 2)
    }

    private var activePill: some View {
        HStack(spacing: Spacing.s1 + 2) {
            PulsingDot(reduceMotion: reduceMotion)
            Text("Hold active")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.6)
                .textCase(.uppercase)
                .foregroundStyle(Color.white)
        }
        .padding(.leading, 7)
        .padding(.trailing, 9)
        .padding(.vertical, 3)
        .background(Color.white.opacity(0.18))
        .clipShape(Capsule())
    }

    private var daysRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text("\(daysLeft)")
                .font(.system(size: 32, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(.white)
                .monospacedDigit()
            Text("days left")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.75))
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.18))
            .frame(height: 1)
            .padding(.top, 10)
            .padding(.bottom, Spacing.s3)
    }

    private var statsGrid: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ForEach(stats) { stat in
                statCell(stat)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func statCell(_ stat: VacationHoldStat) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(stat.count)")
                .font(.system(size: 18, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(stat.label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.white.opacity(0.7))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stat.count) \(stat.label)")
    }
}

/// 6pt sky-300 dot with a 3pt sky-300 halo that pulses opacity. Disabled
/// when reduce-motion is on (the halo collapses to its static state).
private struct PulsingDot: View {
    let reduceMotion: Bool
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.Color.primary300.opacity(0.3))
                .frame(width: 12, height: 12)
                .scaleEffect(reduceMotion ? 1 : (pulse ? 1.25 : 0.9))
                .opacity(reduceMotion ? 1 : (pulse ? 0.0 : 0.7))
            Circle()
                .fill(Theme.Color.primary300)
                .frame(width: 6, height: 6)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: false)) {
                pulse = true
            }
        }
    }
}

#Preview("HoldStatusHero · 5 days") {
    HoldStatusHero(
        daysLeft: 5,
        untilLabel: "Jun 9",
        stats: VacationHoldSampleData.activeHold.stats
    )
    .padding(Spacing.s3)
    .background(Theme.Color.appBg)
}

#Preview("HoldStatusHero · 1 day · reduceMotion") {
    HoldStatusHero(
        daysLeft: 1,
        untilLabel: "Jun 9",
        stats: VacationHoldSampleData.activeHold.stats,
        reduceMotionOverride: true
    )
    .padding(Spacing.s3)
    .background(Theme.Color.appBg)
}
