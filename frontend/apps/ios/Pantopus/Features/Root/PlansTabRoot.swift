//
//  PlansTabRoot.swift
//  Pantopus
//
//  The Plans tab (Pulse S3), present only while the `plans` switch is on
//  (`RootTabView` adds and removes it at runtime). The same Plans screens
//  the Nearby tab used to open on: the map (board F1) with its list sheet
//  (F2), the plan screens pushed on this stack, and the host composer as a
//  full-screen cover. Plan links, pushes and Today's plan cards arrive
//  through `PlansNavigator`.
//

import SwiftUI

public struct PlansTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var plansFlags = PlansFlags.shared
    @State private var plans = PlansNavigator.shared
    @State private var plansPath: [PlansRoute] = []
    @State private var hostRequest: PlansHostRequest?
    /// The plan just posted, opened once the composer has gone.
    @State private var postedPlanId: String?

    public init() {}

    public var body: some View {
        NavigationStack(path: $plansPath) {
            PlansMapView(actions: plansActions)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: PlansRoute.self) { route in
                    PlansDestination(route: route, path: $plansPath) { hostRequest = PlansHostRequest(start: $0) }
                }
        }
        .accessibilityIdentifier("plansTabRoot")
        .fullScreenCover(item: $hostRequest, onDismiss: openPostedPlan) { request in
            PlanComposerRoot(start: request.start) { posted in
                postedPlanId = posted
                hostRequest = nil
            }
        }
        .onChange(of: plans.pending) { _, _ in consumePlansHandOff() }
        .onChange(of: plans.pendingHost) { _, _ in consumePlansHandOff() }
        .onChange(of: plansFlags.plans) { _, isOn in
            // Plans switched off: nothing of Plans is left open (the bar drops this tab).
            if !isOn {
                plansPath = []
                hostRequest = nil
            }
        }
        .onChange(of: rootTabs.selected) { _, _ in consumePlansHandOff() }
        .task { consumePlansHandOff() }
        .onAppear { consumePlansHandOff() }
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
            openPulse: { rootTabs.selected = .pulse },
            openConnections: { DeepLinkRouter.shared.handle(path: "/connections") }
        )
    }

    /// A plan link, a push or a Today card asked for a Plans screen.
    private func consumePlansHandOff() {
        guard rootTabs.selected == .plans, plansFlags.plans else { return }
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
}
