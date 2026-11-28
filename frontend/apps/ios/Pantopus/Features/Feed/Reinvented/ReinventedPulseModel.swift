//
//  ReinventedPulseModel.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1 (PHASE-1 §2, pieces 2 to 5; CONTRACT 6a): the one Pulse tab's list. One request draws
//  the first screen (`GET /api/reinvented/list`): the Moments that fade and the posts that stay, ordered by reach,
//  with the distance bands and the chips this place has. Only while `pulse_reinvented` is on for the person; a refusal
//  (`403 PULSE_REINVENTED_OFF`) re-reads the switch, and an older server (404) puts today's Pulse back until it is
//  asked again a few minutes later (`ReinventedServer`).
//

import CoreLocation
import Foundation
import Observation

/// Whether the server knows the phase 1 routes. A 404 from one marks it behind; today's screens show until it is
/// tried again a minute later.
@Observable
@MainActor
final class ReinventedServer {
    static let shared = ReinventedServer()
    private(set) var behindUntil: Date?

    var behind: Bool {
        guard let until = behindUntil else { return false }
        return until > Date()
    }

    func markBehind() {
        behindUntil = Date().addingTimeInterval(60)
    }

    func clear() {
        behindUntil = nil
    }
}

@Observable
@MainActor
final class ReinventedPulseModel {
    enum Load: Equatable {
        case loading
        case loaded
        case needsPlace
        case failed(String)
    }

    /// One row of the list: a band's line, a heading (Explore's "Today, elsewhere"), a Moment, or a post; in Explore
    /// each item carries why it is there.
    enum Row: Identifiable {
        case band(ReinventedBandDTO)
        case heading(String)
        case moment(MomentDTO, why: String?, kept: Bool)
        case post(PulsePostCardContent, why: String?)

        var id: String {
            switch self {
            case let .band(band): "band-\(band.band)"
            case let .heading(words): "heading-\(words)"
            case let .moment(moment, _, _): "moment-\(moment.id)"
            case let .post(card, _): "post-\(card.id)"
            }
        }
    }

    private(set) var load: Load = .loading
    private(set) var placeLabel: String?
    private(set) var chips: [String] = ["all"]
    private(set) var end: String?
    /// Explore pauses here ("Keep exploring?") until the person asks for more.
    private(set) var pause: String?
    private(set) var loadingMore = false
    /// Close circle (`close`), Around me (`around`) or Explore (`explore`).
    private(set) var reach = "around"
    private(set) var miles = 25
    private(set) var chip = "all"
    /// One of the person's circles inside Close circle (CONTRACT 8d); nil is all their connections.
    private(set) var circle: ReinventedCirclePick?
    /// The filters on (CONTRACT 10a), sent instead of the chip; nil sends today's request.
    private(set) var filters: [String: String]?
    /// PHASE-6 B: the part of the map not under the top line or the sheet, while the sheet rests at peek or half and the
    /// reach is Around me; the list is then what the map shows there (CONTRACT 11a). Nil: the reach's whole list.
    private(set) var box: ReinventedMapBox?
    /// "No place": posts and Moments without a place follow the placed ones (CONTRACT 11b).
    private(set) var noPlace = false
    /// How many things the box holds (first page), and whether the map's cap was reached; nil without a box.
    private(set) var count: Int?
    private(set) var countMore = false
    /// The rows are an older area's while the new one's read is out: drawn dimmed until the new rows are here.
    private(set) var stale = false
    /// A pin tapped: the row the list scrolls to.
    var scrollTarget: String?
    let cards: ProfilePostCardsModel

    @ObservationIgnored private var items: [ReinventedListItemDTO] = []
    /// Explore: why each item is there, and how many of the first are "Today, elsewhere".
    @ObservationIgnored private var why: [String: String] = [:]
    @ObservationIgnored private var pickedCount = 0
    @ObservationIgnored private var bands: [ReinventedBandDTO] = []
    @ObservationIgnored private var cursor: String?
    @ObservationIgnored private var reading: Task<Void, Never>?
    @ObservationIgnored private var following: Task<Void, Never>?
    /// The last first page per area, filters and "No place", for this visit (PHASE-6 B).
    @ObservationIgnored private var kept: [String: (page: ReinventedListResponse, at: Date)] = [:]
    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let viewerId: String?

    init(api: APIClient = .shared) {
        self.api = api
        var viewer: String?
        if case let .signedIn(user) = AuthManager.shared.state { viewer = user.id }
        viewerId = viewer
        cards = ProfilePostCardsModel(viewerId: viewer, client: api, store: ScreenStore.store(for: api))
    }

