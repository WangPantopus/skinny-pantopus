//
//  MomentsMapView.swift
//  Pantopus
//
//  The Moments tab's map (boards M1, M2, M3 and P5): rings where Moments
//  were posted, bubbles for crowded spots, your own ring while a Moment
//  posts, and over the map ☰, the area pill and the chat button at the top,
//  "Show my location" and + on the right, and the strip ("8 new near you",
//  Play all, the faces) or the empty card at the bottom.
//

import MapKit
import SwiftUI

/// What the map hands to the Moments tab.
struct MomentsMapActions {
    /// Watch: these rings in this order, starting at one.
    let watch: @MainActor (_ rings: [MomentRingDTO], _ start: Int, _ newOnly: Bool) -> Void
    /// + and "Add a Moment".
    let compose: @MainActor () -> Void
    /// The area pill: where the map is.
    let areaPicker: @MainActor () -> Void
}

struct MomentsMapView: View {
    @State var viewModel: MomentsMapViewModel
    @State var camera: MapCameraPosition = .automatic
    @State var uploads = MomentsUploader.shared
    /// Open sideways (iPhone Duo): the camera from before a card opened beside the map, put back when it closes.
    @State var cameraBeforeCard: MapCamera?
    /// Where on screen the camera's center lands (the middle of the map's own safe area), read when it settles.
    @State var cameraAnchor: CGPoint?
    /// Open sideways: the part of the left half the top row, the Home indicator and the keyboard leave clear.
    @State var clearBand: CGRect = .zero
    /// A card opened before the camera had settled once: it glides to its ring when it does.
    @State var glidePending = false
    /// A crowded spot waits to go back beside its list (a fold opened the Duo sideways).
    @State var spotPending = false
    /// The map's size when `cameraAnchor` was read: after a fold it's stale until the camera settles again.
    @State var anchorSize: CGSize = .zero
    /// The iPhone Duo: how tall the card at the bottom left is (open, the pill or the empty, location or load-failed
    /// card; closed, the strip or one of those cards). MapKit's Legal link sits just above it.
    @State var leftCardHeight: CGFloat = 52
    /// When a ring or a bubble was last tapped: the map's own tap sees that tap too.
    @State private var pinTappedAt = Date.distantPast
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) var colorScheme
    @Environment(AuthManager.self) private var auth
    /// How the iPhone Duo is held (`.phone` on phones), as the Moments tab reads it.
    @Environment(\.momentsDuoScreen) var duo
    let actions: MomentsMapActions
    /// Watching that the open Duo held sideways shows as a card beside the map (board O2); nil otherwise.
    let watching: MomentsWatchSession?
    let viewerHooks: MomentsViewerHooks?

    init(
        viewModel: MomentsMapViewModel,
        actions: MomentsMapActions,
        watching: MomentsWatchSession? = nil,
        viewerHooks: MomentsViewerHooks? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.actions = actions
        self.watching = watching
        self.viewerHooks = viewerHooks
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MapReader { proxy in
                    mapLayer { context in
                        cameraSettled(context, proxy: proxy, clear: clearRect(in: geo))
                    }
                    // Open sideways: the map follows the card's ring, and moves up with the keyboard.
                    .onChange(of: playingRingId) { old, new in cardRingChanged(from: old, to: new, proxy: proxy) }
                    .onChange(of: clearBand) { _, _ in clearBandChanged(proxy: proxy) }
                    .onChange(of: showsSeenByCard) { _, _ in clearBandChanged(proxy: proxy) }
                    .onChange(of: duo.pose) { old, new in poseChanged(from: old, to: new) }
                }
                .ignoresSafeArea()
                MomentsMapTopBar(
                    viewModel: viewModel,
                    width: duo.pose.isOpen ? Self.openRowWidth : nil,
                    top: duo.topRowTop,
                    onArea: actions.areaPicker,
                    onBack: backToArea
                )
            }
            .overlay(alignment: .bottom) {
                if duo.pose.isOpen {
                    MomentsMapOpenBottom(
                        viewModel: viewModel,
                        postings: uploads.postings,
                        actions: actions,
                        hidden: cardOpen
                    ) { leftCardHeight = $0 }
                } else {
                    MomentsMapBottom(
                        viewModel: viewModel,
                        postings: uploads.postings,
                        me: me,
                        actions: actions,
                        onRetry: uploads.retry,
                        onDiscard: uploads.discard,
                        onBottomHeight: closedBottomReporter
                    )
                }
            }
            .overlay { if duo.pose.isWide { cardsBesideMap } }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.start() }
        .task(id: viewModel.phase == .ready) {
            // A Moment ends on the minute; new ones come in while the map is open.
            guard viewModel.phase == .ready else { return }
            var minutes = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                viewModel.tick()
                minutes += 1
                if minutes.isMultiple(of: 2) { await viewModel.load() }
            }
        }
        .onChange(of: viewModel.recenterRequest) { _, _ in recenter() }
        .onChange(of: viewModel.placeRequest) { _, place in showPlace(place) }
        .onChange(of: uploads.finished) { _, _ in
            // "Your Moment is live" while the map shows somewhere else: go to the new ring.
            if let spot = uploads.liveSpot {
                uploads.liveSpot = nil
                bringIntoView(spot)
            }
            Task {
                // The real ring first, then the posting ring makes way: nothing jumps.
                await viewModel.load()
                uploads.clearLive()
            }
        }
        .overlay(alignment: .top) {
            if let note = uploads.liveNote ?? uploads.plainNote {
                MomentsLiveNote(text: note, confirms: uploads.liveNote != nil)
                    // Open sideways it stays on the left half, under the top row, clear of the fold.
                    .frame(maxWidth: duo.pose.isWide ? duo.leftHalf.width : nil)
                    .frame(maxWidth: duo.pose.isWide ? .infinity : nil, alignment: .leading)
                    .padding(.top, (duo.pose.isOpen ? (duo.topRowTop ?? 0) + Self.openRowHeight + 12 : 64) + viewModel.heightsNoteDrop)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: note) {
                        try? await Task.sleep(for: .seconds(4))
                        uploads.liveNote = nil
                        uploads.plainNote = nil
                    }
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: uploads.liveNote ?? uploads.plainNote)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await viewModel.load() } }
        }
        .onAppear(perform: restoreCamera)
        .alert(uploads.notice ?? "", isPresented: Binding(get: { uploads.notice != nil }, set: { if !$0 { uploads.notice = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.map")
    }

    /// You, as your posting ring shows you.
    var me: MomentAuthorDTO? {
        guard case let .signedIn(user) = auth.state else { return nil }
        return MomentAuthorDTO(me: user)
    }

    // MARK: - Map

    /// The top row is this tall, and the strip this tall with its margin: the map keeps what it centers on
    /// between them, so rings don't open underneath either.
    private static let coveredTop = 52.0

    /// The part of the map nothing covers, in the full-screen map's own points. Open (iPhone Duo), under the top row
    /// and above the bottom row; with a card beside the map, the clear part of the left half.
    private func clearRect(in geo: GeometryProxy) -> CGRect {
        if duo.pose.isOpen {
            return openClearRect
        }
        return CGRect(
            x: 0,
            y: geo.safeAreaInsets.top + Self.coveredTop,
            width: geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing,
            height: max(geo.size.height - Self.coveredTop - coveredBottom, 120)
        )
    }

    /// The camera settled: what shows in the clear part is read off the map itself, so the strip lists what
    /// can be seen and rings join bubbles at the same distance on every phone.
    private func cameraSettled(_ context: MapCameraUpdateContext, proxy: MapProxy, clear: CGRect) {
        if duo.pose.isOpen {
            // Where the camera's center lands on screen, for moving a ring to a chosen point (board O2). In the
            // window's points: the map's own local points start under its top padding.
            cameraAnchor = proxy.convert(context.camera.centerCoordinate, to: .global)
            anchorSize = duo.size
        }
        // Once the camera is known (below), a card waiting for it glides to its ring.
        defer { if duo.pose.isWide { glideIfPending(proxy: proxy) } }
        // The open Duo's clear part is in the window's (screen's) points; the phone's in the map's own.
        let topLeft = CGPoint(x: clear.minX, y: clear.minY)
        let bottomRight = CGPoint(x: clear.maxX, y: clear.maxY)
        let open = duo.pose.isOpen
        guard let northWest = open ? proxy.convert(topLeft, from: .global) : proxy.convert(topLeft, from: .local),
              let southEast = open ? proxy.convert(bottomRight, from: .global) : proxy.convert(bottomRight, from: .local),
              northWest.latitude > southEast.latitude, southEast.longitude > northWest.longitude
        else {
            viewModel.cameraChanged(context.region, camera: context.camera)
            return
        }
        viewModel.mapPoints = clear.height
        viewModel.cameraChanged(
            MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: (northWest.latitude + southEast.latitude) / 2,
                    longitude: (northWest.longitude + southEast.longitude) / 2
                ),
                span: MKCoordinateSpan(
                    latitudeDelta: northWest.latitude - southEast.latitude,
                    longitudeDelta: southEast.longitude - northWest.longitude
                )
            ),
            camera: context.camera
        )
    }

    private func mapLayer(onSettled: @escaping (MapCameraUpdateContext) -> Void) -> some View {
        let pins = viewModel.pinsOnMap
        return Map(position: $camera, interactionModes: [.pan, .zoom]) {
            UserAnnotation()
            ForEach(pins.markers) { marker in
                switch marker {
                case let .ring(ring):
                    ringAnnotation(ring, at: marker.coordinate, plan: pins.tags)
                case let .fan(cluster):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        MomentsFan(rings: cluster.rings, playing: playingMomentIds, onOpen: open)
                    }
                    .annotationTitles(.hidden)
                case let .cluster(cluster):
                    Annotation("", coordinate: marker.coordinate, anchor: .bottom) {
                        Button { zoom(to: cluster) } label: { MomentClusterBubble(rings: cluster.rings) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(MomentsSpeech.label(for: cluster))
                            .accessibilityHint("Zooms in")
                            .accessibilityIdentifier("moments.cluster")
                    }
                    .annotationTitles(.hidden)
                }
            }
            // A Moment with no location posts in the strip only: there's no spot for it on the map.
            ForEach(uploads.postings.filter { !$0.noLocation }) { posting in
                Annotation(
                    "",
                    coordinate: CLLocationCoordinate2D(latitude: posting.latitude, longitude: posting.longitude),
                    anchor: MomentRingPin.anchor
                ) {
                    if duo.pose.isOpen {
                        // The open Duo has no strip to retry from: the pin itself asks (board O10).
                        MomentsPostingPinButton(posting: posting, me: me, onRetry: uploads.retry, onDiscard: uploads.discard)
                    } else {
                        MomentsPostingPin(posting: posting, me: me)
                    }
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd, onSettled)
        .watchesFingerOnMap(hidesBar: duo.pose == .phone) { viewModel.fingerOnMapAt = duo.pose.isOpen ? nil : Date() }
        // A tap on the map itself closes the card beside it (open sideways, board O2). A ring's own tap comes first.
        // Elsewhere the gesture is off, so phones' maps take touches as they always have.
        .simultaneousGesture(TapGesture().onEnded { closeCardOnMapTap() }, including: duo.pose.isWide ? .all : .subviews)
        // What the camera centers on lands between the top row and the strip; open, in the middle of the clear part.
        .safeAreaPadding(.top, duo.pose == .phone ? Self.coveredTop : openMapRect.minY)
        .safeAreaPadding(.bottom, duo.pose == .phone ? coveredBottom : openMapBottomPadding)
        .accessibilityIdentifier("moments.mapCanvas")
    }

    func open(_ ring: MomentRingDTO) {
        pinTappedAt = Date()
        actions.watch(viewModel.watchQueue(from: ring), 0, false)
    }

    /// The map's own tap also sees a tap on a ring: a ring tapped just now wins.
    private func closeCardOnMapTap() {
        guard duo.pose.isWide, watching != nil else { return }
        Task {
            try? await Task.sleep(for: .milliseconds(80))
            guard Date().timeIntervalSince(pinTappedAt) > 0.4 else { return }
            mapTapped()
        }
    }

    /// Board M2: zoom into a crowded spot; the strip shows only it. More on one point than fit round it: the strip lists them.
    /// Open sideways (board O3), the spot goes to the middle of the left half and its list shows beside it.
    private func zoom(to cluster: MomentsCluster) {
        pinTappedAt = Date()
        viewModel.focus(on: cluster, from: closeCardForSpot())
        guard !cluster.isOnePoint || cluster.rings.count <= MomentsClustering.fanLimit else { return }
        if duo.pose.isWide { return zoomBeside(cluster) }
        let span = MomentsClustering.span(toOpen: cluster)
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(
                center: cluster.coordinate,
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            ))
        }
    }

    /// M2's back pill: the area, as it was.
    func backToArea() {
        _ = closeCardForSpot()
        guard let previous = viewModel.clearFocus() else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) { camera = .camera(previous) }
    }

    /// The map made again (a new layout) opens where it was left.
    private func restoreCamera() {
        guard camera == .automatic, let last = viewModel.lastCamera else { return }
        camera = .camera(last)
    }

    /// About a neighborhood across, with you in the middle of the clear part.
    private func recenter() {
        guard let center = viewModel.center else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                span: MKCoordinateSpan(latitudeDelta: 0.025, longitudeDelta: 0.025)
            ))
        }
    }

    /// Moves the map to a spot it isn't showing, at the zoom it has (never wider than a neighborhood).
    private func bringIntoView(_ spot: CLLocationCoordinate2D) {
        guard let region = viewModel.lastRegion else { return }
        let inView = abs(region.center.latitude - spot.latitude) < region.span.latitudeDelta * 0.45
            && abs(region.center.longitude - spot.longitude) < region.span.longitudeDelta * 0.45
        guard !inView else { return }
        let span = min(region.span.latitudeDelta, 0.025)
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(center: spot, span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)))
        }
    }
}

