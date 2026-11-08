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
    @State private var viewModel: MomentsMapViewModel
    @State private var camera: MapCameraPosition = .automatic
    @State private var uploads = MomentsUploader.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AuthManager.self) private var auth
    private let actions: MomentsMapActions

    init(viewModel: MomentsMapViewModel, actions: MomentsMapActions) {
        _viewModel = State(initialValue: viewModel)
        self.actions = actions
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                mapLayer
                    .ignoresSafeArea()
                MomentsMapTopBar(viewModel: viewModel, onArea: actions.areaPicker, onBack: backToArea)
            }
            .overlay(alignment: .bottom) {
                MomentsMapBottom(
                    viewModel: viewModel,
                    postings: uploads.postings,
                    me: me,
                    actions: actions,
                    onRetry: uploads.retry,
                    onDiscard: uploads.discard
                )
            }
            .onChange(of: geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom, initial: true) { _, height in
                if abs(viewModel.mapPoints - height) > 1 { viewModel.mapPoints = height }
            }
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
        .onChange(of: uploads.finished) { _, _ in Task { await viewModel.load() } }
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
    private var me: MomentAuthorDTO? {
        guard case let .signedIn(user) = auth.state else { return nil }
        return MomentAuthorDTO(me: user)
    }

    // MARK: - Map

    private var mapLayer: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom]) {
            UserAnnotation()
            ForEach(viewModel.markers) { marker in
                switch marker {
                case let .ring(ring):
                    Annotation("", coordinate: marker.coordinate, anchor: MomentRingPin.anchor) {
                        Button { open(ring) } label: { MomentRingPin(ring: ring) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(MomentsSpeech.label(for: ring))
                            .accessibilityHint("Plays their Moments")
                            .accessibilityIdentifier("moments.ring.\(ring.id)")
                    }
                    .annotationTitles(.hidden)
                case let .fan(cluster):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        MomentsFan(rings: cluster.rings, onOpen: open)
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
            ForEach(uploads.postings) { posting in
                Annotation(
                    "",
                    coordinate: CLLocationCoordinate2D(latitude: posting.latitude, longitude: posting.longitude),
                    anchor: MomentRingPin.anchor
                ) {
                    MomentsPostingPin(posting: posting, me: me)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd) { context in
            viewModel.cameraChanged(context.region, camera: context.camera)
        }
        .accessibilityIdentifier("moments.mapCanvas")
    }

    private func open(_ ring: MomentRingDTO) {
        let strip = viewModel.stripRings
        if let index = strip.firstIndex(where: { $0.id == ring.id }) {
            actions.watch(strip, index, false)
        } else {
            actions.watch([ring], 0, false)
        }
    }

    /// Board M2: zoom into a crowded spot; the strip shows only it. More on one point than fit round it: the strip lists them.
    private func zoom(to cluster: MomentsCluster) {
        viewModel.focus(on: cluster)
        guard !cluster.isOnePoint || cluster.rings.count <= MomentsClustering.fanLimit else { return }
        let span = MomentsClustering.span(toOpen: cluster)
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(
                // A little south, so the rings land above the strip.
                center: CLLocationCoordinate2D(latitude: cluster.latitude - span * 0.18, longitude: cluster.longitude),
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            ))
        }
    }

    /// M2's back pill: the area, as it was.
    private func backToArea() {
        guard let previous = viewModel.clearFocus() else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) { camera = .camera(previous) }
    }

    /// The map made again (a new layout) opens where it was left.
    private func restoreCamera() {
        guard camera == .automatic, let last = viewModel.lastCamera else { return }
        camera = .camera(last)
    }

    /// About a neighborhood across, a little south so you sit above the strip.
    private func recenter() {
        guard let center = viewModel.center else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: center.latitude - 0.004, longitude: center.longitude),
                span: MKCoordinateSpan(latitudeDelta: 0.025, longitudeDelta: 0.025)
            ))
        }
    }
}

/// Rings on one point, close up: each its own pin round the point, the point marked with a dot.
private struct MomentsFan: View {
    let rings: [MomentRingDTO]
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
                Button { onOpen(ring) } label: { MomentRingPin(ring: ring) }
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
private struct MomentsPostingPin: View {
    let posting: MomentPosting
    let me: MomentAuthorDTO?

    var body: some View {
        MomentPostingRing(progress: posting.progress, avatar: me)
            .overlay(alignment: .bottom) {
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
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(spoken)
            .accessibilityIdentifier("moments.posting")
    }

    private var isFailed: Bool {
        if case .failed = posting.phase { return true }
        return false
    }

    private var label: String {
        switch posting.phase {
        case .uploading: "Posting · \(Int((posting.progress * 100).rounded()))%"
        case .checking: "Posting · 100%"
        case .failed: "Didn't post"
        }
    }

    private var spoken: String {
        switch posting.phase {
        case .uploading: "Your Moment is posting, \(Int((posting.progress * 100).rounded())) percent"
        case .checking: "Your Moment is almost posted"
        case let .failed(message): "Your Moment didn't post. \(message)"
        }
    }
}

/// What VoiceOver reads for a ring or a bubble.
enum MomentsSpeech {
    /// "Priya S., 3 Moments, new, at Vancouver Community Library, verified resident".
    static func label(for ring: MomentRingDTO) -> String {
        let count = ring.moments.count == 1 ? "1 Moment" : "\(ring.moments.count) Moments"
        var parts = [ring.mine ? "Your Moments" : ring.author.name, count, ring.isNew ? "new" : "watched"]
        if !ring.placeLabel.isEmpty { parts.append("at \(ring.placeLabel)") }
        if ring.author.verified { parts.append("verified resident") }
        return parts.joined(separator: ", ")
    }

    /// "Esther Short Park: 5 people, 3 new".
    static func label(for cluster: MomentsCluster) -> String {
        let place = cluster.rings.first?.placeLabel ?? ""
        let new = cluster.rings.filter(\.isNew).count
        let people = "\(cluster.rings.count) people" + (new > 0 ? ", \(new) new" : "")
        return place.isEmpty ? people : "\(place): \(people)"
    }
}
