//
//  ReinventedPulseMap.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1, the one map (PHASE-1 §2 pieces 7 and 8, board B4 flat; CONTRACT 6b): behind the
//  list, and full screen at the Map height. A ring is a Moment, a mark on the ground is a post that stays (a kept
//  Moment too), a ticket is a plan. A Heads-up is red, pulsing and always on top. The time row looks back (Live,
//  Today, This week, All time) or forward (Tonight, This weekend: plans only). At the Map height a deck of cards runs
//  along the bottom: swipe it and the map glides from pin to pin. Floating heights, lanterns and the rest are phase 4.
//

import MapKit
import Observation
import SwiftUI

@Observable
@MainActor
final class ReinventedMapModel {
    /// One thing on the map, for the pins and the deck.
    enum Item: Identifiable {
        case ring(MomentRingDTO)
        case mark(ReinventedMarkDTO)
        case kept(ReinventedKeptDTO)
        case ticket(PlanPinDTO)

        var id: String {
            switch self {
            case let .ring(ring): "ring-\(ring.id)"
            case let .mark(mark): "mark-\(mark.id)"
            case let .kept(kept): "kept-\(kept.id)"
            case let .ticket(ticket): "ticket-\(ticket.id)"
            }
        }

        var coordinate: CLLocationCoordinate2D {
            switch self {
            case let .ring(ring): CLLocationCoordinate2D(latitude: ring.latitude, longitude: ring.longitude)
            case let .mark(mark): CLLocationCoordinate2D(latitude: mark.latitude, longitude: mark.longitude)
            case let .kept(kept): CLLocationCoordinate2D(latitude: kept.latitude, longitude: kept.longitude)
            case let .ticket(ticket): CLLocationCoordinate2D(latitude: ticket.latitude, longitude: ticket.longitude)
            }
        }
    }

    static let times: [(key: String, title: String)] = [
        ("live", "Live"), ("today", "Today"), ("week", "This week"), ("all", "All time"),
        ("tonight", "Tonight"), ("weekend", "This weekend")
    ]

    private(set) var time = "live"
    /// My Atlas (CONTRACT 6e): the map shows the person's own kept Moments instead of Pulse.
    private(set) var atlas = false
    private(set) var items: [Item] = []
    var position: MapCameraPosition = .userLocation(fallback: .automatic)
    /// The card the deck shows, and the pin it lights.
    var focused: String?
    /// The map is being moved (PHASE-6 A2: the rail fades meanwhile). Set once when a move starts and once at its end.
    var moving = false
    /// The filters on (CONTRACT 10a, without `when`: the time row is the map's When); nil sends today's request.
    private(set) var filters: [String: String]?
    /// Counts the map's rests, so the list can follow the area (PHASE-6 B) at once, before the map's own read.
    private(set) var rests = 0

    @ObservationIgnored private var region: MKCoordinateRegion?
    @ObservationIgnored private var reading: Task<Void, Never>?
    @ObservationIgnored private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Heads-ups last, so they draw on top of everything else.
    var drawOrder: [Item] {
        items.filter { !Self.isHeadsUp($0) } + items.filter(Self.isHeadsUp)
    }

    /// The deck's cards: Heads-ups first, then what is nearest the middle of the map when each first came. Cards
    /// already in the deck keep their places, so swiping (which moves the map, which reads again) never reshuffles it.
    private(set) var deck: [Item] = []

    private func arrangeDeck() {
        let ids = Set(items.map(\.id))
        let kept = deck.filter { ids.contains($0.id) }.compactMap { old in items.first { $0.id == old.id } }
        let keptIds = Set(kept.map(\.id))
        var fresh = items.filter { !keptIds.contains($0.id) }
        if let center = region?.center {
            let here = CLLocation(latitude: center.latitude, longitude: center.longitude)
            let meters = { (item: Item) in
                here.distance(from: CLLocation(latitude: item.coordinate.latitude, longitude: item.coordinate.longitude))
            }
            fresh.sort { first, second in
                let firstUp = Self.isHeadsUp(first), secondUp = Self.isHeadsUp(second)
                if firstUp != secondUp { return firstUp }
                return meters(first) < meters(second)
            }
        }
        deck = kept.isEmpty ? fresh : kept + fresh
    }

