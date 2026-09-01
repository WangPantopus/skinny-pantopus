//
//  NeighborhoodTabRoot.swift
//  Pantopus
//
//  Nearby tab — the density-gated door (wedge Phase 1 four-tab IA, renamed
//  "Nearby" in Phase 1.5; the Swift types keep their Neighborhood names).
//
//  Pulse / Tasks / Marketplace no longer sit on the root tab bar; they
//  present as sheets from this door once the viewer's area crosses the
//  unlock threshold. Each sheet hosts the surface's original tab root
//  (own NavigationStack + deep-link consumption), so drill-down behavior
//  is unchanged — only the entry point moved.
//
//  Cross-tab deep links (`.feed`/`.post` → Pulse, `.gig` → Tasks,
//  `.listing` → Marketplace) arrive via `NeighborhoodDoorStore`: the root
//  dispatcher selects this tab and stashes the surface; presenting the
//  sheet mounts the tab root, which then consumes `router.pending`.
//

import SwiftUI

public struct NeighborhoodTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var door = NeighborhoodDoorStore.shared
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?

    public init() {}

    public var body: some View {
        NavigationStack {
            NeighborhoodView(
                onOpenSurface: { surface in
                    presentedSurface = surface
                },
                onClaimPlace: {
                    // The claim flow lives in the Place tab's stack — its
                    // hub root carries the add-home / verification CTAs.
                    rootTabs.selected = .place
                }
            )
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(item: $presentedSurface) { surface in
            surfaceRoot(surface)
        }
        .onChange(of: door.pendingSurface) { _, pending in
            presentPendingSurfaceIfNeeded(pending)
        }
        .task {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
        .onAppear {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
        }
    }

    private func presentPendingSurfaceIfNeeded(_ pending: NeighborhoodDoorStore.Surface?) {
        guard let pending, rootTabs.selected == .nearby else { return }
        presentedSurface = pending
        door.pendingSurface = nil
    }

    /// The original tab roots, unchanged — each brings its own
    /// NavigationStack and consumes its own deep-link destinations.
    @ViewBuilder
    private func surfaceRoot(_ surface: NeighborhoodDoorStore.Surface) -> some View {
        switch surface {
        case .pulse:
            PulseTabRoot()
        case .tasks:
            TasksTabRoot()
        case .marketplace:
            MarketplaceTabRoot()
        }
    }
}
