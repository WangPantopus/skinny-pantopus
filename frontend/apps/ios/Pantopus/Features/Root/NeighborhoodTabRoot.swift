//
//  NeighborhoodTabRoot.swift
//  Pantopus
//
//  Nearby tab (four-tab IA, renamed "Nearby" in Phase 1.5; the Swift types
//  keep their Neighborhood names). It is on the bar only while the Pulse
//  redesign is off (launch cut #11, `LaunchFeatures.pulseRedesign`); with it
//  on, Pulse is a tab of its own (`PulseTabRoot`).
//
//  Founder decision 2026-10-20: no door page. Nearby is two segments under
//  one header with the side menu: Pulse, the October 13 feed (`PulseTabRoot`
//  with its own NavigationStack, so posts, the composer and profiles push as
//  before), where the tab opens; and Neighborhood, the density window, the
//  meter and "Invite your neighbors" (`NeighborhoodView`). Connections is in
//  the side menu. The Pulse segment stays mounted while Neighborhood shows,
//  so the feed keeps its place, filters and List / Map mode.
//
//  On a wide screen (the iPhone Duo open) both segments are two columns of
//  the same width, so the switch and the menu stay put: Pulse is the feed
//  beside the open post (`PulseSplitView`), and Neighborhood the map's key,
//  the meter and the invite beside the map, which fills the other column.
//  Until there is a map to show (loading, an error, no home yet) Neighborhood
//  stays one column.
//
//  Tasks / Marketplace (launch cuts #3/#4) still present as sheets, from the
//  meter's rows or a link. Cross-tab deep links arrive via
//  `NeighborhoodDoorStore`: a feed or post link asks for the Pulse segment
//  (the Pulse stack then consumes it), `/nearby` for Neighborhood, and
//  `.gig` / `.listing` stash their surface, whose sheet mounts its tab root,
//  which then consumes `router.pending`.
//
//  Nearby Plans is a tab of its own (`PlansTabRoot`, founder decision
//  2026-10-17), so Nearby is this screen whether the `plans` flag is on or off.
//

import SwiftUI

public struct NeighborhoodTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    /// Regular width (the iPhone Duo open) puts Neighborhood's map beside its key and invite.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var door = NeighborhoodDoorStore.shared
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?
    @State private var segment: NearbySegment = .pulse
    /// Neighborhood's meter and map on a wide screen, read once for both columns.
    @State private var neighborhood = NeighborhoodViewModel()

    /// Starts adding a home in the Place tab (Neighborhood's "Set up a home").
    private let onAddHome: @MainActor () -> Void

    public init(onAddHome: @escaping @MainActor () -> Void = {}) {
        self.onAddHome = onAddHome
    }

    public var body: some View {
        ZStack {
            // The feed's root carries the header, so a pushed post covers it.
            PulseTabRoot(onAddHome: onAddHome, header: AnyView(NearbySegmentHeader(segment: $segment)))
                .opacity(segment == .pulse ? 1 : 0)
                .allowsHitTesting(segment == .pulse)
                .accessibilityHidden(segment != .pulse)
            if segment == .neighborhood {
                neighborhoodSegment
            }
        }
        .sheet(item: $presentedSurface) { surface in
            surfaceRoot(surface)
        }
        .onChange(of: door.pendingSurface) { _, pending in
            presentPendingSurfaceIfNeeded(pending)
        }
        .onChange(of: door.pendingSegment) { _, _ in
            showPendingSegmentIfNeeded()
        }
        .onChange(of: rootTabs.selected) { _, selected in
            // A deep link owned by another tab (profile, notifications,
            // conversation) selects that tab underneath the presented
            // surface sheet; dismiss the sheet so the destination is
            // actually visible instead of rendering behind it.
            if selected != .nearby { presentedSurface = nil }
            showPendingSegmentIfNeeded()
        }
        .task {
            showPendingSegmentIfNeeded()
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
        .onAppear {
            showPendingSegmentIfNeeded()
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
    }

    @ViewBuilder private var neighborhoodSegment: some View {
        if isSideBySide, let cells = cellsBeside {
            SideBySideSplit(leadingWidth: .nearby) {
                VStack(spacing: Spacing.s0) {
                    NearbySegmentHeader(segment: $segment)
                    NeighborhoodView(viewModel: neighborhood, mapBeside: true, onOpenSurface: openSurface, onClaimPlace: onAddHome)
                }
                .background(Theme.Color.appBg)
                .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            } detail: {
                NearbyCellsMap(cells: cells)
                    .toolbar(.hidden, for: .navigationBar)
                    .accessibilityIdentifier("nearby.cellsMap")
            }
        } else {
            VStack(spacing: Spacing.s0) {
                NearbySegmentHeader(segment: $segment)
                if isSideBySide {
                    // Wide, with no map yet: one column, filling the model the two columns share.
                    NeighborhoodView(viewModel: neighborhood, onOpenSurface: openSurface, onClaimPlace: onAddHome)
                } else {
                    NeighborhoodView(onOpenSurface: openSurface, onClaimPlace: onAddHome)
                }
            }
            .readableColumn()
            .background(Theme.Color.appBg)
            // Above the header, where the Pulse segment's feed shows it.
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
    }

    private func openSurface(_ surface: NeighborhoodDoorStore.Surface) {
        presentedSurface = surface
    }

    private var isSideBySide: Bool {
        horizontalSizeClass == .regular
    }

    /// The map beside Neighborhood's column: once the meter is in and there is a home to map around.
    private var cellsBeside: NeighborhoodCellsDTO? {
        guard case let .loaded(meter) = neighborhood.state, meter.state != .noPlace else { return nil }
        return neighborhood.cells
    }

    private func showPendingSegmentIfNeeded() {
        guard let pending = door.pendingSegment, rootTabs.selected == .nearby else { return }
        door.pendingSegment = nil
        segment = pending
    }

    private func presentPendingSurfaceIfNeeded(_ pending: NeighborhoodDoorStore.Surface?) {
        guard let pending, rootTabs.selected == .nearby else { return }
        door.pendingSurface = nil
        if pending == .pulse {
            segment = .pulse
            return
        }
        // Launch cuts #3/#4: a hidden surface never opens.
        if pending.isAvailableAtLaunch { presentedSurface = pending }
    }

    /// The launch-cut surfaces' own tab roots, unchanged: each brings its own
    /// NavigationStack and consumes its own deep-link destinations.
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

/// The Nearby tab's header: the Pulse | Neighborhood switch and the side menu
/// (founder decision 2026-10-20), on both segments' roots.
struct NearbySegmentHeader: View {
    @Binding var segment: NearbySegment

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Picker("Nearby", selection: $segment) {
                ForEach(NearbySegment.allCases, id: \.self) { item in
                    Text(item.label)
                        .tag(item)
                        .accessibilityIdentifier("nearbySegment.\(item.rawValue)")
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("nearbySegments")
            NavigationMenuButton(accessibilityIdentifier: "nearby.menu")
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appBg)
    }
}
