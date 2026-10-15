//
//  NeighborhoodTabRoot.swift
//  Pantopus
//
//  Nearby tab — social discovery and local activity (four-tab IA, renamed
//  "Nearby" in Phase 1.5; the Swift types keep their Neighborhood names).
//  It is the October 13 tab, on the bar only while the Pulse redesign is off
//  (launch cut #11, `LaunchFeatures.pulseRedesign`); with it on, Pulse and
//  Plans are tabs of their own (`PulseTabRoot`, `PlansTabRoot`).
//
//  Pulse / Tasks / Marketplace no longer sit on the root tab bar; they
//  present as sheets from this door. Pulse is always available; the local
//  task/marketplace preview still uses the meter. Each sheet hosts its tab root
//  (own NavigationStack + deep-link consumption), so drill-down behavior
//  is unchanged — only the entry point moved.
//
//  Cross-tab deep links (`.feed`/`.post` → Pulse, `.gig` → Tasks,
//  `.listing` → Marketplace) arrive via `NeighborhoodDoorStore`: the root
//  dispatcher selects this tab and stashes the surface; presenting the
//  sheet mounts the tab root, which then consumes `router.pending`.
//
//  Nearby Plans: with the `plans` flag on, Nearby opens on the map
//  (`PlansMapView`, board F1) and Pulse and Connections move into the list
//  under it (F2). With it off, Nearby is exactly the screen above. Plan
//  links and the Host button arrive through `PlansNavigator`.
//

import SwiftUI

public struct NeighborhoodTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var door = NeighborhoodDoorStore.shared
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?
    @State private var plansFlags = PlansFlags.shared
    @State private var plans = PlansNavigator.shared
    @State private var plansPath: [PlansRoute] = []
    @State private var hostRequest: PlansHostRequest?
    /// The plan just posted, opened once the composer has gone.
    @State private var postedPlanId: String?

    public init() {}

    public var body: some View {
        NavigationStack(path: $plansPath) {
            Group {
                if plansFlags.plans {
                    PlansMapView(actions: plansActions)
                } else {
                    NeighborhoodView(
                        onOpenSurface: { surface in
                            presentedSurface = surface
                        },
                        onClaimPlace: {
                            // The claim flow lives in the Place tab's stack — its
                            // hub root carries the add-home / verification CTAs.
                            rootTabs.selected = .place
                        },
                        // Launch cut #1: NeighborhoodView hides the Beacons row.
                        onOpenBeacons: { DeepLinkRouter.shared.handle(path: "/beacons") },
                        onOpenConnections: { DeepLinkRouter.shared.handle(path: "/connections") }
                    )
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: PlansRoute.self) { route in
                PlansDestination(route: route, path: $plansPath) { hostRequest = PlansHostRequest(start: $0) }
            }
        }
        .sheet(item: $presentedSurface) { surface in
            surfaceRoot(surface)
        }
        .fullScreenCover(item: $hostRequest, onDismiss: openPostedPlan) { request in
            PlanComposerRoot(start: request.start) { posted in
                postedPlanId = posted
                hostRequest = nil
            }
        }
        .onChange(of: plans.pending) { _, _ in consumePlansHandOff() }
        .onChange(of: plans.pendingHost) { _, _ in consumePlansHandOff() }
        .onChange(of: plansFlags.plans) { _, isOn in
            // Plans switched off: back to today's Nearby, nothing of Plans left open.
            if !isOn {
                plansPath = []
                hostRequest = nil
            }
        }
        .onChange(of: door.pendingSurface) { _, pending in
            presentPendingSurfaceIfNeeded(pending)
        }
        .onChange(of: rootTabs.selected) { _, selected in
            // A deep link owned by another tab (profile, Beacon,
            // notifications, conversation) selects that tab underneath the
            // presented surface sheet; dismiss the sheet so the destination
            // is actually visible instead of rendering behind it.
            if selected != .nearby { presentedSurface = nil }
            consumePlansHandOff()
        }
        .task {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
            consumePlansHandOff()
        }
        .onAppear {
            presentPendingSurfaceIfNeeded(door.pendingSurface)
            consumePlansHandOff()
        }
    }

    /// "See your plan" (H8): pushed after the composer is gone, since a screen
    /// pushed under a full-screen cover never learns it came on screen.
    private func openPostedPlan() {
        if let id = postedPlanId {
            postedPlanId = nil
            plansPath = [.plan(id: id, intent: .view)]
        }
        consumePlansHandOff()
    }

    /// What the Plans map can open.
    private var plansActions: PlansMapActions {
        PlansMapActions(
            openPlan: { card, id, intent in
                if let card { PlansStoreReads.seed(card) }
                plansPath.append(.plan(id: id, intent: intent))
            },
            host: { start in hostRequest = PlansHostRequest(start: start) },
            openPulse: { presentedSurface = .pulse },
            openConnections: { DeepLinkRouter.shared.handle(path: "/connections") }
        )
    }

    /// A plan link, a push or a Today card asked for a Plans screen.
    private func consumePlansHandOff() {
        guard rootTabs.selected == .nearby, plansFlags.plans,
              plans.pending != nil || plans.pendingHost != nil else { return }
        // Only a plan closes the surface sheet: a feed or post link that just
        // opened Pulse from the door keeps it (it closed on October 13).
        presentedSurface = nil
        // Not under the composer: it waits until the composer is gone.
        if let route = plans.pending, hostRequest == nil {
            plans.pending = nil
            plansPath = [route]
        }
        if let request = plans.pendingHost {
            plans.pendingHost = nil
            hostRequest = request
        }
    }

    private func presentPendingSurfaceIfNeeded(_ pending: NeighborhoodDoorStore.Surface?) {
        guard let pending, rootTabs.selected == .nearby else { return }
        // Launch cuts #3/#4: a hidden surface never opens; the door stays.
        if pending.isAvailableAtLaunch { presentedSurface = pending }
        door.pendingSurface = nil
    }

    /// The original tab roots, unchanged — each brings its own
    /// NavigationStack and consumes its own deep-link destinations.
    @ViewBuilder
    private func surfaceRoot(_ surface: NeighborhoodDoorStore.Surface) -> some View {
        switch surface {
        case .pulse:
            // Labeled: as a trailing closure it would be `onAddHome`.
            // swiftlint:disable:next trailing_closure
            PulseTabRoot(onClose: { presentedSurface = nil })
        case .tasks:
            TasksTabRoot { presentedSurface = nil }
        case .marketplace:
            MarketplaceTabRoot { presentedSurface = nil }
        }
    }
}
