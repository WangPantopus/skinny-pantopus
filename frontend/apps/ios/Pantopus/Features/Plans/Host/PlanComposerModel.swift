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

enum PlanApproval: Hashable {
    case approveEach
    case verifiedAuto
    case anyoneNearby
}

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
    var startsNow = true
    var whereKind: Where = .publicPlace
    var place: PlanPlaceOptionDTO?
    var placeIsHereNow = false
    private(set) var home: PlanHomeChoice?
    private(set) var homePoints: [(latitude: Double, longitude: Double)] = []
    var spots = 8
    var approval: PlanApproval = .approveEach
    var alsoHostedBefore = false
    var guestNote = ""
    var game: PlanGameOptionDTO?
    private(set) var games: [PlanGameOptionDTO] = []
    private(set) var sports: PlansSportsDTO?
    private var gamesGeneration = 0
    var kidsAges: Set<PlanKidsAgeBand> = []
    var sport = "pickleball"
    var level = "any"
    var extraGear = false
    var walkKind = "walk"
    var pace = "easy"
    var dogsWelcome = false
    var subject = ""
    var studyStyle = "quiet"

    private(set) var isPosting = false
    var postError: String?
    private(set) var posted: PlanDetailDTO?
    private(set) var previewArea: String?
    private(set) var hostName = "You"
    var hostedAgainFrom: String?
    private(set) var verifiedAddress: Bool
    @ObservationIgnored private var autoTitle: String?
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
        startTitle()
        if let game = start?.game { pick(game) }
        if let again = start?.again { repeatPlan(again) }
    }

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
        guard let homes = try? await HomesStoreReads.myHomes().value.homes else { return }
        homePoints = homes.compactMap { $0.location.map { (latitude: $0.latitude, longitude: $0.longitude) } }
        let located = homes.filter { $0.location != nil }
        guard let mine = located.first(where: \.showsCopyBeforeRecheck) ?? located.first, let point = mine.location else { return }
        home = PlanHomeChoice(
            id: mine.home.id,
            street: mine.home.address,
            city: mine.home.city,
            latitude: point.latitude,
            longitude: point.longitude
        )
    }

    func loadGames() async {
        gamesGeneration += 1
        let generation = gamesGeneration
        let reply: PlanGamesResponse? = try? await api.request(
            PlansEndpoints.games(from: PlansStoreReads.lastCenter, gps: PlansStoreReads.freshGPS, purpose: "composer")
        )
        guard generation == gamesGeneration, let reply, !Task.isCancelled else { return }
        games = reply.games.filter { $0.isAvailable(at: Date()) }
        sports = reply.sports
        if let selected = game, !games.contains(where: { $0.id == selected.id }) {
            game = nil
            dropAutoTitle()
        }
        if kindChosen, kind == .watchParty, game == nil, title.isEmpty, let first = automaticGame { pick(first) }
    }

    func choose(_ newKind: PlanKind) {
        kind = newKind
        kindChosen = true
        if newKind == .watchParty {
            guard game == nil else { return }
            dropAutoTitle()
            if title.isEmpty, let first = automaticGame { pick(first) }
        } else {
            game = nil
            dropAutoTitle()
            startTitle()
        }
    }

    func pick(_ newGame: PlanGameOptionDTO?) {
        game = newGame
        guard let newGame else { return }
        if title.isEmpty || title == autoTitle {
            title = "\(newGame.label) game on the big screen"
            autoTitle = title
        }
        if let gameStart = newGame.startsAtDate, gameStart > Date() {
            start = gameStart
            end = newGame.endsAtDate ?? gameStart.addingTimeInterval(3 * 3600 + 20 * 60)
        } else if let gameEnd = newGame.endsAtDate, gameEnd > Date() {
            let quarter: TimeInterval = 15 * 60
            let soon = (Date().addingTimeInterval(5 * 60).timeIntervalSinceReferenceDate / 60).rounded(.down) * 60
            start = Date(timeIntervalSinceReferenceDate: (soon / quarter).rounded(.up) * quarter)
            end = max(gameEnd, start.addingTimeInterval(quarter))
        }
    }

    var approvalIsLocked: Bool {
        kind == .playdate || whereKind == .home
    }

    var approvalOptions: [PlanApproval] {
        switch kind {
        case .playdate: [.approveEach]
        case .pickupGame: [.anyoneNearby, .approveEach]
        case .walkCoffee: whereKind == .home ? [.approveEach] : [.verifiedAuto, .approveEach]
        case .watchParty: whereKind == .home ? [.approveEach] : [.approveEach, .verifiedAuto]
        case .studyGroup: [.approveEach, .verifiedAuto]
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

    var problem: String? {
        if kind == .playdate, kidsAges.isEmpty { return "Pick the kids' ages." }
        if kind == .studyGroup, trimmedSubject.isEmpty { return "Add what you're studying." }
        if effectiveTitle.trimmingCharacters(in: .whitespaces).isEmpty { return "Give your plan a title." }
        if whereKind == .publicPlace, place == nil { return "Choose a place." }
        if whereKind == .home, home == nil { return "Add your home to host there, or choose a public place." }
        let span = end.timeIntervalSince(effectiveStart)
        if span < 15 * 60 { return "A plan lasts at least 15 minutes." }
        if span > 8 * 3600 { return "A plan lasts at most 8 hours." }
        if effectiveStart > Date().addingTimeInterval(14 * 86400) { return "Plans can start up to 14 days from now." }
        if effectiveStart < Date().addingTimeInterval(-60), !(kind == .pickupGame && startsNow) { return "Pick a time that hasn't passed." }
        return nil
    }

    var effectiveTitle: String {
        if kind == .pickupGame { return "\(PlanComposerOptions.sportLabel(sport)), need \(spots)" }
        return title
    }

    var effectiveStart: Date {
        kind == .pickupGame && startsNow ? Date() : start
    }

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
        if alsoHostedBefore, kind != .pickupGame { rules.append(.hostedBefore) } // H4 has no such box (as on Android)
        if whereKind == .home { rules = rules.filter { $0 == .hostedBefore } }
        return rules
    }

    private func applyDefaults() {
        let calendar = Calendar.current
        let nextHour = calendar.nextDate(after: Date(), matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? Date()
        switch kind {
        case .watchParty, .studyGroup:
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
    var details: PlanDetailsDTO {
        var details = PlanDetailsDTO()
        switch kind {
        case .watchParty:
            if let game { details.game = game.reference }
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
        case .studyGroup:
            details.subject = trimmedSubject
            details.studyStyle = studyStyle
        }
        return details
    }

    var trimmedSubject: String {
        subject.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func sensibleStart(for kind: PlanKind, now: Date = Date(), calendar: Calendar = .current) -> Date {
        let later = now.addingTimeInterval(2 * 3600)
        let soon = calendar.dateInterval(of: .hour, for: later)?.start ?? later
        let (earliest, latest, preferred) = switch kind {
        case .playdate: (8, 18, 10)
        case .walkCoffee: (7, 21, 8)
        case .watchParty, .pickupGame, .studyGroup: (8, 21, 19)
        }
        let hour = calendar.component(.hour, from: soon)
        if hour >= earliest, hour < latest { return soon }
        let day = hour >= latest ? calendar.date(byAdding: .day, value: 1, to: soon) ?? soon : soon
        return calendar.date(bySettingHour: preferred, minute: 0, second: 0, of: day) ?? soon
    }

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
            subject = details.subject ?? subject
            studyStyle = details.studyStyle ?? studyStyle
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

extension PlanComposerModel: Identifiable {}

private extension PlanComposerModel {
    var automaticGame: PlanGameOptionDTO? {
        if sports?.canChoose == true { return games.first { $0.followed == true } }
        return games.first
    }

    func dropAutoTitle() {
        if let autoTitle, title == autoTitle { title = "" }
        autoTitle = nil
    }

    func startTitle() {
        guard title.isEmpty else { return }
        let starting: String? = switch kind {
        case .playdate: "Playground morning"
        case .walkCoffee: "Coffee walk"
        case .watchParty, .pickupGame, .studyGroup: nil
        }
        guard let starting else { return }
        title = starting
        autoTitle = starting
    }
}
