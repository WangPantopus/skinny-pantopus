//
//  DateSpan.swift
//  Pantopus
//
//  Mini-timeline strip rendered between two date pickers on A14.8
//  Vacation Hold. A horizontal dashed line connects two date anchors;
//  a centred pill labels the span ("13 days"). Below the line, mono
//  weekday abbreviations call out the start / end day of week. The
//  `tone` variant recolours the dash + pill — info / success / warning.
//

import SwiftUI

/// Tone variant for `DateSpan` — picks the dashed line + pill accent.
public enum DateSpanTone: Sendable, Hashable, CaseIterable {
    case info, success, warning

    var accent: Color {
        switch self {
        case .info: Theme.Color.primary600
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        }
    }

    var soft: Color {
        switch self {
        case .info: Theme.Color.primary50
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        }
    }
}

/// Mini-timeline strip showing a span between two date anchors with
/// weekday call-outs below.
///
/// - Parameters:
///   - days: Duration shown in the centred pill. Singular vs plural is
///     left to the caller.
///   - fromWeekday: Short weekday abbreviation under the leading anchor
///     ("MON"). Caller-uppercased.
///   - toWeekday: Short weekday abbreviation under the trailing anchor.
///   - tone: Colour variant. Defaults to `.info`.
@MainActor
public struct DateSpan: View {
    private let days: Int
    private let fromWeekday: String
    private let toWeekday: String
    private let tone: DateSpanTone

    /// Strip height — leaves room for the centred pill + anchors.
    private static let stripHeight: CGFloat = 28
    /// Anchor disc diameter — 10pt.
    private static let anchorDiameter: CGFloat = 10
    /// Dashed line height — 4pt.
    private static let lineHeight: CGFloat = 4
    /// Leading / trailing inset before anchor center — keeps the dashed
    /// line clear of the anchor inner edge.
    private static let edgeInset: CGFloat = 12

    public init(
        days: Int,
        fromWeekday: String,
        toWeekday: String,
        tone: DateSpanTone = .info
    ) {
        self.days = days
        self.fromWeekday = fromWeekday
        self.toWeekday = toWeekday
        self.tone = tone
    }

    public var body: some View {
        VStack(spacing: Spacing.s1) {
            timelineRow
            weekdayRow
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Span: \(days) days, \(fromWeekday) to \(toWeekday)")
        .accessibilityIdentifier("dateSpan")
    }

    private var timelineRow: some View {
        ZStack {
            // Soft underlay line (full width).
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .fill(tone.soft)
                .frame(height: Self.lineHeight)
                .padding(.horizontal, Self.edgeInset)

            // Dashed accent line.
            DashedLine()
                .stroke(
                    tone.accent,
                    style: StrokeStyle(lineWidth: Self.lineHeight, lineCap: .round, dash: [6, 4])
                )
                .frame(height: Self.lineHeight)
                .padding(.horizontal, Self.edgeInset)

            HStack {
                anchor
                Spacer()
                anchor
            }

            durationPill
        }
        .frame(height: Self.stripHeight)
    }

    private var anchor: some View {
        Circle()
            .fill(tone.accent)
            .frame(width: Self.anchorDiameter, height: Self.anchorDiameter)
            .overlay(
                Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2)
            )
    }

    private var durationPill: some View {
        Text("\(days) days")
            .font(.system(size: PantopusTextStyle.caption.size, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(tone.accent)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .fill(Theme.Color.appSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .strokeBorder(tone.accent, lineWidth: 1)
            )
    }

    private var weekdayRow: some View {
        HStack {
            Text(fromWeekday.uppercased())
                .font(.system(size: PantopusTextStyle.overline.size, weight: .semibold, design: .monospaced))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(toWeekday.uppercased())
                .font(.system(size: PantopusTextStyle.overline.size, weight: .semibold, design: .monospaced))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

// MARK: - Dashed line shape

private struct DashedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let y = rect.midY
        path.move(to: CGPoint(x: 0, y: y))
        path.addLine(to: CGPoint(x: rect.width, y: y))
        return path
    }
}

// MARK: - Preview

#Preview("All tones") {
    VStack(spacing: Spacing.s4) {
        DateSpan(days: 13, fromWeekday: "MON", toWeekday: "WED", tone: .info)
        DateSpan(days: 7, fromWeekday: "FRI", toWeekday: "THU", tone: .success)
        DateSpan(days: 30, fromWeekday: "TUE", toWeekday: "WED", tone: .warning)
    }
    .padding(Spacing.s4)
    .frame(maxWidth: 320)
    .background(Theme.Color.appSurface)
}
