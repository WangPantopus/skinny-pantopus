//
//  TeamPerformanceView.swift
//  Pantopus
//
//  H12 Team Performance (Stream I17, Business violet). A round-robin balance
//  indicator + an avatar-first member list comparing booking load and
//  reliability. Handles business-only, permission-gated, single-member, empty,
//  loading, and error. The violet pillar is never reassigned; metrics are
//  always announced with text labels.
//

import SwiftUI

struct TeamPerformanceView: View {
    @State private var model: TeamPerformanceViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: TeamPerformanceViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            InsightsTopBar(title: "Team performance", onBack: { dismiss() }, trailing: {
                if case .loaded = model.phase {
                    InsightsSortChip(label: model.sortLabel, accent: model.accent) { model.toggleSort() }
                }
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
                memberOptions: model.memberOptions,
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
        case .loaded:
            loadedBody
        case .empty:
            centeredNote(
                icon: .users,
                title: "Not enough team data",
                subtitle: "Team insights appear once more than one member takes bookings."
            )
        case .businessOnly:
            centeredNote(
                icon: .users,
                title: "Business pages only",
                subtitle: "Team performance compares members on a business round-robin engine."
            )
        case .permissionGated:
            centeredNote(
                icon: .lock,
                title: "Owners and admins only",
                subtitle: "Only owners and admins can view team performance."
            )
        case let .error(message):
            InsightsErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                HStack {
                    InsightsPeriodChip(label: model.filter.chipLabel(), accent: model.accent, badge: model.filter.activeFilterCount) {
                        model.openFilter()
                    }
                    Spacer()
                }
                if model.isSingleMember {
                    singleMemberNote
                } else {
                    balanceCard
                }
                memberList
                Color.clear.frame(height: Spacing.s6)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
        .refreshable { await model.refresh() }
    }

    // MARK: Balance

    private var balanceCard: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(spacing: 6) {
                    InsightsOverline(text: "Round-robin balance")
                    Spacer()
                    Icon(.gauge, size: 14, color: model.accent)
                }
                TeamBalanceBar(rows: model.hostRows, accent: model.accent)
                Text(model.balanceLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityLabel("Round-robin balance: \(model.balanceLabel)")
            }
        }
    }

    private var singleMemberNote: some View {
        InsightsCard {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(model.accent.opacity(0.14))
                    Icon(.user, size: 16, color: model.accent)
                }
                .frame(width: 32, height: 32)
                Text("Only one member takes bookings right now.")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Member list

    private var memberList: some View {
        InsightsCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                InsightsOverline(text: "Members")
                VStack(spacing: 0) {
                    ForEach(Array(model.hostRows.enumerated()), id: \.element.id) { index, row in
                        memberRow(row)
                        if index < model.hostRows.count - 1 {
                            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    private func memberRow(_ row: HostRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(model.accent.opacity(0.14))
                    Text(row.initials)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(model.accent)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(metricStrip(row))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
            }
            ProportionBar(value: row.share, accent: model.accent)
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.name), \(metricStrip(row)), \(Int((row.share * 100).rounded())) percent of bookings")
    }

    private func metricStrip(_ row: HostRow) -> String {
        let plural = row.bookings == 1 ? "" : "s"
        let rate = InsightsFormat.percent(row.noShowRate)
        return "\(row.bookings) booking\(plural) · \(row.completed) completed · \(rate) no-show"
    }

    // MARK: Generic centered note

    private func centeredNote(icon: PantopusIcon, title: String, subtitle: String) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(model.theme.accentBg).frame(width: 72, height: 72)
                Icon(icon, size: 30, color: model.accent)
            }
            .accessibilityHidden(true)
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(subtitle)
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
        .accessibilityLabel("\(title). \(subtitle)")
    }
}

/// The round-robin distribution bar — one accent-tinted segment per member.
private struct TeamBalanceBar: View {
    let rows: [HostRow]
    let accent: Color

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(accent.opacity(opacity(for: index)))
                        .frame(width: max(2, geo.size.width * CGFloat(row.share)) - 2)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(height: 16)
        .accessibilityHidden(true)
    }

    /// Step the accent down per member so adjacent segments read apart.
    private func opacity(for index: Int) -> Double {
        let base = 0.9
        let step = 0.14
        return max(0.3, base - step * Double(index))
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        TeamPerformanceView(owner: .business(id: "biz")) { _ in }
    }
}
#endif
