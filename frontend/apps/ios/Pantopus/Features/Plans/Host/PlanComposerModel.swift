//
//  PlanComposerModel.swift
//  Pantopus
//
//  The host's draft (boards H1 to H7) and posting it. Current location only
//  proves the host is nearby (decision D2): it goes along as `gps`, never as
//  the pin. The pin is a public place, or the host's home revealed only to
//  people they accept (never for playdates, decision D6).
//

import Foundation
import Observation

/// How people get in (decision D7).
enum PlanApproval: Hashable {
    case approveEach
    case verifiedAuto
    case anyoneNearby
}

/// The host's home as a place for the plan.
struct PlanHomeChoice: Hashable {
    let id: String
    let street: String?
    let city: String?
    let latitude: Double
    let longitude: Double
}

@Observable
@MainActor
final class PlanComposerModel {
    enum Where: Hashable {
        case publicPlace, home
    }

    var kind: PlanKind {
        didSet { if oldValue != kind { applyDefaults() } }
    }

    var title = ""
    var about = ""
    var start = Date()
    var end = Date()
    /// Pickup games: "Now" or "Later".
    var startsNow = true
    var whereKind: Where = .publicPlace
    var place: PlanPlaceOptionDTO?
    private(set) var home: PlanHomeChoice?
    var spots = 8
    var approval: PlanApproval = .approveEach
    var alsoHostedBefore = false
    var guestNote = ""
    var game: PlanGameOptionDTO?
    private(set) var games: [PlanGameOptionDTO] = []
    var kidsAges: Set<PlanKidsAgeBand> = []
    var sport = "pickleball"
    var level = "any"
    var extraGear = false
    var walkKind = "walk"
    var pace = "easy"
    var dogsWelcome = false

    private(set) var isPosting = false
    var postError: String?
    private(set) var posted: PlanDetailDTO?
    /// "Near Prune Hill"-style words for the preview, from the place's locality.
    private(set) var previewArea: String?
    private(set) var hostName = "You"
    /// A5 "Host again": the plan this one repeats.
    var hostedAgainFrom: String?
    /// Playdates need a verified address; without one H1's playdate card leads there.
    private(set) var verifiedAddress: Bool
    /// The title filled in from a game, cleared when the type changes.
    @ObservationIgnored private var autoTitle: String?
    /// A type was chosen (H1) or given: only then may a watch party pick the first game.
    @ObservationIgnored private var kindChosen: Bool

    private let api: APIClient
    private let location: any LocationProviding

    init(start: PlansHostStart?, api: APIClient = .shared, location: any LocationProviding = DeviceLocationProvider.shared) {
        kind = start?.kind ?? .watchParty
        kindChosen = start != nil
        verifiedAddress = PlansStoreReads.peekMine()?.viewer?.verifiedAddress ?? true
        game = start?.game
        self.api = api
        self.location = location
        applyDefaults()
        if let game = start?.game { pick(game) }
        if let again = start?.again { repeatPlan(again) }
    }

    // MARK: - Loading

    func load() async {
        if case let .signedIn(user) = AuthManager.shared.state {
            hostName = PlanComposerOptions.publicName(user.displayName ?? user.username)
        }
        async let homeRead: Void = loadHome()
        async let gamesRead: Void = loadGames()
        async let standingRead: Void = loadStanding()
        _ = await (homeRead, gamesRead, standingRead)
    }

    private func loadStanding() async {
        if let viewer = try? await PlansStoreReads.mine().value.viewer {
            verifiedAddress = viewer.verifiedAddress
        }
    }

    private func loadHome() async {
        guard let homes = try? await HomesStoreReads.myHomes().value.homes,
              let mine = homes.first(where: { $0.location != nil && $0.showsCopyBeforeRecheck }) ?? homes
              .first(where: { $0.location != nil }),
              let point = mine.location else { return }
        home = PlanHomeChoice(
            id: mine.home.id,
            street: mine.home.address,
            city: mine.home.city,
            latitude: point.latitude,
            longitude: point.longitude
        )
    }

