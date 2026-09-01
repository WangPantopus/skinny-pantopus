//
//  WalletActivityListView.swift
//  Pantopus
//
//  WS5.1 — paginated wallet transaction list (history / all activity).
//

import SwiftUI

public struct WalletActivityListView: View {
    @State private var viewModel: WalletActivityListViewModel
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: WalletActivityListViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .sensitiveScreen()
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("walletActivityList")
    }

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            Spacer(minLength: Spacing.s0)
            Text(viewModel.title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s0)
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    ForEach(0..<6, id: \.self) { _ in FeedSkeletonCard() }
                }
                .padding(Spacing.s4)
            }
        case .empty:
            EmptyState(
                icon: .history,
                headline: "No activity yet",
                subcopy: "Earnings, withdrawals, and tips will show up here."
            )
            .frame(maxHeight: .infinity)
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load activity",
                subcopy: message,
                cta: .init(title: "Retry") { await viewModel.refresh() }
            )
            .frame(maxHeight: .infinity)
        case let .loaded(items):
            ScrollView {
                WalletActivityGroupedList(items: items) { item in
                    Task { await viewModel.loadMoreIfNeeded(currentItemId: item.id) }
                }
                .padding(Spacing.s4)
            }
        }
    }
}

private struct WalletActivityGroupedList: View {
    let items: [WalletActivityItem]
    let onAppearLast: (WalletActivityItem) -> Void

    var body: some View {
        // Lazy: rows compose as they scroll into view, so the trailing
        // `onAppear` paging hook fires on scroll rather than immediately
        // for every page at once.
        LazyVStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index == 0 || items[index - 1].day != item.day {
                    Text(item.day)
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.7)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, 14)
                        .padding(.top, index == 0 ? Spacing.s2 : Spacing.s3)
                        .padding(.bottom, Spacing.s1)
                }
                WalletActivityRow(item: item, isLast: index == items.count - 1)
                    .onAppear {
                        if index == items.count - 1 { onAppearLast(item) }
                    }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
    }
}
