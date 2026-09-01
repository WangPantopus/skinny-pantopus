//
//  InsightsDashboardView.swift
//  Pantopus
//
//  H9 Insights Dashboard (Stream I17). A single scroll of read-only cards:
//  2×2 headline tiles, a bookings-over-time chart, a ranked top-event-types
//  list, and footer links into the no-show report and team performance. States:
//  loading skeleton / empty (not enough data) / loaded / partial (trend
//  suppressed) / error+retry, wrapped in the offline banner.
//

import SwiftUI

struct InsightsDashboardView: View {
    @State private var model: InsightsDashboardViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: InsightsDashboardViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            InsightsTopBar(title: "Insights", onBack: { dismiss() }, trailing: {
                InsightsPeriodChip(
                    label: model.filter.chipLabel(),
                    accent: model.accent,
                    badge: model.filter.activeFilterCount
                ) { model.openFilter() }
            })
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .sheet(isPresented: $model.showFilterSheet) {
            InsightsPeriodFilterSheet(
                initial: model.filter,
                eventTypeOptions: model.eventTypeOptions,
                memberOptions: [],
                accent: model.accent
            ) { applied in Task { await model.apply(applied) } }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            InsightsSkeleton(kind: .dashboard)
        case .empty:
            EmptyState(
                icon: .barChart3,
                headline: "Not enough data yet",
                subcopy: "Insights appear once you have a few bookings. Share your link to get started.",
                cta: .init(title: "Share your booking link") { model.openBookingPage() },
                tint: model.theme.accentBg,
                accent: model.accent
            )
        case .loaded:
            loadedBody
        case let .error(message):
            InsightsErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                tilesGrid
                trendCard
                if !model.topTypes.isEmpty { topTypesCard }
                footerLinks
                Color.clear.frame(height: Spacing.s6)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
        .refreshable { await model.refresh() }
    }

    // MARK: Tiles

    private var tilesGrid: some View {
        let tiles = model.tiles
        return VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                StatTileView(tile: tiles[0], accent: model.accent)
                StatTileView(tile: tiles[1], accent: model.accent)
            }
            HStack(spacing: Spacing.s2) {
                StatTileView(tile: tiles[2], accent: model.accent)
                StatTileView(tile: tiles[3], accent: model.accent)
            }
        }
    }

    // MARK: Trend

    private var trendCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                InsightsOverline(text: "Bookings over time")
                if model.hasTrend {
                    MiniBarChartView(bars: model.dayBars, accent: model.accent)
                } else {
                    HStack(spacing: 8) {
                        Icon(.barChart3, size: 16, color: Theme.Color.appTextMuted)
                        Text("More data needed for trends")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(Theme.Color.appSurfaceSunken.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                Text("Last 30 days")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    // MARK: Top types

    private var topTypesCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                InsightsOverline(text: "Top event types")
                VStack(spacing: 0) {
                    ForEach(Array(model.topTypes.enumerated()), id: \.element.id) { index, row in
                        RankedRowView(row: row, accent: model.accent) { model.openType(row.id) }
                        if index < model.topTypes.count - 1 {
                            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    // MARK: Footer links

    private var footerLinks: some View {
        InsightsCard(padding: 4) {
            VStack(spacing: 0) {
                InsightsLinkRow(
                    icon: .shield,
                    title: "No-show & cancellation report",
                    subtitle: model.noShowLinkSubtitle,
                    accent: model.accent
                ) { model.openNoShowReport() }
                if model.isBusiness {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.leading, 43)
                    InsightsLinkRow(
                        icon: .users,
                        title: "Team performance",
                        subtitle: "Round-robin balance",
                        accent: model.accent
                    ) { model.openTeamPerformance() }
                }
            }
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InsightsDashboardView(owner: .business(id: "biz")) { _ in }
    }
}
#endif
