import Foundation

public struct PulseOfferClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String?
    public let note: String?
    public let createdAt: String?
    public let author: PulseAuthorDTO?

    private enum CodingKeys: String, CodingKey {
        case id, status, note, author
        case createdAt = "created_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        status = container.lenient(String.self, forKey: .status)
        note = container.lenient(String.self, forKey: .note)
        createdAt = container.lenient(String.self, forKey: .createdAt)
        author = container.lenient(PulseAuthorDTO.self, forKey: .author)
    }
}

public struct PulseOfferClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [PulseOfferClaimDTO]
    public let offer: PulseOfferDTO?

    private enum CodingKeys: String, CodingKey {
        case claims, offer
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        var identifiers = Set<String>()
        claims = container.lossyList(PulseOfferClaimDTO.self, forKey: .claims)
            .filter { !$0.id.isEmpty && identifiers.insert($0.id).inserted }
        offer = container.lenient(PulseOfferDTO.self, forKey: .offer)
    }
}

public struct PulseOfferClaimResponse: Decodable, Sendable, Hashable {
    public let claim: PulseOfferClaimDTO?
    public let postStatus: PulsePostStatusDTO?

    private enum CodingKeys: String, CodingKey {
        case claim
        case postStatus = "post_status"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        claim = container.lenient(PulseOfferClaimDTO.self, forKey: .claim)
        postStatus = container.lenient(PulsePostStatusDTO.self, forKey: .postStatus)
    }
}
