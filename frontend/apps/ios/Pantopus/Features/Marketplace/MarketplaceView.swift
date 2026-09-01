//
//  MarketplaceView.swift
//  Pantopus
//
//  T2.5 Marketplace. Bespoke 2-column image grid with search, 5
//  category chips, gradient-placeholder listing cards, and a
//  business-violet FAB.
//

import SwiftUI

public struct MarketplaceView: View {
    @State private var viewModel: MarketplaceViewModel
    @FocusState private var searchFocused: Bool
    private let onOpenListing: @MainActor (String) -> Void
    private let onCompose: @MainActor () -> Void
    private let onBack: (@MainActor () -> Void)?

    init(
        viewModel: MarketplaceViewModel = MarketplaceViewModel(),
        onOpenListing: @escaping @MainActor (String) -> Void = { _ in },
        onCompose: @escaping @MainActor () -> Void = {},
        onBack: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenListing = onOpenListing
        self.onCompose = onCompose
        self.onBack = onBack
    }

    /// Cold first load — per the A08 loading frame, the search bar and
    /// chip row shimmer alongside the grid. Later loads (chip taps,
    /// search) keep the chrome live and only the grid skeletons.
    private var isInitialLoading: Bool {
        if case .loading = viewModel.state { return !viewModel.hasLoadedOnce }
        return false
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: Spacing.s0) {
                topBar
                if isInitialLoading {
                    MarketplaceChromeSkeleton()
                } else {
                    searchBar
                    categoryChipRow
                }
                content
            }
            .background(Theme.Color.appBg)
            composeFAB
                .padding(.trailing, Spacing.s4)
                .padding(.bottom, Spacing.s10)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onAppear {
            // Re-fires when a pushed screen (wizard, listing detail)
            // pops back — refresh so a just-posted listing appears.
            Task { await viewModel.refreshOnReturn() }
        }
        .accessibilityIdentifier("marketplace")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            if let onBack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("marketplaceBackButton")
            }
            Text("Marketplace")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s1)
    }

    // MARK: - Search

    private var searchBar: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 17, color: Theme.Color.appTextSecondary)
            TextField("Search goods, rentals, free…", text: $viewModel.searchText)
                .font(.system(size: 13.5, weight: .medium))
                .foregroundStyle(Theme.Color.appText)
                .focused($searchFocused)
                .submitLabel(.search)
                .onSubmit { Task { await viewModel.submitSearch() } }
            if !viewModel.searchText.isEmpty {
                Button {
                    viewModel.searchText = ""
                    Task { await viewModel.submitSearch() }
                } label: {
                    Icon(.x, size: 14, color: Theme.Color.appTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("marketplaceSearchBar")
    }

    // MARK: - Category chip row

    private var categoryChipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(MarketplaceCategory.allCases, id: \.self) { category in
                    let active = category == viewModel.activeCategory
                    Button {
                        Task { await viewModel.selectCategory(category) }
                    } label: {
                        Text(category.label)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                            .padding(.horizontal, 14)
                            .frame(height: 28)
                            .background(active ? Theme.Color.primary600 : Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                    .stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(category.label)
                    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("marketplaceChip_\(category.rawValue)")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityIdentifier("marketplaceChipRow")
    }

    // MARK: - Compose FAB

    private var composeFAB: some View {
        Button(action: onCompose) {
            Icon(.camera, size: 22, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                .frame(width: 52, height: 52)
                .background(Theme.Color.business)
                .clipShape(Circle())
                .shadow(color: Theme.Color.business.opacity(0.36), radius: 12, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Snap & sell")
        .accessibilityIdentifier("marketplaceComposeFAB")
    }

    // MARK: - Content frames

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .empty(empty): emptyFrame(empty)
        case let .loaded(rows): populatedFrame(rows)
        case let .error(message): errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: 10) {
                ForEach(0..<6, id: \.self) { _ in
                    ListingSkeletonCard()
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
        .accessibilityIdentifier("marketplaceLoading")
    }

    private func emptyFrame(_ empty: MarketplaceEmpty) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.shoppingBag, size: 32, strokeWidth: 1.8, color: Theme.Color.primary600)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("Nothing for sale nearby yet")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Be the first to post. Tap the camera to snap and sell.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onCompose) {
                HStack(spacing: Spacing.s2) {
                    Icon(.camera, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Snap & sell")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 22)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("marketplaceEmptySnap")
            radiusHint(empty.radiusMiles)
                .padding(.top, Spacing.s4)
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("marketplaceEmpty")
    }

    private func radiusHint(_ miles: Double) -> some View {
        MarketplaceRadiusHint(miles: miles, canWiden: viewModel.canWidenRadius) {
            Task { await viewModel.widenRadius() }
        }
    }

    private func populatedFrame(_ rows: [MarketplaceCardContent]) -> some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: 10) {
                ForEach(rows) { row in
                    Button {
                        onOpenListing(row.id)
                    } label: {
                        ListingCard(content: row)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("marketplaceCard_\(row.id)")
                    .onAppear {
                        Task { await viewModel.loadMoreIfNeeded(currentId: row.id) }
                    }
                }
                if viewModel.isLoadingMore {
                    ListingSkeletonCard()
                    ListingSkeletonCard()
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
            .padding(.bottom, 110)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("marketplaceGrid")
    }

    private var gridColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 10), GridItem(.flexible())]
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Marketplace")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("marketplaceRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("marketplaceError")
    }
}

// MARK: - Chrome skeleton (A08 loading frame)

/// Cold-load stand-ins for the search bar + chip row — the design's
/// loading frame shimmers all three bands, not just the grid.
private struct MarketplaceChromeSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Shimmer(height: 44, cornerRadius: Radii.lg)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
            HStack(spacing: Spacing.s2) {
                ForEach(Array([50, 64, 76, 60, 84].enumerated()), id: \.offset) { _, width in
                    Shimmer(width: CGFloat(width), height: 28, cornerRadius: Radii.pill)
                }
                Spacer()
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Empty-state radius pill

/// "Showing within N mi" hint. Tapping widens the search radius to the
/// next step and refetches; at the widest step it renders inert.
private struct MarketplaceRadiusHint: View {
    let miles: Double
    let canWiden: Bool
    let onWiden: () -> Void

    var body: some View {
        Button(action: onWiden) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 13, color: Theme.Color.appTextMuted)
                Group {
                    Text("Showing within ")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        + Text(Self.radiusLabel(miles))
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        + Text(canWiden ? " · tap to widen" : " · max radius")
                        .font(.system(size: 11.5))
                        .foregroundStyle(canWiden ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!canWiden)
        .accessibilityIdentifier("marketplaceWidenRadius")
        .accessibilityLabel(
            canWiden
                ? "Showing within \(Self.radiusLabel(miles)). Tap to widen the search radius."
                : "Showing within \(Self.radiusLabel(miles)), the widest radius."
        )
    }

    private static func radiusLabel(_ miles: Double) -> String {
        if miles.truncatingRemainder(dividingBy: 1) == 0 { return "\(Int(miles)) mi" }
        return String(format: "%.1f mi", miles)
    }
}

// MARK: - Card

private struct ListingCard: View {
    let content: MarketplaceCardContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ListingImage(content: content)
                .frame(maxWidth: .infinity)
                .frame(height: 104)
            VStack(alignment: .leading, spacing: 3) {
                Text(content.title)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(minHeight: 28, alignment: .top)
                Text(content.price)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(content.isFree ? Theme.Color.success : Theme.Color.primary600)
                Text(content.metaLine)
                    .font(.system(size: 9.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.top, Spacing.s2)
            .padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct ListingImage: View {
    let content: MarketplaceCardContent

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [content.placeholderGradient.start, content.placeholderGradient.end],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if let url = content.imageUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        Icon(content.placeholderIcon, size: 34, strokeWidth: 1.6, color: .white.opacity(0.85))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Icon(content.placeholderIcon, size: 34, strokeWidth: 1.6, color: .white.opacity(0.85))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if let badge = content.conditionBadge {
                Text(badge.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.78))
                    .clipShape(Capsule())
                    .padding(.top, 6)
                    .padding(.leading, 6)
                    .accessibilityLabel("Condition: \(badge)")
            }
        }
        .clipped()
    }
}

private struct ListingSkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Shimmer(height: 104, cornerRadius: 0)
            VStack(alignment: .leading, spacing: 5) {
                Shimmer(height: 9, cornerRadius: Radii.xs)
                    .frame(maxWidth: .infinity)
                Shimmer(width: 100, height: 9, cornerRadius: Radii.xs)
                Shimmer(width: 48, height: 11, cornerRadius: Radii.xs)
                    .padding(.top, 3)
                Shimmer(width: 70, height: 8, cornerRadius: Radii.xs)
            }
            .padding(.horizontal, 10)
            .padding(.top, Spacing.s2)
            .padding(.bottom, 10)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityHidden(true)
    }
}

#Preview {
    MarketplaceView()
}
