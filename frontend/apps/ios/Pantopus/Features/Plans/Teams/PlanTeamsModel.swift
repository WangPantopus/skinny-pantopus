import Foundation
import Observation

@Observable
@MainActor
final class PlanTeamsModel {
    var query = ""
    private(set) var preferences = SportsPreferencesDTO()
    private(set) var suggested: [PlanTeamDTO] = []
    private(set) var results: [PlanTeamDTO] = []
    private(set) var known: [String: PlanTeamDTO] = [:]
    private(set) var saving = false
    private(set) var loaded = false
    var error: String?
    private let api: APIClient
    private let scope: HomeClaimSessionScope

    static let leagues = ["nfl", "nba", "wnba", "mlb", "nhl", "mls", "nwsl", "ncaaf"]
    static func leagueLabel(_ id: String) -> String {
        id == "ncaaf" ? "College football" : id.uppercased()
    }

    init(api: APIClient = .shared) {
        self.api = api
        scope = HomeClaimSessionScope(api: api)
    }

    func load() async {
        loaded = false
        do {
            try scope.requireCurrent()
            let reply: FeedPreferencesResponse = try await api.request(FeedActionsEndpoints.feedPreferences())
            try scope.requireCurrent()
            preferences = reply.preferences.sports ?? SportsPreferencesDTO()
            loaded = true
            await search()
        } catch { self.error = "Couldn't load your teams. Try again." }
    }

    func search() async {
        let text = query
        do {
            try scope.requireCurrent()
            let reply: PlanTeamsResponse = try await api.request(PlansEndpoints.teams(query: text, from: PlansStoreReads.lastCenter))
            guard scope.isCurrent, text == query, !Task.isCancelled else { return }
            suggested = reply.suggested
            results = reply.results
            for team in reply.suggested + reply.results {
                known[team.id] = team
            }
        } catch {
            guard !Task.isCancelled, text == query else { return }
            self.error = "Couldn't search teams. Try again."
        }
    }

    @discardableResult
    func save(_ patch: SportsPreferencesDTO) async -> Bool {
        guard !saving, scope.isCurrent else { return false }
        saving = true
        defer { saving = false }
        do {
            let reply: FeedPreferencesResponse = try await api.request(
                FeedActionsEndpoints.updateFeedPreferences(FeedPreferencesUpdateRequest(sports: patch))
            )
            try scope.requireCurrent()
            preferences = reply.preferences.sports ?? SportsPreferencesDTO()
            error = nil
            return true
        } catch {
            self.error = "Couldn't save your teams. Try again."
            return false
        }
    }

    func follow(_ id: String) async {
        guard loaded else { return }
        let teams = preferences.teams ?? []
        let next = teams.contains(id) ? teams.filter { $0 != id } : teams + [id]
        await save(SportsPreferencesDTO(watch: "on", teams: next))
    }

    func hide(_ id: String) async -> Bool {
        await load()
        guard loaded else { return false }
        return await save(SportsPreferencesDTO(hidden: Array(Set((preferences.hidden ?? []) + [id]))))
    }

    func unhide(_ id: String) async {
        await save(SportsPreferencesDTO(hidden: (preferences.hidden ?? []).filter { $0 != id }))
    }

    func toggleLeague(_ id: String) async {
        let leagues = preferences.leagues ?? []
        await save(SportsPreferencesDTO(watch: "on", leagues: leagues.contains(id) ? leagues.filter { $0 != id } : leagues + [id]))
    }
}
