//
//  HubSummaryCard.swift
//  Pantopus
//
//  A5 Scheduling Summary Card — the at-a-glance "this month" pulse embedded at
//  the top of A1. Powered by GET /bookings/summary (decoded into `HubSummary`):
//  4 stat cells, a 30-day sparkline, and a per-event-type breakdown. States:
//  default · empty (share CTA) · error (retry). Loading is the hub skeleton.
//

import SwiftUI

struct HubSummaryCard: View {
    enum Content {
        case data(HubSummary)
        case empty
        case error
        case loading
    }

    let content: Content
    let owner: SchedulingOwner
    let nameFor: (String) -> String?
    let onShare: () -> Void
    let onRetry: () -> Void
    let onInsights: () -> Void

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            switch content {
            case let .data(summary):
                if summary.isEmpty { emptyBody } else { dataBody(summary) }
            case .empty:
                emptyBody
            case .error:
                errorBody
            case .loading:
                loadingBody
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .setupCard(radius: Radii.xl)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
    }

    // MARK: Default

    private func dataBody(_ summary: HubSummary) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            HStack(alignment: .center, spacing: 10) {
                statCell(value: "\(summary.bookings)", label: "Bookings", delta: nil)
                divider
                if summary.hasDelta {
                    statCell(value: deltaText(summary.deltaPct ?? 0), label: "vs last month", delta: summary.deltaPct ?? 0)
                    divider
                }
                statCell(value: "\(summary.upcoming)", label: "Upcoming", delta: nil)
                divider
                statCell(value: "\(summary.noShows)", label: "No-shows", delta: nil)
            }
            .padding(.top, Spacing.s3)

            if summary.sparkCounts.contains(where: { $0 > 0 }) {
                Sparkline(values: summary.sparkCounts, accent: theme.accent)
                    .frame(height: 40)
                    .padding(.top, Spacing.s4)
            }

            if let byType = summary.byEventType, !byType.isEmpty {
                breakdown(byType).padding(.top, Spacing.s3)
            }

