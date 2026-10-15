import Foundation

public struct PulseMyAreasResponse: Decodable, Sendable, Hashable {
    public let town: PulseAreaDTO?
    public let neighborhood: PulseAreaDTO?
    public let street: PulseAreaDTO?
    public let homeVerified: Bool?

    private enum CodingKeys: String, CodingKey {
        case town, neighborhood, street
        case homeVerified = "home_verified"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        town = container.lenient(PulseAreaDTO.self, forKey: .town)
        neighborhood = container.lenient(PulseAreaDTO.self, forKey: .neighborhood)
        street = container.lenient(PulseAreaDTO.self, forKey: .street)
        homeVerified = container.lenient(Bool.self, forKey: .homeVerified)
    }
}

public struct PulseAreaSearchResponse: Decodable, Sendable, Hashable {
    public let areas: [PulseAreaDTO]

    private enum CodingKeys: String, CodingKey { case areas }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        areas = container.lossyList(PulseAreaDTO.self, forKey: .areas)
    }
}
