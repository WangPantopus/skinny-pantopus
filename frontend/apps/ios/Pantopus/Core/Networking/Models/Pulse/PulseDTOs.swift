//
//  PulseDTOs.swift
//  Pantopus
//
//  Shapes of the Pulse build's own routes under `/api/pulse`
//  (docs/product/pulse-build/02-contract.md). Every field is read leniently:
//  older servers leave fields out (Pulse S2).
//

import Foundation

/// `post_status` in the keep-open and close replies (contract §2.12).
public struct PulsePostStatusDTO: Decodable, Sendable, Hashable {
    public let state: String?
    public let resolution: String?
    public let endsAt: String?

    private enum CodingKeys: String, CodingKey {
        case state, resolution
        case endsAt = "ends_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        state = c.lenient(String.self, forKey: .state)
        resolution = c.lenient(String.self, forKey: .resolution)
        endsAt = c.lenient(String.self, forKey: .endsAt)
    }
}

/// Reply to keep-open and close.
public struct PulseAskActionResponse: Decodable, Sendable, Hashable {
    public let postStatus: PulsePostStatusDTO?

    private enum CodingKeys: String, CodingKey {
        case postStatus = "post_status"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        postStatus = c.lenient(PulsePostStatusDTO.self, forKey: .postStatus)
    }
}