    /// The list as drawn: each band's line where the band changes, then its items.
    var rows: [Row] {
        let cardsById = Dictionary(cards.cards.map { ($0.id, $0) }) { first, _ in first }
        var rows: [Row] = []
        var lastBand: String?
        // A Retake is one row (CONTRACT 8e): its first frame in the list opens the whole Retake.
        var retakes = Set<String>()
        var skies = Set<String>()
        var boards = Set<String>()
        for (index, item) in items.enumerated() {
            if case let .moment(moment) = item.content, let retake = moment.together.retake,
               !retakes.insert(retake.startId).inserted { continue }
            // A sky piece is one row too (CONTRACT 8h): its first photo in the list opens the piece.
            if case let .moment(moment) = item.content, moment.together.retake == nil, let sky = moment.together.convergence,
               !skies.insert(sky.id).inserted { continue }
            // A pinboard is one row too (CONTRACT 8i): its newest piece in the list opens the board.
            if case let .moment(moment) = item.content, moment.together.retake == nil, moment.together.convergence == nil,
               let board = moment.together.pinboard, !boards.insert(board.startId).inserted { continue }
            if reach == "explore", index == 0, pickedCount > 0 { rows.append(.heading("Today, elsewhere")) }
            if reach == "explore", index == pickedCount, pickedCount > 0 { rows.append(.heading("New elsewhere")) }
            if let band = item.band, band != lastBand, let line = bands.first(where: { $0.band == band }) {
                rows.append(.band(line))
                lastBand = band
            }
            switch item.content {
            case let .moment(moment): rows.append(.moment(moment, why: why[item.id], kept: item.kept))
            case let .post(post): if let card = cardsById[post.id] { rows.append(.post(card, why: why[item.id])) }
            }
        }
        return rows
    }

    var isEmpty: Bool {
        items.isEmpty
    }

    var hasMore: Bool {
        cursor != nil
    }

    /// The person watching (for "Pass it on", never on their own post).
    var viewer: String? {
        viewerId
    }

    /// A post's travel (CONTRACT 8f): who passed it on or carried it here, an Eyes-on Ask's window.
    func travel(of postId: String) -> ReinventedTravelDTO? {
        items.first { $0.id == postId }?.travel
    }

    /// The Moment's author is the person watching.
    func isMine(_ moment: MomentDTO) -> Bool {
        moment.author.id == viewerId
    }

    // MARK: - Reading

    func refresh() async {
        reading?.cancel()
        let task = Task { await read(cursor: nil) }
        reading = task
        await task.value
    }

    func loadMore() async {
        guard let cursor, !loadingMore, load == .loaded else { return }
        loadingMore = true
        defer { loadingMore = false }
        await read(cursor: cursor)
    }

