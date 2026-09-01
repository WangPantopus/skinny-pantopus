//
//  UniversalSearchView.swift
//  Pantopus
//
//  S2 — Universal search. Search field + six tab chips (All / Tasks /
//  People / Beacons / Businesses / Homes) over grouped result sections,
//  mirroring RN `src/app/discover.tsx` and the A08 "Discover hub"
//  design frame (top bar → chip strip → overline section headers →
//  hairline rows inside a rounded card).
//
//  Reached from the navigation drawer's "Search" row; gig-only search
//  stays reachable from the Tasks tab here and from the Gigs feed
//  search bar.
//

import SwiftUI

/// Universal search across tasks, people, Beacons, businesses, and homes.
public struct UniversalSearchView: View {
    @State private var viewModel: UniversalSearchViewModel
    private let onOpen: @MainActor (UniversalSearchDestination) -> Void
    private let onBrowseNearbyBusinesses: @MainActor () -> Void
    private let onBack: @MainActor () -> Void

    @FocusState private var fieldFocused: Bool

    init(
        viewModel: UniversalSearchViewModel = UniversalSearchViewModel(),
        onOpen: @escaping @MainActor (UniversalSearchDestination) -> Void = { _ in },
        onBrowseNearbyBusinesses: @escaping @MainActor () -> Void = {},
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpen = onOpen
        self.onBrowseNearbyBusinesses = onBrowseNearbyBusinesses
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            Divider().background(Theme.Color.appBorderSubtle)
            tabStrip
            phaseBody
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { fieldFocused = true }
        .accessibilityIdentifier("universalSearch")
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Button { onBack() } label: {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("universalSearchBack")

                searchField
            }
            if let hint = viewModel.thresholdHint {
                Text(hint)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.leading, Spacing.s12 + Spacing.s3)
                    .accessibilityIdentifier("universalSearchHint")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, color: Theme.Color.appTextSecondary)
            TextField(
                "Search tasks, people, Beacons, businesses…",
                text: Binding(
                    get: { viewModel.query },
                    set: { newValue in
                        viewModel.query = newValue
                        viewModel.onQueryChanged()
                    }
                )
            )
            .font(Theme.Font.role(.body))
            .foregroundStyle(Theme.Color.appText)
            .submitLabel(.search)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .focused($fieldFocused)
            .accessibilityIdentifier("universalSearchField")

            if !viewModel.query.isEmpty {
                Button {
                    viewModel.clearQuery()
                    fieldFocused = true
                } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .accessibilityIdentifier("universalSearchClear")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Tabs

    private var tabStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(UniversalSearchTab.allCases, id: \.self) { tab in
                    tabChip(tab)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("universalSearchTabs")
    }

    private func tabChip(_ tab: UniversalSearchTab) -> some View {
        let isActive = tab == viewModel.activeTab
        return Button { viewModel.selectTab(tab) } label: {
            Text(tab.title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, 14)
                .frame(height: 28)
                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(isActive ? .clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("universalSearchTab_\(tab.rawValue)")
    }

    // MARK: - Phase body

    @ViewBuilder private var phaseBody: some View {
        switch viewModel.state {
        case .idle:
            promptSection(
                identifier: "universalSearchIdle",
                headline: "Search Pantopus",
                subcopy: "Find tasks, people, Beacons, businesses, and homes nearby."
            )
        case .loading:
            shimmerSection
        case let .loaded(sections):
            resultsSection(sections)
        case .empty:
            promptSection(
                identifier: "universalSearchEmpty",
                headline: viewModel.beaconsUnavailable ? "Beacon search is off" : "No results found",
                subcopy: viewModel.beaconsUnavailable
                    ? "Beacon discovery isn't enabled on this server yet. Try another tab."
                    : "Try a different search term or category."
            )
        case let .error(message):
            ErrorState(headline: "Couldn't search", message: message) {
                await viewModel.refresh()
            }
            .accessibilityIdentifier("universalSearchError")
        }
    }

    private func promptSection(
        identifier: String,
        headline: String,
        subcopy: String
    ) -> some View {
        VStack(spacing: Spacing.s0) {
            if viewModel.activeTab == .businesses {
                UniversalSearchBrowseNearbyCard(onTap: onBrowseNearbyBusinesses)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
            }
            EmptyState(icon: .search, headline: headline, subcopy: subcopy)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier(identifier)
    }

    private var shimmerSection: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 40, height: 40, cornerRadius: Radii.lg)
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Shimmer(width: 180, height: 14)
                            Shimmer(width: 120, height: 12)
                        }
                        Spacer()
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("universalSearchShimmer")
    }

    private func resultsSection(_ sections: [UniversalSearchSection]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                if viewModel.activeTab == .businesses {
                    UniversalSearchBrowseNearbyCard(onTap: onBrowseNearbyBusinesses)
                        .padding(.top, Spacing.s3)
                }
                ForEach(viewModel.failedSources, id: \.self) { kind in
                    UniversalSearchNotice(kind: kind) { await viewModel.refresh() }
                }
                ForEach(sections) { section in
                    if viewModel.showsSectionHeaders {
                        UniversalSearchSectionHeader(section: section)
                    }
                    UniversalSearchResultsCard(section: section, onOpen: onOpen)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("universalSearchResults")
    }
}

#Preview {
    UniversalSearchView()
}
