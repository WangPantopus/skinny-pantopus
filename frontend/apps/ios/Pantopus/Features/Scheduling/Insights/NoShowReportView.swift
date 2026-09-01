//
//  NoShowReportView.swift
//  Pantopus
//
//  H11 No-Show & Cancellation Report (Stream I17). Headline rate, a stacked
//  reliability breakdown, the recent-no-shows list, and a policy callout —
//  plus a celebratory zero-no-show state. Outcome chips use semantic colors
//  (never the pillar), and every metric is announced with a text label.
//

import SwiftUI

struct NoShowReportView: View {
    @State private var model: NoShowReportViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: NoShowReportViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            InsightsTopBar(title: "No-shows & cancellations", onBack: { dismiss() }, trailing: {
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
            InsightsSkeleton(kind: .list)
        case .celebratory:
            celebratory
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
                breakdownCard
                if !model.recentRows.isEmpty { recentCard }
                policyCallout
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
            VStack(alignment: .leading, spacing: 4) {
                InsightsOverline(text: "No-show rate")
                Text(model.noShowRateLabel)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(model.subLabel)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("No-show rate \(model.noShowRateLabel), \(model.subLabel)")
        }
    }

    // MARK: Breakdown

    private var breakdownCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                InsightsOverline(text: "Breakdown")
                StackedBreakdownBar(segments: model.segments)
            }
        }
    }

    // MARK: Recent

    private var recentCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                InsightsOverline(text: "Recent no-shows")
                VStack(spacing: 0) {
                    ForEach(Array(model.recentRows.enumerated()), id: \.element.id) { index, row in
                        recentRow(row)
                        if index < model.recentRows.count - 1 {
                            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    private func recentRow(_ row: NoShowReportViewModel.RecentRow) -> some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken)
                Text(InsightsMath.initials(from: row.name))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(row.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if row.isRepeat {
                        Icon(.flag, size: 12, color: Theme.Color.warning)
                            .accessibilityLabel("Repeat no-show")
                    }
                }
                Text(row.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            outcomeChip
        }
        .padding(.vertical, 9)
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.name), \(row.detail), no-show\(row.isRepeat ? ", repeat" : "")")
    }

    private var outcomeChip: some View {
        Text("No-show")
            .font(.system(size: 10.5, weight: .bold))
            .foregroundStyle(Theme.Color.error)
            .padding(.horizontal, 8)
            .frame(height: 21)
            .background(Theme.Color.errorBg)
            .clipShape(Capsule())
    }

    // MARK: Policy callout

    private var policyCallout: some View {
        InsightsCard {
            HStack(alignment: .top, spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(model.accent.opacity(0.14))
                    Icon(.shield, size: 16, color: model.accent)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Reduce no-shows")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Require a deposit or a cancellation window for this event type.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button(action: { model.openPolicy() }, label: {
                        Text("Set a policy")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(model.accent)
                    })
                    .padding(.top, 2)
                    .accessibilityIdentifier("scheduling.insights.setPolicy")
                }
            }
        }
    }

    // MARK: Celebratory

    private var celebratory: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.successBg).frame(width: 72, height: 72)
                Icon(.partyPopper, size: 32, color: Theme.Color.success)
            }
            .accessibilityHidden(true)
            Text("No no-shows. Nice.")
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Everyone who booked in the last \(model.windowDays) days showed up.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s6)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("No no-shows. Everyone who booked in the last \(model.windowDays) days showed up.")
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        NoShowReportView(owner: .personal) { _ in }
    }
}
#endif
