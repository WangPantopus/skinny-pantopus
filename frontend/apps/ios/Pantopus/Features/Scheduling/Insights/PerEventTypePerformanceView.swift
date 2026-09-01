//
//  PerEventTypePerformanceView.swift
//  Pantopus
//
//  H10 Per-Event-Type Performance (Stream I17). A header card (name / duration /
//  price), a Booked → Completed → No-show funnel, a 2×2 stat grid, a
//  bookings-over-time chart, and an "edit event type" footer. Empty when the
//  type was never booked.
//

import SwiftUI

struct PerEventTypePerformanceView: View {
    @State private var model: PerEventTypePerformanceViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: PerEventTypePerformanceViewModel(
            owner: owner,
            eventTypeId: eventTypeId,
            push: push,
            client: client
        ))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            InsightsTopBar(title: model.title, onBack: { dismiss() }, trailing: {
                InsightsPeriodChip(label: model.filter.chipLabel(), accent: model.accent) { model.openFilter() }
            })
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .sheet(isPresented: $model.showFilterSheet) {
            InsightsPeriodFilterSheet(
                initial: model.filter,
                eventTypeOptions: [],
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
            InsightsSkeleton(kind: .detail)
        case .empty:
            emptyBody
        case .loaded:
            loadedBody
        case let .error(message):
            InsightsErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                headerCard
                funnelCard
                tilesGrid
                trendCard
                editButton
                Color.clear.frame(height: Spacing.s6)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
        .refreshable { await model.refresh() }
    }

    // MARK: Header

    private var headerCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: 6) {
                Text(model.title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                HStack(spacing: Spacing.s3) {
                    if !model.durationLabel.isEmpty {
                        metaItem(.clock, model.durationLabel)
                    }
                    metaItem(.tag, model.priceLabel)
                }
            }
        }
    }

    private func metaItem(_ icon: PantopusIcon, _ text: String) -> some View {
        HStack(spacing: 5) {
            Icon(icon, size: 13, color: Theme.Color.appTextMuted)
            Text(text).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    // MARK: Funnel

    private var funnelCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                InsightsOverline(text: "Funnel")
                ForEach(model.funnel) { step in
                    FunnelStepRow(
                        label: step.label,
                        count: step.count,
                        proportion: step.proportion,
                        percent: step.percent,
                        accent: model.accent
                    )
                }
            }
        }
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
            }
        }
    }

    // MARK: Edit

    private var editButton: some View {
        Button(action: { model.openEditor() }, label: {
            HStack(spacing: 6) {
                Icon(.pencil, size: 14, color: Theme.Color.appTextStrong)
                Text("Edit event type").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        })
        .accessibilityIdentifier("scheduling.insights.editEventType")
    }

    // MARK: Empty

    private var emptyBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                headerCard
                VStack(spacing: Spacing.s4) {
                    ZStack {
                        Circle().fill(model.theme.accentBg).frame(width: 72, height: 72)
                        Icon(.calendarClock, size: 30, color: model.accent)
                    }
                    .accessibilityHidden(true)
                    Text("No bookings yet for this type")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.center)
                    Text("Share this event type's link and its performance shows up here.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 280)
                    Button(action: { model.openBookingPage() }, label: {
                        Text("Share booking link")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, Spacing.s5)
                            .frame(height: 40)
                            .background(model.accent)
                            .clipShape(Capsule())
                    })
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s8)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PerEventTypePerformanceView(owner: .personal, eventTypeId: "preview") { _ in }
    }
}
#endif