    private func loadGames() async {
        guard let reply = try? await ScreenStore.shared.load(PlansEndpoints.games(), as: PlanGamesResponse.self, kind: .publicPlace)
        else { return }
        games = reply.value.games
        if kindChosen, kind == .watchParty, game == nil, title.isEmpty, let first = games.first { pick(first) }
    }

    /// H1: the type the host picked. A watch party starts on the soonest game;
    /// any other type drops a game and the title it filled in.
    func choose(_ newKind: PlanKind) {
        kind = newKind
        kindChosen = true
        if newKind == .watchParty {
            if game == nil, title.isEmpty, let first = games.first { pick(first) }
        } else {
            game = nil
            if let autoTitle, title == autoTitle { title = "" }
            autoTitle = nil
        }
    }

    // MARK: - Choices

    /// Picking a game fills in the title and the time (H2).
    func pick(_ newGame: PlanGameOptionDTO?) {
        game = newGame
        guard let newGame else { return }
        title = "\(newGame.label) game"
        autoTitle = title
        if let gameStart = newGame.startsAtDate, gameStart > Date() {
            start = gameStart
            end = newGame.endsAtDate ?? gameStart.addingTimeInterval(3 * 3600 + 20 * 60)
        }
    }

    /// Playdates and plans at home: the host approves each person (D6, D7).
    var approvalIsLocked: Bool {
        kind == .playdate || whereKind == .home
    }

    var approvalOptions: [PlanApproval] {
        switch kind {
        case .playdate: [.approveEach]
        case .pickupGame: [.anyoneNearby, .approveEach]
        case .walkCoffee: whereKind == .home ? [.approveEach] : [.verifiedAuto, .approveEach]
        case .watchParty: whereKind == .home ? [.approveEach] : [.approveEach, .verifiedAuto]
        }
    }

    var canHostAtHome: Bool {
        kind == .watchParty || kind == .walkCoffee
    }

    func setWhere(_ newWhere: Where) {
        whereKind = newWhere
        if newWhere == .home {
            approval = .approveEach
        } else if !approvalOptions.contains(approval) {
            approval = approvalOptions.first ?? .approveEach
        }
    }

    // MARK: - Checks

    /// What's still missing, in a sentence; nil when the draft can be previewed.
    var problem: String? {
        if kind == .playdate, kidsAges.isEmpty { return "Pick the kids' ages." }
        if effectiveTitle.trimmingCharacters(in: .whitespaces).isEmpty { return "Add a title." }
        if whereKind == .publicPlace, place == nil { return "Choose a place." }
        if whereKind == .home, home == nil { return "Add your home to host there, or choose a public place." }
        let span = end.timeIntervalSince(effectiveStart)
        if span < 15 * 60 { return "A plan lasts at least 15 minutes." }
        if span > 8 * 3600 { return "A plan lasts at most 8 hours." }
        if effectiveStart > Date().addingTimeInterval(14 * 86400) { return "Plans start within the next 14 days." }
        if effectiveStart < Date().addingTimeInterval(-60), !(kind == .pickupGame && startsNow) { return "Pick a time from now on." }
        return nil
    }

    /// Pickup games have no title field: "Pickleball, need 2".
    var effectiveTitle: String {
        if kind == .pickupGame { return "\(PlanComposerOptions.sportLabel(sport)), need \(spots)" }
        return title
    }

    var effectiveStart: Date {
        kind == .pickupGame && startsNow ? Date() : start
    }

    // MARK: - Preview

    func loadPreviewArea() async {
        guard let point = placePoint else { return }
        if let reply: GeoReverseResponse = try? await api.request(GeoEndpoints.reverse(
            latitude: point.latitude,
            longitude: point.longitude
        )),
            let city = reply.normalized.city, !city.isEmpty {
            previewArea = "Near \(city)"
        }
    }