/// Rings on one point, close up: each its own pin round the point, the point marked with a dot.
private struct MomentsFan: View {
    let rings: [MomentRingDTO]
    /// The Moments playing in the card beside the map (open sideways): a ring holding one of them is drawn playing.
    var playing: Set<String> = []
    let onOpen: (MomentRingDTO) -> Void

    var body: some View {
        // The ring's radius, plus a whole pin above the top one.
        let reach = 36 + 6 * CGFloat(rings.count) + 80
        ZStack {
            Circle()
                .fill(MomentsPalette.pinSurface)
                .frame(width: 10, height: 10)
                .overlay(Circle().fill(MomentsPalette.ringEnd).padding(2.5))
                .shadow(color: .black.opacity(0.3), radius: 1.5, x: 0, y: 1)
            ForEach(Array(rings.enumerated()), id: \.element.id) { index, ring in
                let offset = MomentsClustering.fanOffset(index: index, of: rings.count)
                Button { onOpen(ring) } label: { MomentRingPin(ring: ring, playing: ring.moments.contains { playing.contains($0.id) }) }
                    .buttonStyle(.plain)
                    // The tail's tip toward the point: the pin stands on its spot round it.
                    .offset(x: offset.width, y: offset.height - 35)
                    .accessibilityLabel(MomentsSpeech.label(for: ring))
                    .accessibilityHint("Plays their Moments")
                    .accessibilityIdentifier("moments.ring.\(ring.id)")
            }
        }
        .frame(width: reach * 2, height: reach * 2)
    }
}

