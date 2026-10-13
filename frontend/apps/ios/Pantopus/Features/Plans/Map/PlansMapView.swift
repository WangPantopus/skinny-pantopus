//
//  PlansMapView.swift
//  Pantopus
//
//  Nearby on the map (board F1), when the `plans` flag is on: the MapKit
//  canvas and the three-stop sheet of the Explore map, with the Plans pins,
//  areas and clusters of board P1 and the "you" dot from the system. The
//  sheet holds the list (F2), a tapped pin's card (F3), "Nothing planned
//  yet" (F4) and "See plans near you" (F5).
//

import MapKit
import SwiftUI

struct PlansMapView: View {
    @State private var viewModel: PlansMapViewModel
    @State private var camera: MapCameraPosition = .automatic
    @State private var dragOffset: CGFloat = 0
    @State private var showsAreaPicker = false
    /// When a pin was last tapped: the same touch also reaches the map's own
    /// tap (which clears a selection) and must not undo the pin's.
    @State private var pinTappedAt: Date?
    @State private var flags = PlansFlags.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let actions: PlansMapActions

    init(viewModel: PlansMapViewModel = PlansMapViewModel(), actions: PlansMapActions) {
        _viewModel = State(initialValue: viewModel)
        self.actions = actions
    }

    var body: some View {
        GeometryReader { geo in
            let height = geo.size.height
            let bottomInset = geo.safeAreaInsets.bottom
            let sheetHeight = max(140, height * viewModel.sheetStop.fraction - dragOffset) + bottomInset
            ZStack(alignment: .top) {
                mapLayer
                // The list pulled all the way up covers the map: its chrome steps aside (F2).
                if viewModel.sheetStop != .full {
                    PlansMapTopBar(
                        viewModel: viewModel,
                        showsPlaydates: flags.playdates && viewModel.showsPlaydateFilter
                    ) { showsAreaPicker = true }
                        .transition(.opacity)
                }
                if showsHostButton {
                    PlansHostButton { actions.host(nil) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(.trailing, Spacing.s4)
                        .padding(.bottom, sheetHeight + 18)
                        .transition(.opacity)
                }
                sheet(height: sheetHeight, screenHeight: height, bottomInset: bottomInset)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.start() }
        .refreshesOnStoreChange(affects: PlansStoreReads.affects) { await viewModel.start() }
        .onChange(of: viewModel.recenterRequest) { _, _ in recenter() }
        .onChange(of: viewModel.widenRequest) { _, _ in widen() }
        .sheet(isPresented: $showsAreaPicker) {
            PlansAreaPicker(viewModel: viewModel) { showsAreaPicker = false }
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.Color.appSurface)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansMap")
    }

    private var showsHostButton: Bool {
        viewModel.phase == .ready && viewModel.selectedId == nil && viewModel.sheetStop == .peek && !viewModel.isEmpty
    }

    // MARK: - Map

    private var mapLayer: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom]) {
            UserAnnotation()
            ForEach(areas, id: \.id) { area in
                MapCircle(center: area.coordinate, radius: area.radius)
                    .foregroundStyle(area.kind.color.opacity(0.2))
            }
            ForEach(viewModel.markers) { marker in
                switch marker {
                case let .pin(pin):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        pinButton(pin)
                    }
                    .annotationTitles(.hidden)
                case let .fan(pins):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        // Plans sharing one point sit side by side, the point between them.
                        HStack(spacing: PlansClustering.fanStep - PlanPinView.width) {
                            ForEach(pins) { pin in
                                pinButton(pin).zIndex(pin.id == viewModel.selectedId ? 1 : 0)
                            }
                        }
                    }
                    .annotationTitles(.hidden)
                case let .cluster(cluster):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        Button { zoom(to: cluster) } label: {
                            PlanClusterView(count: cluster.count, kinds: cluster.kinds, badge: cluster.badge)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(PlansPinSpeech.label(for: cluster))
                        .accessibilityHint("Zooms in")
                    }
                    .annotationTitles(.hidden)
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .saturation(dimsMap ? 0.7 : 1)
        .opacity(dimsMap ? 0.85 : 1)
        .onMapCameraChange(frequency: .onEnd) { context in
            viewModel.cameraChanged(context.region)
        }
        .onTapGesture {
            if let pinTappedAt, Date().timeIntervalSince(pinTappedAt) < 0.5 { return }
            if viewModel.selectedId != nil { withSheetAnimation { viewModel.clearSelection() } }
        }
    }

    /// F4 and F5 dim the map under their sheet.
    private var dimsMap: Bool {
        viewModel.phase == .needsLocation || viewModel.isEmpty
    }