    static func isHeadsUp(_ item: Item) -> Bool {
        if case let .mark(mark) = item { return mark.headsUp }
        return false
    }

    /// The area the map shows, last time it came to rest.
    var shownRegion: MKCoordinateRegion? {
        region
    }

    /// The pin of a Moment or a post of the list.
    func pin(ofMoment id: String) -> Item? {
        items.first { item in
            switch item {
            case let .ring(ring): ring.moments.contains { $0.id == id }
            case let .kept(kept): kept.moment.id == id
            default: false
            }
        }
    }

    func pin(ofPost id: String) -> Item? {
        items.first { item in
            if case let .mark(mark) = item { return mark.post.id == id }
            return false
        }
    }

    /// A row of the list tapped while it follows the map (PHASE-6 B): its pin lights and the map flies to it.
    func light(_ pin: Item?) {
        guard let pin else { return }
        focused = pin.id
        fly(to: pin.coordinate)
    }

    func moved(to region: MKCoordinateRegion) {
        self.region = region
        rests += 1
        reading?.cancel()
        reading = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await self?.read()
        }
    }

    /// Into My Atlas or back to Pulse: the map reads again.
    func show(atlas: Bool) {
        guard atlas != self.atlas else { return }
        self.atlas = atlas
        items = []
        deck = []
        reading?.cancel()
        reading = Task { [weak self] in await self?.read() }
    }

    /// Reads the box again (a kept Moment deleted for good).
    func reread() {
        reading?.cancel()
        reading = Task { [weak self] in await self?.read() }
    }

    /// The filters changed: the map reads again with them.
    func apply(filters: [String: String]?) {
        guard filters != self.filters else { return }
        self.filters = filters
        reading?.cancel()
        reading = Task { [weak self] in await self?.read() }
    }

    func pick(time: String) {
        guard time != self.time else { return }
        self.time = time
        ReinventedPulseFilterStore.shared.set(time: time) // kept with the filters, per person on this phone
        reading?.cancel()
        reading = Task { [weak self] in await self?.read() }
    }

    /// Flies the map to a place (a card's place, a pin the deck moved to).
    func fly(to coordinate: CLLocationCoordinate2D) {
        let span = region?.span ?? MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        withAnimation(.easeInOut(duration: 0.6)) {
            position = .region(MKCoordinateRegion(center: coordinate, span: span))
        }
    }

    private func read() async {
        guard let region else { return }
        // Held inside the world (`ReinventedMapBox`): out at the globe, the server answers it.
        let box = ReinventedMapBox(region)
        if atlas { return await readAtlas(box) }
        let endpoint = ReinventedEndpoints.map(
            south: box.south,
            west: box.west,
            north: box.north,
            east: box.east,
            time: time,
            filters: filters
        )
        guard let response = try? await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true),
              !Task.isCancelled else { return }
        switch response.response.statusCode {
        case 200..<300:
            guard let map = try? JSONDecoder().decode(ReinventedMapResponse.self, from: response.data) else { return }
            items = map.rings.filter { !$0.noLocation }.map(Item.ring) + map.marks.map(Item.mark)
                + map.kept.map(Item.kept) + map.tickets.map(Item.ticket)
            arrangeDeck()
            MomentsGuessSpots.shared.spots = map.guessSpots
            ReinventedLivingMap.shared.answered(response.data, region: region, time: time) // phase 4: floating, sun, beams
        case 404:
            ReinventedServer.shared.markBehind()
        case 403:
            await PulseReinventedFlags.shared.recheck()
        default:
            return
        }
    }

    /// My Atlas on the map: every kept Moment of the person's in the box, as their own pins.
    private func readAtlas(_ box: ReinventedMapBox) async {
        let endpoint = ReinventedEndpoints.atlasBox(
            south: box.south,
            west: box.west,
            north: box.north,
            east: box.east
        )
        guard let page: ReinventedAtlasPage = try? await api.request(endpoint), !Task.isCancelled, atlas else { return }
        items = page.moments.filter { !$0.noLocation }.map { moment in
            .kept(ReinventedKeptDTO(id: moment.id, latitude: moment.latitude, longitude: moment.longitude, moment: moment))
        }
        arrangeDeck()
    }
}

