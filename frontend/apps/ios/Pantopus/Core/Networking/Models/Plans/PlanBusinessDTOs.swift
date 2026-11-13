//
//  PlanBusinessDTOs.swift
//  Pantopus
//
//  Plans with businesses (docs/product/plans-with-businesses, contract
//  section 5.4): the parts of a plan a verified business hosts. The server
//  sends them only to a request that carries `biz=1`, only to a viewer with
//  `plans_business`, and only for a business that still qualifies, so a
//  neighbor's plan never has any of them: `business` being there is how the
//  app tells the two apart. Step 2 is free: `price` is always null ("Free").
//
//  Route: backend/services/plans/planService.js (`addBusinessFields`) and
//  backend/services/plans/planBusiness.js.
//

import Foundation

/// The business hosting a plan. `host` on the card names it too, never the
/// staff member who posted it (contract B1).
public struct PlanBusinessDTO: Decodable, Sendable, Hashable {
    public let userId: String
    public let name: String
    public let avatarUrl: String?
    /// "Verified business": document or government verified, and published (C1).
    public let verified: Bool
    /// Its public page on the web, or nil.
    public let pageUrl: String?
    /// Plans it hosted that have ended.
    public let plansHosted: Int

    enum CodingKeys: String, CodingKey {
        case name, verified
        case userId = "user_id"
        case avatarUrl = "avatar_url"
        case pageUrl = "page_url"
        case plansHosted = "plans_hosted"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userId = try container.decode(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        verified = try container.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        pageUrl = try container.decodeIfPresent(String.self, forKey: .pageUrl)
        plansHosted = try container.decodeIfPresent(Int.self, forKey: .plansHosted) ?? 0
    }
}

/// The business keys of a plan card (contract 5.4). Decoded from the card's
/// own keys, and only when `business` is there: a neighbor's card (and the
/// private `place` of a neighbor's detail) never reads as a business's.
public struct PlanCardBusinessPart: Decodable, Sendable, Hashable {
    public let business: PlanBusinessDTO
    /// What the business calls its plan: a key ("clinic") and its words ("Clinic").
    public let label: String?
    public let labelText: String?
    /// The business's place, public on its plan: name, street address and point.
    public let place: PlanPlaceDTO?
    /// "Bring a friend" (step 4; shown nowhere yet).
    public let guestsCanInvite: Bool?
    /// The venue's later plans in the list's window, folded under this one.
    public let moreTimes: PlanMoreTimesDTO?

    enum CodingKeys: String, CodingKey {
        case business, label, place
        case labelText = "label_text"
        case guestsCanInvite = "guests_can_invite"
        case moreTimes = "more_times"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        business = try container.decode(PlanBusinessDTO.self, forKey: .business)
        label = try? container.decodeIfPresent(String.self, forKey: .label)
        labelText = try? container.decodeIfPresent(String.self, forKey: .labelText)
        place = try? container.decodeIfPresent(PlanPlaceDTO.self, forKey: .place)
        guestsCanInvite = try? container.decodeIfPresent(Bool.self, forKey: .guestsCanInvite)
        moreTimes = try? container.decodeIfPresent(PlanMoreTimesDTO.self, forKey: .moreTimes)
    }
}

public extension PlanCardDTO {
    /// The business hosting, or nil for a neighbor's plan.
    var business: PlanBusinessDTO? {
        businessPart?.business
    }

    /// A verified business hosts it (Plans with businesses).
    var isBusiness: Bool {
        businessPart != nil
    }

    var label: String? {
        businessPart?.label
    }

    var labelText: String? {
        businessPart?.labelText
    }

    /// A business's place, public on its plan.
    var businessPlace: PlanPlaceDTO? {
        businessPart?.place
    }

    var moreTimes: PlanMoreTimesDTO? {
        businessPart?.moreTimes
    }
}

/// A business's plan on a map pin: its name and whether it is verified.
public struct PlanPinBusinessDTO: Decodable, Sendable, Hashable {
    public let userId: String
    public let name: String
    public let verified: Bool

    enum CodingKeys: String, CodingKey {
        case name, verified
        case userId = "user_id"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userId = try container.decode(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        verified = try container.decodeIfPresent(Bool.self, forKey: .verified) ?? false
    }
}

/// One of a venue's later plans, folded under its soonest one in the list
/// (board P3): "Open play · Sun 2:00 PM".
public struct PlanMoreTimeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let label: String?
    public let labelText: String?
    public let startsAt: String?
    public let timezone: String?

    enum CodingKeys: String, CodingKey {
        case id, title, label, timezone
        case labelText = "label_text"
        case startsAt = "starts_at"
    }

    public var startsAtDate: Date? {
        PlanTime.parse(startsAt)
    }
}

/// A venue's later plans in the list's window: how many, and the first six.
public struct PlanMoreTimesDTO: Decodable, Sendable, Hashable {
    public let count: Int
    public let items: [PlanMoreTimeDTO]

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        count = try container.decodeIfPresent(Int.self, forKey: .count) ?? 0
        items = (try? container.decodeIfPresent(LossyList<PlanMoreTimeDTO>.self, forKey: .items))?.items ?? []
    }

    enum CodingKeys: String, CodingKey {
        case count, items
    }
}

/// `GET /api/businesses/:id/plans?biz=1`: the business's upcoming plans,
/// soonest first, for its page (board B6). Empty for anyone its plans don't
/// exist for. Route backend/routes/businesses.js (`/:businessId/plans`).
public struct BusinessPlansResponse: Decodable, Sendable, Hashable {
    public let items: [PlanCardDTO]
    public let plansHosted: Int

    enum CodingKeys: String, CodingKey {
        case items
        case plansHosted = "plans_hosted"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent(LossyList<PlanCardDTO>.self, forKey: .items)?.items ?? []
        plansHosted = try container.decodeIfPresent(Int.self, forKey: .plansHosted) ?? 0
    }
}