    /// The map came to rest (or the sheet moved to another rest): the list follows the new area 250 ms later, dropping a
    /// read in flight; the old rows stay, dimmed, until the new ones come. An area seen this visit shows at once.
    func follow(_ next: ReinventedMapBox?) {
        let next = reach == "around" ? next : nil
        following?.cancel()
        guard next != box else { return }
        following = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard let self, !Task.isCancelled else { return }
            box = next
            if let hit = kept[keepKey], hit.at.timeIntervalSinceNow > -60 {
                reading?.cancel()
                show(hit.page, appending: false, revision: cards.actionRevision)
                return
            }
            stale = !items.isEmpty
            await refresh()
        }
    }

    /// "No place" on or off.
    func show(noPlace: Bool) async {
        guard noPlace != self.noPlace else { return }
        self.noPlace = noPlace
        await refresh()
    }

    /// What one first page is kept under.
    private var keepKey: String {
        let area = box.map { String(format: "%.4f,%.4f,%.4f,%.4f", $0.south, $0.west, $0.north, $0.east) } ?? "reach"
        let filtered = (filters ?? [:]).sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return "\(area)|\(chip)|\(filtered)|\(noPlace)"
    }

    /// The kept filters, before the first read.
    func prime(filters: [String: String]?) {
        self.filters = filters
    }

    /// The filters changed (the sheet, the pill's ✕, the When): the list reads again with them.
    func apply(filters: [String: String]?) async {
        guard filters != self.filters else { return }
        self.filters = filters
        await refresh()
    }

    func pick(chip: String) async {
        guard chip != self.chip else { return }
        self.chip = chip
        await refresh()
    }

    func pick(reach: String, miles: Int, circle: ReinventedCirclePick? = nil) async {
        guard reach != self.reach || miles != self.miles || circle != self.circle else { return }
        self.reach = reach
        self.miles = miles
        self.circle = reach == "close" ? circle : nil
        chip = "all"
        // The map's area goes with Around me only (CONTRACT 11a); the view sets it again at the next rest.
        if reach != "around" { box = nil }
        // What the pill now names, never the last reach's rows under it: loading until it comes, or why it didn't.
        items = []
        cursor = nil
        await refresh()
    }

    private func read(cursor: String?) async {
        if cursor == nil, items.isEmpty { load = .loading }
        // A tap made while this read is out keeps its value over what the read brings.
        let revision = cards.actionRevision
        let here = CLLocationManager().location?.coordinate
        if reach == "explore" { return await readExplore(cursor: cursor, at: here, revision: revision) }
        let endpoint = ReinventedEndpoints.list(
            reach: reach,
            miles: reach == "around" ? miles : nil,
            chip: chip,
            at: here.map { ($0.latitude, $0.longitude) },
            cursor: cursor,
            circle: reach == "close" ? circle?.id : nil,
            filters: filters,
            box: box,
            noPlace: noPlace
        )
        guard let data = await fetch(endpoint) else {
            if !Task.isCancelled { stale = false }
            return
        }
        guard let page = try? JSONDecoder().decode(ReinventedListResponse.self, from: data) else {
            stale = false
            if items.isEmpty { load = .failed("Couldn't load Pulse. Try again.") }
            return
        }
        if cursor == nil { kept[keepKey] = (page, Date()) }
        show(page, appending: cursor != nil, revision: revision)
    }

    /// One read of a phase 1 route: its body on success. An older server (404) puts today's Pulse back and is asked
    /// again later; a refusal (403) re-reads the switch; anything else says so when there's nothing on screen.
    private func fetch(_ endpoint: Endpoint) async -> Data? {
        let response: APIClient.DataResponse
        do {
            response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
        } catch {
            if !Task.isCancelled, items.isEmpty { load = .failed("Couldn't load Pulse. Check your connection and try again.") }
            return nil
        }
        guard !Task.isCancelled else { return nil }
        switch response.response.statusCode {
        case 200..<300:
            ReinventedServer.shared.clear()
            return response.data
        case 404 where circle != nil && Self.code(response.data) == "CIRCLE_NOT_FOUND":
            // A circle the person is no longer in: back to all their connections, not to today's Pulse.
            circle = nil
            Task { await refresh() }
        case 404:
            ReinventedServer.shared.markBehind()
        case 403:
            await PulseReinventedFlags.shared.recheck()
        default:
            if items.isEmpty { load = .failed("Couldn't load Pulse. Try again.") }
        }
        return nil
    }

    private static func code(_ data: Data) -> String? {
        ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["code"] as? String
    }

    /// Explore (CONTRACT 6f): the picked ten on the first page, then newest with variety, pausing at "Keep exploring?".
    private func readExplore(cursor: String?, at here: CLLocationCoordinate2D?, revision: Int) async {
        let endpoint = ReinventedEndpoints.explore(at: here.map { ($0.latitude, $0.longitude) }, cursor: cursor)
        guard let data = await fetch(endpoint),
              let page = try? JSONDecoder().decode(ReinventedExploreResponse.self, from: data) else { return }
        ReinventedPlacesYouFollow.shared.explored(data, first: cursor == nil) // phase 4: Explore's `followed`
        let appending = cursor != nil
        let fresh = page.picked + page.items
        if !appending {
            why = [:]
            pickedCount = page.picked.count
            bands = []
            chips = ["all"]
        }
        for entry in fresh {
            why[entry.id] = entry.why
        }
        items = (appending ? items : []) + fresh.map(\.item)
        self.cursor = page.nextCursor
        end = page.nextCursor == nil ? "That's everything for now." : nil
        pause = page.pause
        showPosts(revision: revision)
        load = .loaded
    }

    private func show(_ page: ReinventedListResponse, appending: Bool, revision: Int) {
        items = appending ? items + page.items : page.items
        stale = false
        if !appending {
            bands = page.bands
            if let chips = page.chips { self.chips = chips.isEmpty ? ["all"] : chips }
            // With the map's box the answer names no place: the pill keeps the town's name.
            if box == nil || page.placeLabel != nil { placeLabel = page.placeLabel }
            count = box == nil ? nil : page.count
            countMore = box != nil && page.countMore
        }
        cursor = page.nextCursor
        end = page.end
        pause = nil
        showPosts(revision: revision)
        load = page.needsPlace && items.isEmpty ? .needsPlace : .loaded
    }

    private func showPosts(revision: Int) {
        let posts: [FeedPostDTO] = items.compactMap {
            if case let .post(post) = $0.content { return post }
            return nil
        }
        cards.show(posts, readRevision: revision)
    }
}
