//
//  SplitDiff.swift
//  Pantopus
//
//  A13.4 — Visualises before → after ownership splits as horizontal
//  stacked bars + legend chips with per-segment deltas. Smoothly animates
//  segment widths when the live amount changes.
//

import SwiftUI

/// One segment in a `SplitDiff` bar — driven by the view-model's owner
/// roster + the live transfer amount.
public struct SplitSegment: Identifiable, Equatable, Sendable {
    public let id: String
    public let owner: String
    public let percent: Int
    public let color: Color
    public let delta: Int?
    public let isNew: Bool

    public init(
        id: String,
        owner: String,
        percent: Int,
        color: Color,
        delta: Int? = nil,
        isNew: Bool = false
    ) {
        self.id = id
        self.owner = owner
        self.percent = percent
        self.color = color
        self.delta = delta
        self.isNew = isNew
    }
}

/// Before/after split card showing current ownership versus the projected
/// split after the transfer commits. Renders two stacked-bar rows with a
/// labelled arrow divider and per-row legends.
@MainActor
public struct SplitDiff: View {
    public let before: [SplitSegment]
    public let after: [SplitSegment]
    public let amount: Int
    public let recipientName: String

    public init(
        before: [SplitSegment],
        after: [SplitSegment],
        amount: Int,
        recipientName: String
    ) {
        self.before = before
        self.after = after
        self.amount = amount
        self.recipientName = recipientName
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            DiffRow(label: "Before", segments: before)
            divider
            DiffRow(label: "After", segments: after)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3 + 2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 3, y: 1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Move \(amount) percent to \(recipientName)")
        .accessibilityIdentifier("splitDiff")
    }

    private var divider: some View {
        HStack(spacing: Spacing.s2) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
            Icon(.arrowDown, size: 14, color: Theme.Color.appTextMuted)
            Text("MOVE \(amount)% → \(recipientName.uppercased())")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
        }
        .padding(.vertical, Spacing.s2)
    }
}

// MARK: - Row

private struct DiffRow: View {
    let label: String
    let segments: [SplitSegment]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1 + 2) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            StakeBar(segments: segments)
            LegendStrip(segments: segments)
        }
    }
}

// MARK: - Stake bar

private struct StakeBar: View {
    let segments: [SplitSegment]

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: Spacing.s0) {
                ForEach(Array(segments.enumerated()), id: \.element.id) { offset, segment in
                    Rectangle()
                        .fill(segment.color)
                        .frame(width: width(for: segment, total: proxy.size.width))
                        .overlay(alignment: .trailing) {
                            if offset < segments.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.7))
                                    .frame(width: 1)
                            }
                        }
                        .animation(.easeInOut(duration: 0.18), value: segment.percent)
                }
            }
        }
        .frame(height: 14)
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func width(for segment: SplitSegment, total: CGFloat) -> CGFloat {
        let totalPercent = max(1, segments.reduce(0) { $0 + $1.percent })
        return total * CGFloat(segment.percent) / CGFloat(totalPercent)
    }
}

// MARK: - Legend strip

private struct LegendStrip: View {
    let segments: [SplitSegment]

    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 90), spacing: Spacing.s2, alignment: .leading)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: Spacing.s1) {
            ForEach(segments) { segment in
                HStack(spacing: Spacing.s1) {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(segment.color)
                        .frame(width: 8, height: 8)
                    Text(segment.owner)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("\(segment.percent)%")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let delta = segment.delta, delta != 0 {
                        Text(delta > 0 ? "+\(delta)" : "\(delta)")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(delta < 0 ? Theme.Color.error : Theme.Color.success)
                    }
                    if segment.isNew {
                        Text("NEW")
                            .font(.system(size: 8.5, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(Theme.Color.businessDark)
                            .padding(.horizontal, Spacing.s1)
                            .padding(.vertical, 1)
                            .background(Theme.Color.businessBg)
                            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                    }
                }
            }
        }
    }
}

#Preview {
    SplitDiff(
        before: [
            SplitSegment(id: "you", owner: "You", percent: 60, color: Theme.Color.primary600),
            SplitSegment(id: "mateo", owner: "Mateo", percent: 25, color: Theme.Color.handyman),
            SplitSegment(id: "jin", owner: "Jin", percent: 15, color: Theme.Color.success)
        ],
        after: [
            SplitSegment(
                id: "you",
                owner: "You",
                percent: 35,
                color: Theme.Color.primary600,
                delta: -25
            ),
            SplitSegment(
                id: "maya",
                owner: "Maya",
                percent: 25,
                color: Theme.Color.business,
                delta: 25,
                isNew: true
            ),
            SplitSegment(id: "mateo", owner: "Mateo", percent: 25, color: Theme.Color.handyman),
            SplitSegment(id: "jin", owner: "Jin", percent: 15, color: Theme.Color.success)
        ],
        amount: 25,
        recipientName: "Maya"
    )
    .padding()
    .background(Theme.Color.appBg)
}
