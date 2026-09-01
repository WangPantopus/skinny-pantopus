//
//  RatingDistribution.swift
//  Pantopus
//
//  Compact review summary — a big average, a five-star glyph row, the review
//  count, and a 5★→1★ histogram of star-color bars. Backs the Reviews summary
//  on A10.6 Business profile (public) and A10.7 Business owner view.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (RatingSummary)
//  and `docs/new-design-parity-batch2.md` § A10.6.
//
//  Stars are drawn as a filled `StarShape` (not the outline `Icon(.star)`) so
//  the rating reads as solid amber and matches the Android Paparazzi baseline.
//

import SwiftUI

/// Five-row review histogram + average + count.
///
/// - Parameters:
///   - average: Mean rating in `0...5`.
///   - count: Total number of reviews.
///   - distribution: Five fractions in `0...1`, ordered 5★→1★, giving each
///     bar's fill. Shorter arrays pad with zeros; longer arrays truncate.
@MainActor
public struct RatingDistribution: View {
    private let average: Double
    private let count: Int
    private let distribution: [Double]

    public init(average: Double, count: Int, distribution: [Double]) {
        self.average = max(0, min(5, average))
        self.count = max(0, count)
        let padded = (distribution + Array(repeating: 0, count: 5)).prefix(5)
        self.distribution = padded.map { max(0, min(1, $0)) }
    }

    private var hasReviews: Bool {
        count >= 1
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 14) {
            summaryColumn
                .frame(width: 84)
            histogramColumn
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("ratingDistribution")
    }

    private var summaryColumn: some View {
        VStack(spacing: 3) {
            Text(hasReviews ? formattedAverage : "—")
                .font(.system(size: 30, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(Theme.Color.appText)
                .monospacedDigit()
            starRow
            Text(hasReviews ? "\(count) reviews" : "No reviews")
                .font(.system(size: 10.5, weight: .regular))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var starRow: some View {
        HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { index in
                StarShape()
                    .fill(starFilled(at: index) ? Theme.Color.star : Theme.Color.appBorder)
                    .frame(width: 11, height: 11)
            }
        }
    }

    private var histogramColumn: some View {
        VStack(spacing: Spacing.s1) {
            ForEach(0..<5, id: \.self) { row in
                HStack(spacing: 7) {
                    Text("\(5 - row)")
                        .font(.system(size: 10.5, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 8, alignment: .leading)
                    HistogramBar(fraction: distribution[row])
                }
            }
        }
    }

    private var formattedAverage: String {
        String(format: "%.1f", average)
    }

    /// A star is "filled" once the average passes its half-point, so a 4.9
    /// shows five solid stars and a 4.2 shows four.
    private func starFilled(at index: Int) -> Bool {
        hasReviews && average >= Double(index) + 0.5
    }

    private var accessibilityLabel: String {
        guard hasReviews else { return "No reviews yet" }
        return "Rated \(formattedAverage) out of 5 stars from \(count) reviews"
    }
}

// MARK: - Histogram bar

private struct HistogramBar: View {
    let fraction: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Capsule(style: .continuous)
                    .fill(Theme.Color.star)
                    .frame(width: max(0, geo.size.width * fraction))
            }
        }
        .frame(height: 5)
    }
}

// MARK: - Star shape

/// Five-pointed filled star, point-up. Used for the rating glyph row so the
/// fill reads solid (the shared `Icon(.star)` is an outline SF Symbol).
struct StarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outer = min(rect.width, rect.height) / 2
        let inner = outer * 0.42
        let points = 5
        var path = Path()
        for i in 0..<(points * 2) {
            let radius = i.isMultiple(of: 2) ? outer : inner
            let angle = -CGFloat.pi / 2 + CGFloat(i) * .pi / CGFloat(points)
            let point = CGPoint(
                x: center.x + radius * cos(angle),
                y: center.y + radius * sin(angle)
            )
            if i == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()
        return path
    }
}

#Preview("RatingDistribution variants") {
    VStack(spacing: Spacing.s4) {
        RatingDistribution(
            average: 4.9,
            count: 128,
            distribution: [0.92, 0.06, 0.02, 0, 0]
        )
        RatingDistribution(
            average: 4.2,
            count: 36,
            distribution: [0.52, 0.28, 0.12, 0.05, 0.03]
        )
        RatingDistribution(average: 0, count: 0, distribution: [])
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
