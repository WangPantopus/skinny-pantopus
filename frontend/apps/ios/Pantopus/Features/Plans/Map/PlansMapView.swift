//
//  PlansMapView.swift
//  Pantopus
//
//  Nearby on the map (board F1), when the `plans` flag is on: the map
//  (`PlansMapCanvas`: the pins, areas and clusters of board P1 and the "you"
//  dot), full screen under the floating chrome, and the three-stop sheet
//  (`PlansMapSheet`). The sheet holds the list (F2), a tapped pin's card
//  (F3), "Nothing planned yet" (F4) and "See plans near you" (F5). On a
//  wide screen (the iPhone Duo open, held sideways) the Plans tab shows the
//  list in a column beside the map instead (`PlansListColumn`,
//  `PlansMapBeside`).
//

import MapKit
import SwiftUI

struct PlansMapView: View {
    @State private var viewModel: PlansMapViewModel
    /// The finger on the sheet. It stays out of this view's state, so a drag frame never redraws the map.
    @State private var drag: PlansSheetDrag
    @State private var camera: MapCameraPosition = .automatic
    /// The area pill and chips' height: the sheet's full stop sits under them, and the first look keeps pins out from under them.
    @State private var chromeHeight: CGFloat = 0
    @State private var flags = PlansFlags.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let actions: PlansMapActions

    /// The Plans tab holds `viewModel`, so a new layout of this screen keeps its plans, filters and selection.
    init(viewModel: PlansMapViewModel, actions: PlansMapActions) {
        _viewModel = State(initialValue: viewModel)
        _drag = State(initialValue: PlansSheetDrag(viewModel: viewModel))
        self.actions = actions
    }