    /// The area under the selected pin (about 500 m), and every playdate's
    /// neighborhood (about 1 km), which playdates always show.
    private var areas: [PlansArea] {
        viewModel.pins.compactMap { pin in
            guard viewModel.kindFilter == nil || pin.kind == viewModel.kindFilter else { return nil }
            let isSelected = pin.id == viewModel.selectedId
            guard isSelected || (pin.kind == .playdate && !pin.isExactPoint) else { return nil }
            return PlansArea(
                id: pin.id,
                kind: pin.kind,
                coordinate: CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude),
                radius: pin.kind == .playdate && !pin.isExactPoint ? 500 : 250
            )
        }
    }

    private func look(for pin: PlanPinDTO) -> PlanPinLook {
        let selected = pin.id == viewModel.selectedId
        let badge: PlanPinLook.Badge? = if pin.isHosting {
            .hosting
        } else if pin.isIn {
            .going
        } else if pin.viewerRequestStatus == .pending || pin.viewerRequestStatus == .waitlisted {
            .waiting
        } else {
            nil
        }
        let calendar = PlanFormat.calendar(for: pin.timezone ?? card(for: pin.id)?.timezone)
        return PlanPinLook(
            kind: pin.kind,
            tag: pin.isHosting && selected ? "Your plan" : PlanFormat.pinTag(
                state: pin.state,
                isFull: pin.isFull && !pin.isIn && !pin.isHosting,
                startsAt: pin.startsAtDate,
                dayPart: pin.dayPart,
                calendar: calendar
            ),
            isSelected: selected,
            isDimmed: viewModel.selectedId != nil && !selected,
            isFull: pin.isFull && !pin.isIn && !pin.isHosting,
            isLive: pin.state == .live,
            badge: badge
        )
    }

    private func pinButton(_ pin: PlanPinDTO) -> some View {
        Button { select(pin) } label: {
            PlanPinView(look: look(for: pin))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(PlansPinSpeech.label(for: pin, card: card(for: pin.id), center: viewModel.center))
        .accessibilityHint("Opens the plan's card")
        .accessibilityIdentifier("planPin.\(pin.id)")
    }

    private func card(for id: String) -> PlanCardDTO? {
        viewModel.cards.first { $0.id == id } ?? viewModel.yourPlans.first { $0.id == id }
    }

    private func select(_ pin: PlanPinDTO) {
        pinTappedAt = Date()
        withSheetAnimation { viewModel.select(pin) }
        // Keep the pin above the half-open sheet: center the camera below it.
        let span = viewModel.lastRegion?.span ?? MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: pin.latitude - span.latitudeDelta * 0.22, longitude: pin.longitude),
                span: span
            ))
        }
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

    /// About 15 miles across, so plans in the next town show.
    private func widen() {
        guard let center = viewModel.center else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.4)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                span: MKCoordinateSpan(latitudeDelta: 0.32, longitudeDelta: 0.32)
            ))
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

    // MARK: - Sheet

    private func sheet(height: CGFloat, screenHeight: CGFloat, bottomInset: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            VStack(spacing: 0) {
                Capsule()
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 36, height: 5)
                    .padding(.top, Spacing.s2)
                    .padding(.bottom, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { cycleStop() }
                    // The grab handle always moves the sheet.
                    .gesture(sheetDrag(screenHeight: screenHeight))
                    .accessibilityElement()
                    .accessibilityLabel("Plans list")
                    .accessibilityValue(stopName)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction(named: "Show more") { setStop(.full) }
                    .accessibilityAction(named: "Show less") { setStop(.peek) }
                PlansSheetContent(viewModel: viewModel, actions: actions, onStop: setStop)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .padding(.bottom, bottomInset)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(
                UnevenRoundedRectangle(topLeadingRadius: Radii.xl3, topTrailingRadius: Radii.xl3, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: -6)
            )
            // At its lowest stop the whole sheet drags; once open, its list
            // scrolls and only the handle moves the sheet.
            .gesture(sheetDrag(screenHeight: screenHeight), including: viewModel.sheetStop == .peek ? .all : .subviews)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansSheet")
    }

    private func sheetDrag(screenHeight: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                dragOffset = value.translation.height
            }
            .onEnded { value in
                let projected = screenHeight * viewModel.sheetStop.fraction - value.predictedEndTranslation.height
                let fraction = projected / max(screenHeight, 1)
                let target = PlansSheetStop.allCases.min { abs($0.fraction - fraction) < abs($1.fraction - fraction) } ?? .peek
                withSheetAnimation {
                    dragOffset = 0
                    viewModel.sheetStop = target
                }
            }
    }

    private func setStop(_ stop: PlansSheetStop) {
        withSheetAnimation { viewModel.sheetStop = stop }
    }

    private func cycleStop() {
        setStop(viewModel.sheetStop == .full ? .peek : .full)
    }

    private var stopName: String {
        switch viewModel.sheetStop {
        case .peek: "Collapsed"
        case .half: "Half open"
        case .full: "Open"
        }
    }

    /// Board P3: a spring of about 0.35 s; a crossfade under Reduce Motion.
    private func withSheetAnimation(_ change: () -> Void) {
        withAnimation(reduceMotion ? .easeInOut(duration: 0.15) : .spring(response: 0.35, dampingFraction: 0.86), change)
    }
}

/// Why a plan opens: to read it, straight to "Ask to join" (J3), or into its chat.
enum PlanOpenIntent: Hashable {
    case view, ask, chat
}

/// The actions the map hands to the Nearby stack.
struct PlansMapActions {
    /// Open a plan (J1 and the screens after it), from its card when one is on screen.
    let openPlan: @MainActor (PlanCardDTO?, String, PlanOpenIntent) -> Void
    /// Start hosting, optionally with a kind (and a game) chosen.
    let host: @MainActor (PlansHostStart?) -> Void
    /// "More nearby": Pulse.
    let openPulse: @MainActor () -> Void
    /// "More nearby": Connections.
    let openConnections: @MainActor () -> Void
}

/// Where the composer starts: a kind, and for a watch party maybe a game.
struct PlansHostStart: Hashable {
    let kind: PlanKind
    var game: PlanGameOptionDTO?
    /// A5 "Host again": the earlier plan, a week later.
    var again: PlanDetailDTO?
}

/// An area circle on the map.
private struct PlansArea {
    let id: String
    let kind: PlanKind
    let coordinate: CLLocationCoordinate2D
    let radius: CLLocationDistance
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
            parts.append(PlanFormat.dayPart(pin.dayPart).lowercased())
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
