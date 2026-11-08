//
//  VerifiedHomesNearbyView.swift
//  Pantopus
//
//  "Verified homes nearby" (founder decision 2026-11-07): the density window,
//  the meter and "Invite your neighbors" that were the Nearby tab's
//  Neighborhood segment, now a page of the Place stack. It opens from Place's
//  Verified neighbors rows and from `/nearby` links (the neighborhood
//  milestone push among them). Its body is `NeighborhoodView`. On a wide
//  screen (the iPhone Duo open, held sideways) the map fills a column beside
//  the key, the meter and the invite, as the segment did; until there is a map
//  to show (loading, an error, no home yet) the page stays one column. The
//  launch-cut Tasks and Marketplace rows present their surfaces as sheets.
//

import SwiftUI

struct VerifiedHomesNearbyView: View {
    /// Regular width (the iPhone Duo open) puts the map in a column of its own, where the screen is wide enough.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    /// The meter and the map, read once for both columns.
    @State private var neighborhood = NeighborhoodViewModel()
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?

    private let onBack: () -> Void
    /// Starts adding a home ("Set up a home", before there is one).
    private let onAddHome: @MainActor () -> Void

    init(onBack: @escaping () -> Void, onAddHome: @escaping @MainActor () -> Void) {
        self.onBack = onBack
        self.onAddHome = onAddHome
    }

    var body: some View {
        // Read in layout, so the first pass already picks one column or two.
        GeometryReader { proxy in
            let sideBySide = horizontalSizeClass == .regular
                && SideBySideColumnWidth.nearby.fitsBeside(in: proxy.size.width)
            if sideBySide, let cells = cellsBeside {
                // Two plain columns: a page of the Place stack, so no split view inside it.
                HStack(spacing: Spacing.s0) {
                    VStack(spacing: Spacing.s0) {
                        header
                        NeighborhoodView(
                            viewModel: neighborhood,
                            mapBeside: true,
                            onOpenSurface: { presentedSurface = $0 },
                            onClaimPlace: onAddHome
                        )
                    }
                    .frame(width: SideBySideColumnWidth.nearby.ideal)
                    .background(Theme.Color.appBg)
                    Rectangle().fill(Theme.Color.appBorder).frame(width: 1)
                    NearbyCellsMap(cells: cells)
                        .accessibilityIdentifier("nearby.cellsMap")
                }
                .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            } else {
                NeighborhoodView(
                    viewModel: neighborhood,
                    onOpenSurface: { presentedSurface = $0 },
                    onClaimPlace: onAddHome
                )
                // The header slides away while the page scrolls down and comes back near its top, as on Android.
                .scrollAwayHeader { header }
                .readableColumn()
                .background(Theme.Color.appBg)
                .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            }
        }
        // The Place stack keeps its pages to a readable column: where the map fits beside, this page takes the width.
        .readableColumnWidens(from: SideBySideColumnWidth.nearby.screenWidthBeside)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("verifiedHomesNearby")
        .sheet(item: $presentedSurface) { surface in
            surfaceRoot(surface)
        }
    }

    private var header: some View {
        PlaceDetailHeader(title: "Verified homes nearby", address: "Around your home", onBack: onBack)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
    }

    /// The map beside the column: once the meter is in and there is a home to map around.
    private var cellsBeside: NeighborhoodCellsDTO? {
        guard case let .loaded(meter) = neighborhood.state, meter.state != .noPlace else { return nil }
        return neighborhood.cells
    }

    /// The launch-cut surfaces' own tab roots, unchanged: each brings its own NavigationStack.
    @ViewBuilder
    private func surfaceRoot(_ surface: NeighborhoodDoorStore.Surface) -> some View {
        switch surface {
        case .tasks:
            TasksTabRoot { presentedSurface = nil }
        case .marketplace:
            MarketplaceTabRoot { presentedSurface = nil }
        case .pulse:
            EmptyView()
        }
    }
}