    var body: some View {
        GeometryReader { geo in
            let bottomInset = geo.safeAreaInsets.bottom
            let screen = PlansSheetLayout(height: geo.size.height + bottomInset, bottomInset: bottomInset, chromeBottom: chromeHeight)
            // The map runs under the status bar and the tab bar: the whole screen.
            let mapSize = CGSize(width: geo.size.width, height: geo.safeAreaInsets.top + screen.height)
            ZStack(alignment: .top) {
                mapLayer
                // The chrome stays at every stop: the sheet pulled all the way up stops under it (F2).
                PlansMapTopBar(
                    viewModel: viewModel,
                    showsPlaydates: flags.playdates && viewModel.showsPlaydateFilter,
                    onAsk: actions.ask,
                    onAreaTap: actions.areaPicker
                )
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { chromeHeight = $0 }
            }
            .ignoresSafeArea(edges: .bottom)
            // Over the map and the chrome, but not in their stack: a child taller than the safe area
            // (the sheet at full) pushed the whole stack down, the map with it.
            .overlay(alignment: .bottom) {
                PlansMapSheet(viewModel: viewModel, drag: drag, screen: screen, actions: actions, onStop: setStop)
                    .ignoresSafeArea(edges: .bottom)
            }
            .onChange(of: mapSize.height, initial: true) { _, mapHeight in
                if abs(viewModel.mapPoints - mapHeight) > 1 { viewModel.mapPoints = mapHeight }
            }
            .onChange(of: viewModel.fitRequest) { _, _ in
                fitPlans(mapSize: mapSize, topInset: geo.safeAreaInsets.top)
            }
            .onChange(of: viewModel.widenRequest) { _, _ in
                widen(mapSize: mapSize, topInset: geo.safeAreaInsets.top)
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.start() }
        .refreshesOnStoreChange(affects: { PlansStoreReads.affects($0) }, perform: { await viewModel.start() })
        .onChange(of: viewModel.recenterRequest) { _, _ in recenter() }
        .onChange(of: reduceMotion, initial: true) { _, reduce in drag.reduceMotion = reduce }
        .onAppear(perform: restoreCamera)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansMap")
    }

    // MARK: - Map

    private var mapLayer: some View {
        PlansMapCanvas(
            viewModel: viewModel,
            camera: $camera,
            selectedId: viewModel.selectedId,
            pinHint: "Opens the plan's card",
            onPin: select,
            onCluster: zoom(to:)
        ) {
            if viewModel.selectedId != nil { withSheetAnimation { viewModel.clearSelection() } }
        }
    }

    private func select(_ pin: PlanPinDTO) {
        withSheetAnimation { viewModel.select(pin) }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { showAboveCard(pin) }
    }

    /// Keep the pin above the half-open sheet: center the camera below it.
    private func showAboveCard(_ pin: PlanPinDTO) {
        let span = viewModel.lastRegion?.span ?? MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
        camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: pin.latitude - span.latitudeDelta * 0.22, longitude: pin.longitude),
            span: span
        ))
    }

    private func zoom(to cluster: PlansCluster) {
        // More plans on one point than fit side by side: the list shows them.
        if cluster.isOnePoint, cluster.count > PlansClustering.fanLimit {
            setStop(.full)
            return
        }
        let span = PlansClustering.span(toOpen: cluster)
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(
                // A little south, so the pins land above the sheet, not under it.
                center: CLLocationCoordinate2D(latitude: cluster.latitude - span * 0.2, longitude: cluster.longitude),
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            ))
        }
    }

    /// F4 "Show": the sheet goes down, and the map out far enough that the
    /// town with plans, `miles` away in a direction we don't know, fits in the
    /// open map above it.
    private func widen(mapSize: CGSize, topInset: CGFloat) {
        guard let center = viewModel.center else { return }
        setStop(.peek)
        // A margin, so the town's pins sit inside the edge, not on it.
        let miles = Double(viewModel.nearestElsewhere?.miles ?? 8) * 1.25 + 2
        let latitude = miles / 69
        let longitude = miles / (69 * max(cos(center.latitude * .pi / 180), 0.2))
        let points = [
            CLLocationCoordinate2D(latitude: center.latitude + latitude, longitude: center.longitude),
            CLLocationCoordinate2D(latitude: center.latitude - latitude, longitude: center.longitude),
            CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude + longitude),
            CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude - longitude)
        ]
        let window = openMap(mapSize: mapSize, topInset: topInset)
        guard let region = PlansCameraFit.region(showing: points, in: window, mapSize: mapSize) else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.4)) { camera = .region(region) }
    }

    /// A map made again for the same plans (a new layout of this screen) opens where the last one was left, at its
    /// zoom, instead of on its own first look; with a pin selected (its card in the sheet), with that pin above the card.
    private func restoreCamera() {
        guard camera == .automatic else { return }
        if let id = viewModel.selectedId, let pin = viewModel.pin(for: id) {
            showAboveCard(pin)
        } else if let last = viewModel.lastCamera {
            camera = .camera(last)
        }
    }

    private func recenter() {
        guard let center = viewModel.center else { return }
        // About 5 miles across, a little south so the center sits above the sheet.
        camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: center.latitude - 0.012, longitude: center.longitude),
            span: MKCoordinateSpan(latitudeDelta: 0.07, longitudeDelta: 0.07)
        ))
    }

    /// F1's first look: you and the plans around you, in the open map between
    /// the area pill and chips and the list, so no pin opens under them or off the edge.
    private func fitPlans(mapSize: CGSize, topInset: CGFloat) {
        guard let center = viewModel.center, viewModel.selectedId == nil else { return }
        let plans = viewModel.pins.filter { viewModel.kindFilter == nil || $0.kind == viewModel.kindFilter }
        guard !plans.isEmpty else { return }
        let points = plans.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
            + [CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude)]
        let window = openMap(mapSize: mapSize, topInset: topInset)
        guard let region = PlansCameraFit.region(showing: points, in: window, mapSize: mapSize) else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) { camera = .region(region) }
    }

    /// The map between the chrome and the sheet at its lowest stop, clear of
    /// the Host button, in the map's own coordinates (it starts under the
    /// status bar). A pin's head stands about 44 pt above its point and its tag hangs under it.
    private func openMap(mapSize: CGSize, topInset: CGFloat) -> CGRect {
        let top = topInset + chromeHeight + 48
        let bottom = topInset + drag.layout.peekTop - 80
        return CGRect(x: 32, y: top, width: mapSize.width - 64, height: bottom - top)
    }

    // MARK: - Sheet

    private func setStop(_ stop: PlansSheetStop) {
        withSheetAnimation { viewModel.sheetStop = stop }
    }

    /// Board P3: a spring of about 0.35 s; a crossfade under Reduce Motion.
    private func withSheetAnimation(_ change: () -> Void) {
        withAnimation(reduceMotion ? .easeInOut(duration: 0.15) : .spring(response: 0.35, dampingFraction: 0.86), change)
    }
}

/// Why a plan opens: to read it, straight to "Ask to join" (J3), or into its chat.
enum PlanOpenIntent: Hashable {
    case view, ask, chat
    /// Opened from an email or text invitation: the plan opens it for this account first.
    case invite(token: String)
}

