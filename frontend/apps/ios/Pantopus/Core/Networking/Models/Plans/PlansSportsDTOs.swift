import Foundation

public struct PlansSportsDTO: Decodable, Sendable, Hashable {
    public let state: String
    public let canChoose: Bool
    public let attribution: String?

    enum CodingKeys: String, CodingKey {
        case state, attribution
        case canChoose = "can_choose"
    }
}

public struct SportsPreferencesDTO: Codable, Sendable, Hashable {
    public var watch: String?
    public var teams: [String]?
    public var hidden: [String]?
    public var leagues: [String]?

    public init(watch: String? = nil, teams: [String]? = nil, hidden: [String]? = nil, leagues: [String]? = nil) {
        self.watch = watch
        self.teams = teams
        self.hidden = hidden
        self.leagues = leagues
    }
}

public struct PlanTeamDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let label: String
    public let league: String
    public let city: String
    public let state: String
}

public struct PlanTeamsResponse: Decodable, Sendable {
    public let suggested: [PlanTeamDTO]
    public let results: [PlanTeamDTO]
}