    var placePoint: (latitude: Double, longitude: Double)? {
        switch whereKind {
        case .publicPlace: place.map { ($0.latitude, $0.longitude) }
        case .home: home.map { ($0.latitude, $0.longitude) }
        }
    }

    // MARK: - Posting

    /// H7 "Post plan". True when it went through (`posted` holds the plan).
    func post() async -> Bool {
        guard problem == nil, let body = await makeBody() else {
            postError = problem ?? "Choose a place."
            return false
        }
        isPosting = true
        postError = nil
        defer { isPosting = false }
        do {
            let created: PlanDetailDTO = try await api.request(PlansEndpoints.create(body))
            posted = created
            PlansStoreReads.changed(planId: created.id)
            return true
        } catch {
            postError = PlanErrors.sentence(for: error)
            return false
        }
    }

    private func makeBody() async -> CreatePlanBody? {
        let placeBody: PlanPlaceBody
        switch whereKind {
        case .publicPlace:
            guard let place else { return nil }
            placeBody = PlanPlaceBody(
                kind: .publicPlace,
                name: place.name,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                homeId: nil
            )
        case .home:
            guard let home else { return nil }
            let first = hostName.split(separator: " ").first.map(String.init) ?? "My"
            placeBody = PlanPlaceBody(
                kind: .home,
                name: "\(first)'s place",
                address: [home.street, home.city].compactMap { $0 }.joined(separator: ", "),
                latitude: home.latitude,
                longitude: home.longitude,
                homeId: home.id
            )
        }
        // A fresh fix, only when location is already allowed: it proves the host is nearby.
        var gps: PlanGPSBody?
        if location.canLocateWithoutAsking, let fix = await location.requestCurrent(timeoutSeconds: 4) {
            gps = PlanGPSBody(latitude: fix.latitude, longitude: fix.longitude, timestamp: Date())
        }
        let trimmedAbout = about.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNote = guestNote.trimmingCharacters(in: .whitespacesAndNewlines)
        var body = CreatePlanBody(
            kind: kind,
            title: effectiveTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            about: trimmedAbout.isEmpty ? nil : trimmedAbout,
            startsAt: effectiveStart,
            endsAt: end,
            place: placeBody,
            spots: spots,
            autoRules: autoRules,
            joinRequirement: kind == .playdate ? .verified : .located,
            details: details,
            guestNote: trimmedNote.isEmpty ? nil : trimmedNote,
            gps: gps
        )
        body.hostedAgainFrom = hostedAgainFrom
        return body
    }

    var autoRules: [PlanAutoRule] {
        if kind == .playdate { return [] }
        var rules: [PlanAutoRule] = []
        switch approval {
        case .approveEach: break
        case .verifiedAuto: rules.append(.verified)
        case .anyoneNearby: rules.append(.anyoneNearby)
        }
        if alsoHostedBefore { rules.append(.hostedBefore) }
        if whereKind == .home { rules = rules.filter { $0 == .hostedBefore } }
        return rules
    }

    var details: PlanDetailsDTO {
        var details = PlanDetailsDTO()
        switch kind {
        case .watchParty:
            if let game { details.game = PlanGameDTO(label: game.label, startsAt: game.startsAt) }
        case .playdate:
            details.kidsAgeBands = PlanKidsAgeBand.allCases.filter(kidsAges.contains)
        case .pickupGame:
            details.sport = sport
            details.level = level
            details.extraGear = extraGear
        case .walkCoffee:
            details.walkKind = walkKind
            details.pace = pace
            details.dogsWelcome = dogsWelcome
        }
        return details
    }

    // MARK: - Defaults

