//
//  InsightsComponents.swift
//  Pantopus
//
//  Stream I17 — Insights & reports. The shared, read-only data-display kit for
//  H9–H12: top bar, period/sort chips, stat tiles, ranked rows, a mini bar
//  chart, a stacked reliability bar, funnel bars, skeletons, and an error view.
//  Tokens only — chart fills are the pillar accent / semantic tokens at reduced
//  opacity, never hardcoded chart colors. Every metric is announced with a text
//  label (never color alone) for VoiceOver.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Chrome

/// Back chevron + centered title + optional trailing control (period/sort chip).
struct InsightsTopBar<Trailing: View>: View {
    private let title: String
    private let onBack: () -> Void
    private let trailing: Trailing

    init(
        title: String,
        onBack: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 21, color: Theme.Color.appText).frame(width: 36, height: 36)
            }
            .accessibilityLabel("Back")
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .accessibilityAddTraits(.isHeader)
            trailing.frame(minWidth: 36, alignment: .trailing)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

/// The "Last 30 days" chip that opens the H13 Period & Filter sheet.
struct InsightsPeriodChip: View {
    let label: String
    var accent: Color = Theme.Color.primary600
    var badge: Int = 0
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Icon(.calendar, size: 13, color: accent)
                Text(label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.system(size: 9.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(width: 15, height: 15)
                        .background(accent)
                        .clipShape(Circle())
                }
                Icon(.chevronDown, size: 12, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(Theme.Color.appSurface)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Period: \(label)")
        .accessibilityHint("Opens date range and filters")
        .accessibilityIdentifier("scheduling.insights.periodChip")
    }
}

/// A two-state sort chip (Team performance).
struct InsightsSortChip: View {
    let label: String
    var accent: Color = Theme.Color.primary600
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Icon(.arrowDownUp, size: 12, color: accent)
                Text(label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(Theme.Color.appSurface)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort by \(label)")
        .accessibilityIdentifier("scheduling.insights.sortChip")
    }
}

// MARK: - Containers

/// White card: 1px border, 16 radius, subtle shadow. No left-border accents.
struct InsightsCard<Content: View>: View {
    var padding: CGFloat = 14
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

/// Title Case overline label.
struct InsightsOverline: View {
    let text: String
    var color: Color = Theme.Color.appTextMuted

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Stat tiles

/// One headline metric: overline label, big number, optional delta chip.
struct StatTileView: View {
    let tile: MetricTile
    var accent: Color = Theme.Color.primary600

