//
//  PlansTabRoot.swift
//  Pantopus
//
//  The Plans tab (Pulse S3; with the Pulse redesign off too, founder decision
//  2026-10-17), present only while the `plans` switch is on (`RootTabView`
//  adds and removes it at runtime). The same Plans screens the Nearby tab
//  used to open on: the map (board F1) with its list sheet (F2), the plan
//  screens pushed on this stack, and the host composer as a full-screen
//  cover. Plan links, pushes and Today's plan cards arrive through
//  `PlansNavigator`. With the redesign off, the list has no "More nearby"
//  rows: Pulse and Connections are on the Nearby tab beside it.
//
//  The map's plans, filters, selection and camera, and the sheets over it
//  (Area and time, the assistant), are held here, above the screen that
//  shows them, so a new layout for the same screen (the iPhone Duo folded or
//  unfolded) starts where the last one was.
//
//  On a wide screen (the iPhone Duo open, held sideways or half folded like
//  a book; founder approved the drawing 2026-11-04) the list is a column
//  beside the map (`PlansListColumn`, `PlansMapBeside`) and a plan opens in
//  the column, the map keeping its place beside it. The column is this same
//  stack, so a fold keeps the plan open and every sheet over it; folded, or
//  upright (too narrow for the column beside a map), it is the map and
//  sheet again.
//

import SwiftUI

public struct PlansTabRoot: View {
    @Environment(RootTabModel.self) private var rootTabs
    /// Regular width (the iPhone Duo open) puts the list beside the map, where the screen is wide enough.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var plansFlags = PlansFlags.shared
    @State private var plans = PlansNavigator.shared
    @State private var plansPath: [PlansRoute] = []
    @State private var hostRequest: PlansHostRequest?
    /// The plan just posted, opened once the composer has gone.
    @State private var postedPlanId: String?
    @State private var map = PlansMapViewModel()
    @State private var showsAreaPicker = false
    /// The assistant, opened from the map's header about plans.
    @State private var askTopic: AIAskTopic?
    /// Whether the list was last laid out beside the map.
    @State private var listBesideMap = false

    public init() {}

    public var body: some View {
        // Read in layout, so the first pass already picks the map and sheet or the two columns.
        GeometryReader { proxy in
            let beside = isSideBySide(width: proxy.size.width)
            HStack(spacing: 0) {
                NavigationStack(path: $plansPath) {
                    plansRoot(beside: beside)
                        .ignoresSafeArea(.container, edges: columnIgnores(beside: beside))
                        .toolbar(.hidden, for: .navigationBar)
                        .swipesBackFromEdge()
                        .navigationDestination(for: PlansRoute.self) { route in
                            // The map fills a wide screen; the plan pages keep a readable column.
                            PlansDestination(route: route, path: $plansPath) { hostRequest = PlansHostRequest(start: $0) }
                                .readableColumn()
                                .ignoresSafeArea(.container, edges: columnIgnores(beside: beside))
                        }
                }
                .environment(\.plansListBesideMap, beside)
                .frame(width: beside ? SideBySideColumnWidth.nearby.ideal : nil)
                if beside {
                    PlansMapBeside(viewModel: map, selectedId: planBesideMap, onOpen: openFromMap)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(Theme.Color.appBorder).frame(width: 1).ignoresSafeArea()
                        }
                }
            }
            .onChange(of: beside, initial: true) { _, beside in
                listBesideMap = beside
                if beside { openSelectedPlan() }
            }
        }
        .accessibilityIdentifier("plansTabRoot")
        .onChange(of: plansPath) { _, path in
            // Back to the list beside the map: no plan is selected there.
            if listBesideMap, path.isEmpty, map.selectedId != nil { map.clearSelection() }
        }
        .sheet(isPresented: $showsAreaPicker) {
            PlansAreaPicker(viewModel: map) { showsAreaPicker = false }
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.Color.appSurface)
        }
        .askPantopus($askTopic)
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
                showsAreaPicker = false
                askTopic = nil
            }
        }
        .onChange(of: rootTabs.selected) { _, _ in consumePlansHandOff() }
        .task { consumePlansHandOff() }
        .onAppear { consumePlansHandOff() }
    }

    /// The stack's first screen: the list beside the map, or the map with the list in its sheet.
    @ViewBuilder
    private func plansRoot(beside: Bool) -> some View {
        if beside {
            PlansListColumn(viewModel: map, actions: plansActions)
        } else {
            PlansMapView(viewModel: map, actions: plansActions)
        }
    }

    /// Two columns: regular width, with room for the phone-width column beside the narrowest iPhone's width (as
    /// the Nearby tab decides). Upright, the open iPhone Duo (669 pt) keeps the map and its sheet.
    private func isSideBySide(width: CGFloat) -> Bool {
        horizontalSizeClass == .regular && SideBySideColumnWidth.nearby.fitsBeside(in: width)
    }

    /// Beside the map the column is in the screen's middle, so the side tab bar's inset on the screen's trailing
    /// edge isn't its own. Under the system tab bar (Mail off) it reached the column's screens anyway and left them
    /// 84 pt short of the column's edge.
    private func columnIgnores(beside: Bool) -> Edge.Set {
        beside ? .trailing : []
    }

    /// The plan shown selected on the map beside the list: the one open in the column, else the pin tapped.
    private var planBesideMap: String? {
        for route in plansPath.reversed() {
            if case let .plan(id, _) = route { return id }
        }
        return map.selectedId
    }

    /// A pin tapped on the map beside the list opens its plan in the column, in place of one open there. It stays
    /// selected too, so folded the stack's plan closes back to that pin's card, as on a phone.
    private func openFromMap(_ pin: PlanPinDTO) {
        map.select(pin)
        if let card = map.selectedCard { PlansStoreReads.seed(card) }
        let route = PlansRoute.plan(id: pin.id, intent: .view)
        guard plansPath != [route] else { return }
        if plansPath.isEmpty {
            plansPath = [route]
        } else {
            replacePath(with: [route])
        }
    }

    /// Unfolded with a pin's card open: its plan opens in the column.
    private func openSelectedPlan() {
        guard plansPath.isEmpty, let id = map.selectedId else { return }
        if let card = map.selectedCard { PlansStoreReads.seed(card) }
        replacePath(with: [.plan(id: id, intent: .view)])
    }

    /// Another plan in place of the one open, with no push or pop.
    private func replacePath(with routes: [PlansRoute]) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { plansPath = routes }
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
        var actions = PlansMapActions(
            openPlan: { card, id, intent in
                if let card { PlansStoreReads.seed(card) }
                plansPath.append(.plan(id: id, intent: intent))
            },
            host: { start in hostRequest = PlansHostRequest(start: start) },
            areaPicker: { showsAreaPicker = true }
        )
        actions.ask = { askTopic = .plans() }
        if LaunchFeatures.pulseRedesign {
            actions.openPulse = { rootTabs.selected = .pulse }
            actions.openConnections = { DeepLinkRouter.shared.handle(path: "/connections") }
        }
        return actions
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