/// The actions the map hands to the Plans tab's stack.
struct PlansMapActions {
    /// Open a plan (J1 and the screens after it), from its card when one is on screen.
    let openPlan: @MainActor (PlanCardDTO?, String, PlanOpenIntent) -> Void
    /// Start hosting, optionally with a kind (and a game) chosen.
    let host: @MainActor (PlansHostStart?) -> Void
    /// "Area and time" (the area pill), the sheet over the tab.
    let areaPicker: @MainActor () -> Void
    /// "More nearby": Pulse. Nil drops the "More nearby" rows (the Pulse
    /// redesign is off, and the Nearby tab beside Plans has them).
    var openPulse: (@MainActor () -> Void)?
    /// "More nearby": Connections.
    var openConnections: (@MainActor () -> Void)?
    /// "Ask Pantopus" about plans (the header's trailing button), the assistant over the tab.
    var ask: (@MainActor () -> Void)?
}

/// Where the composer starts: a kind, and for a watch party maybe a game.
struct PlansHostStart: Hashable {
    let kind: PlanKind
    var game: PlanGameOptionDTO?
    /// A5 "Host again": the earlier plan, a week later.
    var again: PlanDetailDTO?
}

/// The region that shows some points inside a window of the map (a rect in
/// the map's own coordinates; the map frames a region in its whole size).
/// One scale for both axes: at these sizes the map is conformal.
enum PlansCameraFit {
    /// At least about 2 miles across the window, so one plan next door isn't street level.
    static let minimumMiles = 2.0

    static func region(showing points: [CLLocationCoordinate2D], in window: CGRect, mapSize: CGSize) -> MKCoordinateRegion? {
        guard window.width > 40, window.height > 40, mapSize.width > 0, mapSize.height > 0,
              let south = points.map(\.latitude).min(), let north = points.map(\.latitude).max(),
              let west = points.map(\.longitude).min(), let east = points.map(\.longitude).max()
        else { return nil }
        let middleLatitude = (south + north) / 2
        let cosine = max(cos(middleLatitude * .pi / 180), 0.2)
        // Degrees of longitude per point: whichever axis needs more.
        let perPoint = max(
            (east - west) / window.width,
            (north - south) / cosine / window.height,
            minimumMiles / (69 * cosine) / window.width
        )
        let latitudePerPoint = perPoint * cosine
        // The window's middle shows the points' middle.
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: middleLatitude + (window.midY - mapSize.height / 2) * latitudePerPoint,
                longitude: (west + east) / 2 - (window.midX - mapSize.width / 2) * perPoint
            ),
            span: MKCoordinateSpan(latitudeDelta: latitudePerPoint * mapSize.height, longitudeDelta: perPoint * mapSize.width)
        )
    }
}

/// What VoiceOver reads for a pin: "Watch party, Sunday 1:25 PM, about 1 mile, 3 spots left".
enum PlansPinSpeech {
    /// "3 plans here, one you're in".
    static func label(for cluster: PlansCluster) -> String {
        let yours: String? = switch cluster.badge {
        case .hosting: "one you're hosting"
        case .going: "one you're in"
        case .waiting: "one you asked to join"
        case nil: nil
        }
        return ["\(cluster.count) plans here", yours].compactMap { $0 }.joined(separator: ", ")
    }

    static func label(for pin: PlanPinDTO, card: PlanCardDTO?, center: UserCoordinate?) -> String {
        var parts = [pin.kind.spokenTitle]
        if pin.state == .live {
            parts.append("happening now")
        } else if let start = pin.startsAtDate {
            parts.append(PlanFormat.spokenWhen(start, calendar: PlanFormat.calendar(for: pin.timezone ?? card?.timezone)))
        } else {
            // A playdate whose time is hidden: "Saturday morning", as its card says it (as on Android).
            let calendar = PlanFormat.calendar(for: pin.timezone ?? card?.timezone)
            parts.append(PlanFormat.dayPartPhrase(pin.dayPart, day: pin.startsOnDate, calendar: calendar))
        }
        let band = pin.distanceBand ?? card?.distanceBand ?? center.map {
            PlanFormat.band(meters: CLLocation(latitude: $0.latitude, longitude: $0.longitude)
                .distance(from: CLLocation(latitude: pin.latitude, longitude: pin.longitude)))
        }
        if let spoken = PlanFormat.spokenDistance(band) { parts.append(spoken) }
        parts.append(pin.isFull ? "full" : "\(pin.spotsLeft) spot\(pin.spotsLeft == 1 ? "" : "s") left")
        if pin.isHosting {
            parts.append("you're hosting")
        } else if pin.isIn {
            parts.append("you're in")
        } else if pin.viewerRequestStatus == .pending {
            parts.append("requested")
        } else if pin.viewerRequestStatus == .waitlisted {
            parts.append("on the waitlist")
        }
        return parts.joined(separator: ", ")
    }
}