/// The map: its pins, and a tap on one opens it.
struct ReinventedPulseMap: View {
    let model: ReinventedMapModel
    let onOpen: (ReinventedMapModel.Item) -> Void
    /// Zoomed far out, the satellite globe you can turn, as today's Pulse and Moments maps (`MapGlobe`; founder,
    /// 2026-11-28: the globe stays everywhere). Close in, the map's own look and its living layers are unchanged.
    @State private var globe = MapGlobe()

    var body: some View {
        Map(position: Binding(get: { model.position }, set: { model.position = $0 })) {
            UserAnnotation()
            ForEach(model.drawOrder) { item in
                Annotation("", coordinate: item.coordinate, anchor: .bottom) {
                    ReinventedMapPin(item: item, focused: model.focused == item.id)
                        .onTapGesture { onOpen(item) }
                }
            }
            ReinventedBeamsContent(beams: model.atlas ? [] : ReinventedLivingMap.shared.beams, night: ReinventedLivingMap.shared.night)
        }
        .mapGlobe(globe, closeIn: .standard)
        .reinventedNight() // phase 4: the map turns dark when the sun is down over it
        .mapControls {}
        // The globe follows the zoom as it happens, not after the map stops.
        .onMapCameraChange(frequency: .continuous) { context in
            globe.follow(context.region)
            if !model.moving { model.moving = true }
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            model.moving = false
            model.moved(to: context.region)
        }
        .accessibilityIdentifier("reinventedPulse.map")
    }
}

/// One pin: a ring for a Moment (today's ring pin), a mark on the ground for a post that stays, a ticket for a plan.
struct ReinventedMapPin: View {
    let item: ReinventedMapModel.Item
    let focused: Bool
    @State private var pulsing = false

    var body: some View {
        Group {
            switch item {
            case let .ring(ring):
                ReinventedLivingRing(ring: ring) // phase 4: today's ring pin unless rings float
                    .accessibilityLabel("\(ring.author.shortName)'s Moment")
            case let .mark(mark):
                markPin(PulseIntent.from(postType: mark.post.postType), headsUp: mark.headsUp)
                    .accessibilityLabel(mark.headsUp ? "Heads-up" : "A post that stays")
            case .kept:
                markPin(nil, headsUp: false)
                    .accessibilityLabel("A kept Moment")
            case let .ticket(ticket):
                ticketPin(ticket).reinventedBeacon(ticket) // phase 4: glows while rings float
            }
        }
        .scaleEffect(focused ? 1.18 : 1, anchor: .bottom)
        .reinventedLit(item.id) // phase 4: lit or dimmed while the map shows what it was asked
        .animation(.spring(response: 0.3), value: focused)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("reinventedPulse.pin.\(item.id)")
    }

