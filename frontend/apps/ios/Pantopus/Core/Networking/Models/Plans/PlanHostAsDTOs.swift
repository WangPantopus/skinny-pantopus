//
//  PlanHostAsDTOs.swift
//  Pantopus
//
//  Plans with businesses, board B1: "Host as you or your business". The
//  businesses this person may post a plan for (`GET /api/plans/host-as?biz=1`):
//  verified, published, with `plans_business`, at least one location a plan
//  can meet at, and a team role that holds `plans.post`. Empty for nearly
//  everyone, and always without `biz=1`; the composer shows "Host as" only
//  when it isn't. Route backend/routes/plans.js (`GET /host-as`),
//  backend/services/plans/planBusiness.js (`hostAsFor`).
//

import Foundation

/// One label a business may give a plan of this kind ("Clinic").
public struct PlanBusinessLabelDTO: Decodable, Sendable, Hashable, Identifiable {
    public let key: String
    public let text: String

    public var id: String {
        key
    }
}

/// A kind as a business posts it: its name for a business ("Sports") and its labels.
public struct PlanBusinessKindDTO: Decodable, Sendable, Hashable {
    public let kind: PlanKind
    public let name: String
    public let labels: [PlanBusinessLabelDTO]
}

/// One of the business's own locations a plan can meet at (a storefront, an office or a warehouse on the map).
public struct PlanBusinessLocationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String?
    public let isPrimary: Bool
    /// "410 NE 4th Ave, Camas".
    public let address: String?
    public let latitude: Double
    public let longitude: Double

    enum CodingKeys: String, CodingKey {
        case id, label, address, latitude, longitude
        case isPrimary = "is_primary"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        isPrimary = try container.decodeIfPresent(Bool.self, forKey: .isPrimary) ?? false
        address = try container.decodeIfPresent(String.self, forKey: .address)
        latitude = try container.decode(Double.self, forKey: .latitude)
        longitude = try container.decode(Double.self, forKey: .longitude)
    }
}

/// What a business may post: up to 30 spots, up to 60 days ahead.
public struct PlanBusinessLimitsDTO: Decodable, Sendable, Hashable {
    public let spotsMax: Int
    public let daysAhead: Int

    enum CodingKeys: String, CodingKey {
        case spotsMax = "spots_max"
        case daysAhead = "days_ahead"
    }
}

/// A business this person may host a plan as.
public struct PlanHostAsBusinessDTO: Decodable, Sendable, Hashable, Identifiable {
    public let userId: String
    public let name: String
    public let avatarUrl: String?
    public let verified: Bool
    public let kinds: [PlanBusinessKindDTO]
    public let locations: [PlanBusinessLocationDTO]
    public let limits: PlanBusinessLimitsDTO

    public var id: String {
        userId
    }

    enum CodingKeys: String, CodingKey {
        case name, verified, kinds, locations, limits
        case userId = "user_id"
        case avatarUrl = "avatar_url"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userId = try container.decode(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        verified = try container.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        // A kind this build doesn't know is left out, not the whole business.
        kinds = (try? container.decodeIfPresent(LossyList<PlanBusinessKindDTO>.self, forKey: .kinds))?.items ?? []
        locations = (try? container.decodeIfPresent(LossyList<PlanBusinessLocationDTO>.self, forKey: .locations))?.items ?? []
        limits = (try? container.decodeIfPresent(PlanBusinessLimitsDTO.self, forKey: .limits))
            ?? PlanBusinessLimitsDTO(spotsMax: 30, daysAhead: 60)
    }

    /// The kind as this business posts it, if it may.
    func kind(_ kind: PlanKind) -> PlanBusinessKindDTO? {
        kinds.first { $0.kind == kind }
    }

    /// The location a new plan starts at: the main one, else the first.
    var primaryLocation: PlanBusinessLocationDTO? {
        locations.first(where: \.isPrimary) ?? locations.first
    }
}

/// `GET /api/plans/host-as`.
public struct PlanHostAsResponse: Decodable, Sendable, Hashable {
    public let businesses: [PlanHostAsBusinessDTO]

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        businesses = (try? container.decodeIfPresent(LossyList<PlanHostAsBusinessDTO>.self, forKey: .businesses))?.items ?? []
    }

    enum CodingKeys: String, CodingKey {
        case businesses
    }
}

/// `host_as` on `POST /api/plans`: the business the plan is posted for.
public struct PlanHostAsBody: Encodable, Sendable, Hashable {
    public let businessUserId: String

    enum CodingKeys: String, CodingKey {
        case businessUserId = "business_user_id"
    }

    public init(businessUserId: String) {
        self.businessUserId = businessUserId
    }
}