    var body: some View {
        InsightsCard(padding: 12) {
            VStack(alignment: .leading, spacing: 5) {
                InsightsOverline(text: tile.label)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(tile.value)
                        .font(.system(size: 23, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let delta = tile.delta { DeltaChip(delta: delta) }
                }
                if let caption = tile.caption {
                    Text(caption)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts = ["\(tile.label): \(tile.value)"]
        if let delta = tile.delta { parts.append("\(delta >= 0 ? "up" : "down") \(abs(delta)) percent") }
        if let caption = tile.caption { parts.append(caption) }
        return parts.joined(separator: ", ")
    }
}

/// Up/down trend chip.
struct DeltaChip: View {
    let delta: Int

    var body: some View {
        let up = delta >= 0
        return HStack(spacing: 2) {
            Icon(up ? .trendingUp : .trendingDown, size: 10, strokeWidth: 2.4, color: up ? Theme.Color.success : Theme.Color.error)
            Text(InsightsFormat.signedPercent(delta) ?? "")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(up ? Theme.Color.success : Theme.Color.error)
        }
        .padding(.horizontal, 5)
        .frame(height: 17)
        .background(up ? Theme.Color.successBg : Theme.Color.errorBg)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }
}

// MARK: - Ranked rows

/// A horizontal proportion bar (0…1) on a sunken track.
struct ProportionBar: View {
    let value: Double
    var accent: Color = Theme.Color.primary600
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken)
                Capsule().fill(accent.opacity(0.85))
                    .frame(width: max(2, geo.size.width * CGFloat(min(max(value, 0), 1))))
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

/// A ranked "top event types" row.
struct RankedRowView: View {
    let row: RankedRow
    var accent: Color = Theme.Color.primary600
    var onTap: (() -> Void)?

    var body: some View {
        let content = HStack(spacing: 11) {
            Text("\(row.rank)")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(width: 16)
            VStack(alignment: .leading, spacing: 5) {
                Text(row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                ProportionBar(value: row.proportion, accent: accent)
            }
            Text("\(row.count)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if onTap != nil { Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted) }
        }
        .padding(.vertical, 9)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Number \(row.rank), \(row.title), \(row.count) booking\(row.count == 1 ? "" : "s")")

        if let onTap {
            Button(action: onTap) { content }.buttonStyle(.plain)
                .accessibilityAddTraits(.isButton)
        } else {
            content
        }
    }
}

// MARK: - Charts

/// A compact bar chart for "bookings over time".
struct MiniBarChartView: View {
    let bars: [DayBar]
    var accent: Color = Theme.Color.primary600
    var height: CGFloat = 84

    var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(bars) { bar in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(accent.opacity(bar.value == 0 ? 0.14 : 0.85))
                        .frame(height: max(3, CGFloat(bar.proportion) * height))
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel(bar.accessibilityLabel)
                }
            }
            .frame(height: height, alignment: .bottom)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity)
            .background(
                Theme.Color.appSurfaceSunken.opacity(0.5)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            )
            HStack {
                Text(bars.first?.dateLabel ?? "")
                Spacer()
                Text(bars.last?.dateLabel ?? "")
            }
            .font(.system(size: 9.5))
            .foregroundStyle(Theme.Color.appTextMuted)
            .accessibilityHidden(true)
        }
    }
}

/// A single stacked reliability bar (Honored / Late cancel / No-show) + legend.
struct StackedBreakdownBar: View {
    let segments: [BreakdownSegment]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            GeometryReader { geo in
                HStack(spacing: 0) {
                    ForEach(segments) { segment in
                        Rectangle()
                            .fill(color(for: segment.kind))
                            .frame(width: max(0, geo.size.width * CGFloat(segment.fraction)))
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 14)
            .clipShape(Capsule())
            .accessibilityElement()
            .accessibilityLabel(legendSpoken)

            HStack(spacing: Spacing.s4) {
                ForEach(segments) { segment in
                    HStack(spacing: 5) {
                        Circle().fill(color(for: segment.kind)).frame(width: 8, height: 8)
                        Text("\(segment.label) \(segment.count)")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            .accessibilityHidden(true)
        }
    }

    private func color(for kind: BreakdownSegment.Kind) -> Color {
        switch kind {
        case .honored: Theme.Color.success
        case .lateCancel: Theme.Color.warning
        case .noShow: Theme.Color.error
        }
    }

    private var legendSpoken: String {
        segments.map { "\($0.label): \($0.count)" }.joined(separator: ", ")
    }
}

/// One funnel step (Per-event-type): label, a proportional bar, count + percent.
struct FunnelStepRow: View {
    let label: String
    let count: Int
    /// 0…1 of the funnel's top step.
    let proportion: Double
    let percent: String?
    var accent: Color = Theme.Color.primary600

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text("\(count)\(percent.map { " · \($0)" } ?? "")")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Theme.Color.appSurfaceSunken)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(accent.opacity(0.85))
                        .frame(width: max(3, geo.size.width * CGFloat(min(max(proportion, 0), 1))))
                }
            }
            .frame(height: 10)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(count)\(percent.map { ", \($0)" } ?? "")")
    }
}

// MARK: - Skeleton + error

/// Reusable loading scaffold — shimmer tiles + ghost chart. Never "Loading…".
struct InsightsSkeleton: View {
    enum Kind { case dashboard, detail, list }
    var kind: Kind = .dashboard

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                switch kind {
                case .dashboard:
                    HStack(spacing: Spacing.s2) {
                        Shimmer(height: 72, cornerRadius: Radii.xl)
                        Shimmer(height: 72, cornerRadius: Radii.xl)
                    }
                    HStack(spacing: Spacing.s2) {
                        Shimmer(height: 72, cornerRadius: Radii.xl)
                        Shimmer(height: 72, cornerRadius: Radii.xl)
                    }
                    Shimmer(height: 140, cornerRadius: Radii.xl)
                    Shimmer(height: 160, cornerRadius: Radii.xl)
                case .detail:
                    Shimmer(height: 88, cornerRadius: Radii.xl)
                    Shimmer(height: 150, cornerRadius: Radii.xl)
                    Shimmer(height: 120, cornerRadius: Radii.xl)
                case .list:
                    Shimmer(height: 96, cornerRadius: Radii.xl)
                    ForEach(0..<4, id: \.self) { _ in
                        Shimmer(height: 60, cornerRadius: Radii.lg)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s4)
        }
        .accessibilityLabel("Loading insights")
    }
}

/// Shared retry view for a failed insights load.
struct InsightsErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            .accessibilityHidden(true)
            Text("Couldn't load insights")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .accessibilityIdentifier("scheduling.insights.retry")
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}

/// A tappable footer row-link (dashboard → no-show / team).
struct InsightsLinkRow: View {
    let icon: PantopusIcon
    let title: String
    var subtitle: String?
    var accent: Color = Theme.Color.primary600
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(accent.opacity(0.14))
                    Icon(icon, size: 16, color: accent)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    if let subtitle {
                        Text(subtitle).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, 11)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }
}