/// Board P5: your ring while a Moment posts, and "Posting · 65%" under it.
struct MomentsPostingPin: View {
    let posting: MomentPosting
    let me: MomentAuthorDTO?

    var body: some View {
        MomentPostingRing(progress: posting.progress, avatar: me)
            .overlay(alignment: .bottom) {
                if let label {
                    Text(label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(isFailed ? Theme.Color.error : Theme.Color.primaryTint)
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 26)
                        .background(Capsule().fill(.regularMaterial))
                        .shadow(color: .black.opacity(0.14), radius: 5, x: 0, y: 2)
                        .offset(y: 31)
                        .accessibilityIdentifier("moments.posting.label")
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(spoken)
            .accessibilityIdentifier("moments.posting")
    }

    private var isFailed: Bool {
        if case .failed = posting.phase { return true }
        return false
    }

    /// Nothing under the ring once it's live: the real ring is about to take its place.
    private var label: String? {
        switch posting.phase {
        case .uploading: "Posting · \(Int((posting.progress * 100).rounded()))%"
        case .checking: "Posting · 100%"
        case .failed: "Didn't post"
        case .live: nil
        }
    }

    private var spoken: String {
        switch posting.phase {
        case .uploading: "Your Moment is posting, \(Int((posting.progress * 100).rounded())) percent"
        case .checking: "Your Moment is almost posted"
        case let .failed(message): "Your Moment didn't post. \(message)"
        case .live: "Your Moment is live"
        }
    }
}

/// What VoiceOver reads for a ring or a bubble.
enum MomentsSpeech {
    /// "Priya S., 3 Moments, new, at Vancouver Community Library, verified resident".
    /// A face in the strip: as a ring, but someone at several spots reads "at 3 places".
    static func label(for person: MomentsStripPerson) -> String {
        guard person.rings.count > 1 else { return label(for: person.face) }
        let face = person.face
        var parts = [face.mine ? "Your Moments" : face.author.name, "\(face.moments.count) Moments", face.isNew ? "new" : "watched"]
        parts.append("at \(person.rings.count) places")
        if face.author.verified { parts.append("verified resident") }
        return parts.joined(separator: ", ")
    }

    static func label(for ring: MomentRingDTO, height: MomentShownHeight? = nil) -> String {
        let count = ring.moments.count == 1 ? "1 Moment" : "\(ring.moments.count) Moments"
        var parts = [ring.mine ? "Your Moments" : ring.author.name, count, ring.isNew ? "new" : "watched"]
        if !ring.placeLabel.isEmpty { parts.append("at \(ring.placeLabel)") }
        if let height { parts.append(height.spoken) }
        if ring.author.verified { parts.append("verified resident") }
        return parts.joined(separator: ", ")
    }

    /// "Esther Short Park: 5 people, 3 new".
    static func label(for cluster: MomentsCluster) -> String {
        let place = cluster.placeName ?? ""
        let new = MomentsMapViewModel.newPeople(in: cluster.rings)
        let count = MomentsMapViewModel.people(in: cluster.rings)
        let people = "\(count) \(count == 1 ? "person" : "people")" + (new > 0 ? ", \(new) new" : "")
        return place.isEmpty ? people : "\(place): \(people)"
    }
}

/// "Your Moment is live. It shows for 24 hours.", over the map for a few seconds.
private struct MomentsLiveNote: View {
    let text: String
    /// The green check: something went through ("Your Moment is live"). Not for "This Moment has ended."
    let confirms: Bool

    var body: some View {
        HStack(spacing: Spacing.s2) {
            if confirms { Icon(.check, size: 16, strokeWidth: 2.75, color: Theme.Color.success) }
            Text(text)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .momentsGlass(Capsule())
        .padding(.horizontal, Spacing.s6)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
        .accessibilityIdentifier("moments.liveNote")
    }
}