    private func markPin(_ intent: PulseIntent?, headsUp: Bool) -> some View {
        let fill = headsUp ? Theme.Color.error : Theme.Color.appSurface
        return ZStack {
            if headsUp {
                Circle()
                    .fill(Theme.Color.error.opacity(0.35))
                    .frame(width: 46, height: 46)
                    .scaleEffect(pulsing ? 1.35 : 0.85)
                    .opacity(pulsing ? 0 : 1)
                    .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: pulsing)
                    .onAppear { pulsing = true }
            }
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(fill)
                .frame(width: 32, height: 32)
                .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: headsUp ? 0 : 1))
                .overlay {
                    Icon(
                        headsUp ? .alertTriangle : intent?.icon ?? .image,
                        size: 16,
                        strokeWidth: 2.2,
                        color: headsUp ? .white : Theme.Color.primaryTint
                    )
                }
                .shadow(color: .black.opacity(0.2), radius: 3, y: 1)
        }
        .frame(width: 46, height: 46)
    }

    private func ticketPin(_ ticket: PlanPinDTO) -> some View {
        HStack(spacing: 4) {
            Icon(.calendarCheck, size: 13, strokeWidth: 2.2, color: .white)
            Text(ticket.title)
                .pulseFont(12, weight: .bold)
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .frame(height: 26)
        .frame(maxWidth: 150)
        .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Theme.Color.primarySolid))
        .shadow(color: .black.opacity(0.2), radius: 3, y: 1)
        .accessibilityLabel("Plan: \(ticket.title)")
    }
}

/// The time row at the Map height: back in time, or forward for plans.
struct ReinventedTimeRow: View {
    let model: ReinventedMapModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(ReinventedMapModel.times, id: \.key) { time in
                    let on = model.time == time.key
                    Button { model.pick(time: time.key) } label: {
                        Text(time.title)
                            .pulseFont(13.5, weight: .semibold)
                            .foregroundStyle(on ? Color.white : Theme.Color.appText)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 32)
                            .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurface))
                            .overlay(Capsule().stroke(on ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("reinventedPulse.time.\(time.key)")
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }
}

/// The peek deck at the Map height: one card at a time; swiping glides the map to that card's pin.
struct ReinventedPeekDeck: View {
    let model: ReinventedMapModel
    let onOpen: (ReinventedMapModel.Item) -> Void
    @State private var current: String?

    var body: some View {
        let deck = model.deck
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: Spacing.s3) {
                ForEach(deck) { item in
                    card(item)
                        .containerRelativeFrame(.horizontal) { width, _ in width - 48 }
                        .id(item.id)
                }
            }
            .scrollTargetLayout()
        }
        .contentMargins(.horizontal, 24, for: .scrollContent)
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: $current)
        .frame(height: 112)
        .onChange(of: current) { _, id in
            guard let id, let item = deck.first(where: { $0.id == id }) else { return }
            model.focused = id
            model.fly(to: item.coordinate)
        }
        .accessibilityIdentifier("reinventedPulse.deck")
    }

    private func card(_ item: ReinventedMapModel.Item) -> some View {
        Button { onOpen(item) } label: {
            HStack(spacing: Spacing.s3) {
                ReinventedMapPin(item: item, focused: false)
                    .environment(\.reinventedFlat, true) // phase 4: the deck's pins stay flat
                    .frame(width: 64, height: 72)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title(item))
                        .pulseFont(15, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                    Text(subtitle(item))
                        .pulseFont(13)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 100)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedPulse.card.\(item.id)")
    }

    private func title(_ item: ReinventedMapModel.Item) -> String {
        switch item {
        case let .ring(ring): "\(ring.author.shortName)'s Moment"
        case let .mark(mark): mark.headsUp ? "Heads-up: \(Self.words(mark.post))" : Self.words(mark.post)
        case let .kept(kept): kept.moment.caption.flatMap { $0.isEmpty ? nil : $0 } ?? "A kept Moment"
        case let .ticket(ticket): ticket.title
        }
    }

    private func subtitle(_ item: ReinventedMapModel.Item) -> String {
        switch item {
        case let .ring(ring): ring.placeLabel
        case let .mark(mark): mark.post.locationName ?? mark.post.creator?.displayName ?? ""
        case let .kept(kept): kept.moment.placeLabel
        case let .ticket(ticket): ticket.placeName ?? ticket.areaLabel ?? "Plan"
        }
    }

    private static func words(_ post: FeedPostDTO) -> String {
        let title = post.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return title.isEmpty ? post.content : title
    }
}
