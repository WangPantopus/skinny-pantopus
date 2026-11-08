//
//  NeighborhoodTabRoot.swift
//  Pantopus
//
//  The bar's Pulse tab while the Pulse redesign is off (launch cut #11,
//  `LaunchFeatures.pulseRedesign`); with it on, Pulse is `PulseTabRoot` on
//  its own. (The tab was Nearby until the founder's November 7 decision; the
//  Swift types keep their Neighborhood names.)
//
//  Founder decision 2026-11-07: the tab is the October 13 feed (`PulseTabRoot`
//  with its own NavigationStack, so posts, the composer and profiles push as
//  before), whose header opens with the big List | Map switch and the side
//  menu. The Pulse | Neighborhood switch is gone: the density window, the
//  meter and "Invite your neighbors" are "Verified homes nearby", opened from
//  Place's Verified neighbors rows (`VerifiedHomesNearbyView`). Connections
//  is in the side menu.
//
//  On a wide screen (the iPhone Duo open, held sideways) the feed and the
//  open post are two columns of the same width (`PulseSplitView`). Upright,
//  the open Duo is too narrow for a phone-width column beside the feed, so
//  the tab is one column there.
//
//  Tasks / Marketplace (launch cuts #3/#4) still present as sheets when a link
//  asks for them: `.gig` / `.listing` stash their surface in
//  `NeighborhoodDoorStore`, whose sheet mounts its tab root, which then
//  consumes `router.pending`.
//
//  Nearby Plans is a tab of its own (`PlansTabRoot`, founder decision
//  2026-10-17), so this screen is the same whether the `plans` flag is on or off.
//

import SwiftUI

public struct NeighborhoodTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    /// Regular width (the iPhone Duo open) puts the feed and the open post in two columns, where the screen is wide
    /// enough.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var door = NeighborhoodDoorStore.shared
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?

    /// Starts adding a home in the Place tab.
    private let onAddHome: @MainActor () -> Void

    public init(onAddHome: @escaping @MainActor () -> Void = {}) {
        self.onAddHome = onAddHome
    }

    public var body: some View {
        // Read in layout, so the first pass already picks one column or two; always here, so a fold keeps the feed.
        GeometryReader { proxy in
            PulseTabRoot(
                onAddHome: onAddHome,
                mapSwitchOnTop: true,
                sideBySide: isSideBySide(width: proxy.size.width)
            )
        }
        .sheet(item: $presentedSurface) { surface in
            surfaceRoot(surface)
        }
        .onChange(of: door.pendingSurface) { _, pending in
            presentPendingSurfaceIfNeeded(pending)
        }
        .onChange(of: rootTabs.selected) { _, selected in
            // A deep link owned by another tab (profile, notifications,
            // conversation) selects that tab underneath the presented
            // surface sheet; dismiss the sheet so the destination is
            // actually visible instead of rendering behind it.
            if selected != .nearby { presentedSurface = nil }
        }
        .task {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
        .onAppear {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
    }

    /// Two columns: regular width, with room for the feed's column beside a phone-width one.
    private func isSideBySide(width: CGFloat) -> Bool {
        horizontalSizeClass == .regular && SideBySideColumnWidth.nearby.fitsBeside(in: width)
    }

    private func presentPendingSurfaceIfNeeded(_ pending: NeighborhoodDoorStore.Surface?) {
        guard let pending, rootTabs.selected == .nearby else { return }
        door.pendingSurface = nil
        // `.pulse` is this tab itself; launch cuts #3/#4: a hidden surface never opens.
        if pending != .pulse, pending.isAvailableAtLaunch { presentedSurface = pending }
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