            seeInsights.padding(.top, Spacing.s3)
        }
    }

    private var header: some View {
        HStack {
            Text("THIS MONTH").font(.system(size: 11, weight: .bold)).tracking(0.88).foregroundStyle(theme.accent)
            Spacer()
            HStack(spacing: 3) {
                periodSegment("This week", on: false)
                periodSegment("This month", on: true)
            }
            .padding(3)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
        }
    }

    private func periodSegment(_ title: String, on: Bool) -> some View {
        Text(title)
            .font(.system(size: 11, weight: on ? .bold : .semibold))
            .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .background(on ? theme.accent : Color.clear)
            .clipShape(Capsule())
    }

    private func statCell(value: String, label: String, delta: Int?) -> some View {
        let color: Color = {
            guard let delta else { return Theme.Color.appText }
            return delta >= 0 ? Theme.Color.success : Theme.Color.error
        }()
        return VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 3) {
                if let delta { Icon(delta >= 0 ? .arrowUp : .arrowDown, size: 16, strokeWidth: 2.6, color: color) }
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.5)
                    .foregroundStyle(color)
                    .monospacedDigit()
            }
            Text(label)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(width: 1, height: 34).padding(.vertical, 2)
    }

    private func breakdown(_ items: [HubSummary.EventTypeCount]) -> some View {
        HStack(spacing: Spacing.s2) {
            ForEach(Array(items.prefix(3))) { item in
                HStack(spacing: 5) {
                    Circle().fill(theme.accent).frame(width: 6, height: 6)
                    Text(nameFor(item.eventTypeId ?? "") ?? "Other")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(1)
                    Text("\(item.count ?? 0)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 9)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var seeInsights: some View {
        HStack {
            Spacer()
            Button(action: onInsights) {
                HStack(spacing: 3) {
                    Text("See insights").font(.system(size: 12.5, weight: .semibold))
                    Icon(.chevronRight, size: 14, color: theme.accent)
                }
                .foregroundStyle(theme.accent)
            }
            .accessibilityIdentifier("schedulingSummarySeeInsights")
        }
    }

    private func deltaText(_ pct: Int) -> String {
        "\(pct >= 0 ? "+" : "")\(pct)%"
    }

    // MARK: Empty

    private var emptyBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack {
                Text("THIS MONTH").font(.system(size: 11, weight: .bold)).tracking(0.88).foregroundStyle(theme.accent)
                Spacer()
            }
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(theme.accentBg)
                    Icon(.calendarClock, size: 22, color: theme.accent)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text("No bookings yet").font(.system(size: 15, weight: .bold)).tracking(-0.2).foregroundStyle(Theme.Color.appText)
                    Text("Share your link to get your first one.").font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.top, 14)
            SetupPrimaryCTA(
                title: "Share booking link",
                icon: .share,
                iconTrailing: false,
                owner: owner,
                height: 44,
                fontSize: 13.5,
                action: onShare
            )
            .padding(.top, 14)
        }
    }

    // MARK: Error

    private var errorBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack {
                Text("THIS MONTH").font(.system(size: 11, weight: .bold)).tracking(0.88).foregroundStyle(theme.accent)
                Spacer()
            }
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurfaceSunken)
                    Icon(.cloudOff, size: 20, color: Theme.Color.appTextSecondary)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Couldn't load your numbers")
                        .font(.system(size: 13.5, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Check your connection and try again.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Button(action: onRetry) {
                    HStack(spacing: 5) {
                        Icon(.refreshCw, size: 13, color: Theme.Color.appTextStrong)
                        Text("Retry")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, Spacing.s2)
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                }
                .accessibilityIdentifier("schedulingSummaryRetry")
            }
            .padding(.top, 14)
        }
    }

    // MARK: Loading

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack {
                Shimmer(width: 88, height: 11, cornerRadius: 3)
                Spacer()
                Shimmer(width: 120, height: 26, cornerRadius: Radii.pill)
            }
            .padding(.bottom, 14)
            HStack(alignment: .center, spacing: 10) {
                ForEach(0..<4, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 6) {
                        Shimmer(height: 22, cornerRadius: 5)
                            .frame(maxWidth: .infinity)
                            .scaleEffect(x: 0.7, anchor: .leading)
                        Shimmer(height: 9, cornerRadius: 3)
                            .frame(maxWidth: .infinity)
                            .scaleEffect(x: 0.9, anchor: .leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if i < 3 { divider }
                }
            }
            Shimmer(height: 40, cornerRadius: Radii.sm)
                .padding(.top, Spacing.s4)
            HStack {
                Spacer()
                Shimmer(width: 86, height: 12, cornerRadius: 3)
            }
            .padding(.top, Spacing.s3)
        }
    }
}

// MARK: - Sparkline

private struct Sparkline: View {
    let values: [Int]
    let accent: Color

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let pts = points(in: CGSize(width: w, height: h))
            ZStack {
                Path { p in
                    p.move(to: CGPoint(x: 0, y: h - 1))
                    p.addLine(to: CGPoint(x: w, y: h - 1))
                }
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                if pts.count >= 2 {
                    Path { p in
                        p.move(to: CGPoint(x: pts[0].x, y: h))
                        for pt in pts {
                            p.addLine(to: pt)
                        }
                        p.addLine(to: CGPoint(x: pts[pts.count - 1].x, y: h))
                        p.closeSubpath()
                    }
                    .fill(accent.opacity(0.08))
                    Path { p in
                        p.move(to: pts[0])
                        for pt in pts.dropFirst() {
                            p.addLine(to: pt)
                        }
                    }
                    .stroke(accent, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    if let last = pts.last {
                        Circle().fill(accent).frame(width: 6, height: 6).position(last)
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func points(in size: CGSize) -> [CGPoint] {
        guard !values.isEmpty else { return [] }
        let maxV = values.max() ?? 0
        let minV = values.min() ?? 0
        let span = max(maxV - minV, 1)
        let pad: CGFloat = 2
        let usableW = max(size.width - pad * 2, 1)
        let usableH = max(size.height - pad * 2, 1)
        let n = max(values.count - 1, 1)
        return values.enumerated().map { i, v in
            CGPoint(
                x: pad + (CGFloat(i) / CGFloat(n)) * usableW,
                y: pad + (1 - CGFloat(v - minV) / CGFloat(span)) * usableH
            )
        }
    }
}