    private func applyDefaults() {
        let calendar = Calendar.current
        let nextHour = calendar.nextDate(after: Date(), matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? Date()
        switch kind {
        case .watchParty:
            spots = 8
            approval = .approveEach
            start = Self.sensibleStart(for: kind, calendar: calendar)
            end = start.addingTimeInterval(3 * 3600)
        case .playdate:
            spots = 4
            approval = .approveEach
            whereKind = .publicPlace
            start = Self.sensibleStart(for: kind, calendar: calendar)
            end = start.addingTimeInterval(90 * 60)
        case .pickupGame:
            spots = 2
            approval = .anyoneNearby
            whereKind = .publicPlace
            startsNow = true
            start = nextHour
            // About two hours from now, on a quarter hour ("Until 5:15 AM").
            let quarter: TimeInterval = 15 * 60
            end = Date(timeIntervalSinceReferenceDate: (Date().addingTimeInterval(2 * 3600).timeIntervalSinceReferenceDate / quarter)
                .rounded(.up) * quarter)
        case .walkCoffee:
            spots = 6
            approval = .verifiedAuto
            start = Self.sensibleStart(for: kind, calendar: calendar)
            end = start.addingTimeInterval(3600)
        }
        if !canHostAtHome { whereKind = .publicPlace }
    }
}

extension PlanComposerModel {
    /// Two hours from now on the hour, unless that falls at night (or, for a
    /// playdate, outside the daytime): then the next sensible time, a playdate
    /// at 10 AM, a walk at 8 AM, a watch party at 7 PM (as on Android).
    static func sensibleStart(for kind: PlanKind, now: Date = Date(), calendar: Calendar = .current) -> Date {
        let later = now.addingTimeInterval(2 * 3600)
        let soon = calendar.dateInterval(of: .hour, for: later)?.start ?? later
        let (earliest, latest, preferred) = switch kind {
        case .playdate: (8, 18, 10)
        case .walkCoffee: (7, 21, 8)
        case .watchParty, .pickupGame: (8, 21, 19)
        }
        let hour = calendar.component(.hour, from: soon)
        if hour >= earliest, hour < latest { return soon }
        let day = hour >= latest ? calendar.date(byAdding: .day, value: 1, to: soon) ?? soon : soon
        return calendar.date(bySettingHour: preferred, minute: 0, second: 0, of: day) ?? soon
    }

    /// A5 "Host again": the same plan, same time next week.
    func repeatPlan(_ plan: PlanDetailDTO) {
        let card = plan.card
        hostedAgainFrom = card.id
        title = card.title
        about = card.about ?? ""
        spots = card.spots
        let week: TimeInterval = 7 * 86400
        var nextStart = (card.startsAtDate ?? start).addingTimeInterval(week)
        while nextStart < Date() {
            nextStart = nextStart.addingTimeInterval(week)
        }
        let length = (card.endsAtDate ?? card.startsAtDate?.addingTimeInterval(3600))
            .flatMap { end in card.startsAtDate.map { end.timeIntervalSince($0) } } ?? 3600
        start = nextStart
        end = nextStart.addingTimeInterval(length)
        startsNow = false
        guestNote = plan.place?.note ?? ""
        if let details = card.details {
            if let label = details.game?.label { title = card.title.isEmpty ? "\(label) game" : card.title }
            kidsAges = Set(details.kidsAgeBands ?? [])
            sport = details.sport ?? sport
            level = details.level ?? level
            extraGear = details.extraGear ?? false
            walkKind = details.walkKind ?? walkKind
            pace = details.pace ?? pace
            dogsWelcome = details.dogsWelcome ?? false
        }
        let rules = Set(card.autoRules ?? [])
        alsoHostedBefore = rules.contains(.hostedBefore)
        approval = rules.contains(.anyoneNearby) ? .anyoneNearby : rules.contains(.verified) ? .verifiedAuto : .approveEach
        if card.placeKind == .home {
            whereKind = .home
        } else if let place = plan.place {
            whereKind = .publicPlace
            self.place = PlanPlaceOptionDTO(
                placeId: nil,
                name: place.name ?? card.area.label,
                category: nil,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude
            )
        }
    }
}

/// H11 presents the place picker over a draft.
extension PlanComposerModel: Identifiable {}
