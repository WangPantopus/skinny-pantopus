//
//  PlansDTOs.swift
//  Pantopus
//
//  Nearby Plans: the response shapes of `/api/plans` and the `plans` layer
//  of `GET /api/posts/map` (Plans build brief, section 5). A plan is one
//  `Post` (the public card) plus one `Plan` row; the server sends a
//  `PlanCard` to anyone allowed to see the plan and a `PlanDetail` (the card
//  plus the exact place, the host's note, the people going and the chat) only
//  to the host and the people who are in.
//
//  Privacy (brief section 6): cards and pins are area-only and may use the
//  `nearby` store kind; anything from `PlanDetail` is read with the
//  `sensitive` kind (never saved, always re-checked).
//
//  Enumerations decode leniently: a value this build doesn't know falls back
//  instead of failing the whole reply, and lists drop rows they can't read.
//

import Foundation

// MARK: - Values

/// The four kinds of plan (decision D3).
public enum PlanKind: String, Codable, Sendable, Hashable, CaseIterable, Identifiable {
    case watchParty = "watch_party"
    case playdate
    case pickupGame = "pickup_game"
    case walkCoffee = "walk_coffee"

    public var id: String {
        rawValue
    }
}

/// The part of the day a plan starts in. Always present; a playdate shows
/// only this until the viewer is in.
public enum PlanDayPart: String, Sendable, Hashable {
    case morning, afternoon, evening, night

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlanDayPart(rawValue: raw) ?? .afternoon
    }
}

extension PlanDayPart: Codable {}

/// How far the plan's area is from the viewer, as a band. Never an exact
/// distance (brief section 6).
public enum PlanDistanceBand: String, Codable, Sendable, Hashable {
    case under1Mi = "under_1_mi"
    case about1Mi = "about_1_mi"
    case about2Mi = "about_2_mi"
    case about3Mi = "about_3_mi"
    case about5Mi = "about_5_mi"
}

/// Where the plan is in its life.
public enum PlanState: String, Sendable, Hashable {
    case upcoming, live, ended, cancelled

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlanState(rawValue: raw) ?? .upcoming
    }
}

extension PlanState: Codable {}

/// A public place, or the host's home (never for playdates).
public enum PlanPlaceKind: String, Codable, Sendable, Hashable {
    case publicPlace = "public"
    case home
}

/// One person's request to join, as the server keeps it.
public enum PlanRequestStatus: String, Sendable, Hashable {
    case pending, waitlisted, accepted, declined, withdrawn, left, removed, expired

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlanRequestStatus(rawValue: raw) ?? .pending
    }
}

extension PlanRequestStatus: Codable {}

/// Why the viewer can't ask to join right now.
public enum PlanCannotAskReason: String, Sendable, Hashable {
    case needsVerifiedAddress = "needs_verified_address"
    case tooFar = "too_far"
    case needsLocation = "needs_location"
    case fullUseWaitlist = "full_use_waitlist"
    case declined
    case removed
    case blocked
    case tooManyRequests = "too_many_requests"
    case ended
    case other

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlanCannotAskReason(rawValue: raw) ?? .other
    }
}

extension PlanCannotAskReason: Codable {}

/// The three automatic rules (decision D7).
public enum PlanAutoRule: String, Codable, Sendable, Hashable, CaseIterable {
    case verified
    case hostedBefore = "hosted_before"
    case anyoneNearby = "anyone_nearby"
}

/// Who may ask: anyone with a location nearby, or only verified neighbors.
public enum PlanJoinRequirement: String, Codable, Sendable, Hashable {
    case located, verified
}

/// Kids' age bands for playdates. Ages only, never names.
public enum PlanKidsAgeBand: String, Codable, Sendable, Hashable, CaseIterable, Identifiable {
    case under2 = "under_2"
    case age2to3 = "2_3"
    case age4to5 = "4_5"
    case age6to8 = "6_8"
    case age9to12 = "9_12"

    public var id: String {
        rawValue
    }
}

// MARK: - Plan card

/// The public area of a plan: about 500 m, or about 1 km for playdates.
public struct PlanAreaDTO: Codable, Sendable, Hashable {
    public let label: String
    public let latitude: Double
    public let longitude: Double
    /// `area`, or `neighborhood` for playdates.
    public let precision: String?
    /// "Camas".
    public let city: String?
}

/// The host as everyone sees them: first name and last initial, no ratings.
public struct PlanHostDTO: Codable, Sendable, Hashable {
    public let userId: String?
    public let displayName: String
    public let avatarUrl: String?
    public let verifiedAddress: Bool
    public let plansHosted: Int?
    public let mutualConnections: Int?
    /// Ended plans of this plan's kind ("Hosted 2 playdates").
    public let kindHosted: Int?
    /// How long the host usually takes to answer; nil with too little history.
    public let typicalAnswerMinutes: Int?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case verifiedAddress = "verified_address"
        case plansHosted = "plans_hosted"
        case mutualConnections = "mutual_connections"
        case kindHosted = "kind_hosted"
        case typicalAnswerMinutes = "typical_answer_minutes"
    }
}

/// The viewer's own standing on a plan.
public struct PlanViewerDTO: Codable, Sendable, Hashable {
    /// `none`, `host`, or the viewer's role once they have asked.
    public let role: String?
    public let requestStatus: PlanRequestStatus?
    public let waitlistPosition: Int?
    public let canAsk: Bool
    public let cannotAskReason: PlanCannotAskReason?
    /// The rule that would let this viewer in right now, if any.
    public let autoRule: PlanAutoRule?
    /// The viewer already answered "How was it".
    public let feedbackGiven: Bool?

    enum CodingKeys: String, CodingKey {
        case role
        case requestStatus = "request_status"
        case waitlistPosition = "waitlist_position"
        case canAsk = "can_ask"
        case cannotAskReason = "cannot_ask_reason"
        case autoRule = "auto_rule"
        case feedbackGiven = "feedback_given"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decodeIfPresent(String.self, forKey: .role)
        requestStatus = try? container.decodeIfPresent(PlanRequestStatus.self, forKey: .requestStatus)
        waitlistPosition = try container.decodeIfPresent(Int.self, forKey: .waitlistPosition)
        canAsk = try container.decodeIfPresent(Bool.self, forKey: .canAsk) ?? false
        cannotAskReason = try? container.decodeIfPresent(PlanCannotAskReason.self, forKey: .cannotAskReason)
        autoRule = try? container.decodeIfPresent(PlanAutoRule.self, forKey: .autoRule)
        feedbackGiven = try container.decodeIfPresent(Bool.self, forKey: .feedbackGiven)
    }

    public var isHost: Bool {
        role == "host"
    }

    public var isIn: Bool {
        requestStatus == .accepted
    }
}

/// The game a watch party is for.
public struct PlanGameDTO: Codable, Sendable, Hashable {
    public let label: String
    public let startsAt: String?

    enum CodingKeys: String, CodingKey {
        case label
        case startsAt = "starts_at"
    }

    public init(label: String, startsAt: String?) {
        self.label = label
        self.startsAt = startsAt
    }
}

/// The kind-specific details (`Plan.details`).
public struct PlanDetailsDTO: Codable, Sendable, Hashable {
    public var game: PlanGameDTO?
    public var sport: String?
    public var level: String?
    public var extraGear: Bool?
    public var kidsAgeBands: [PlanKidsAgeBand]?
    public var walkKind: String?
    public var pace: String?
    public var dogsWelcome: Bool?

    enum CodingKeys: String, CodingKey {
        case game, sport, level, pace
        case extraGear = "extra_gear"
        case kidsAgeBands = "kids_age_bands"
        case walkKind = "walk_kind"
        case dogsWelcome = "dogs_welcome"
    }

    public init() {}

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        game = try? container.decodeIfPresent(PlanGameDTO.self, forKey: .game)
        sport = try? container.decodeIfPresent(String.self, forKey: .sport)
        level = try? container.decodeIfPresent(String.self, forKey: .level)
        // Either a flag or a word ("paddles"): any value means "I have extra".
        if let flag = try? container.decodeIfPresent(Bool.self, forKey: .extraGear) {
            extraGear = flag
        } else if let word = try? container.decodeIfPresent(String.self, forKey: .extraGear) {
            extraGear = !word.isEmpty
        }
        let bands = try? container.decodeIfPresent([String].self, forKey: .kidsAgeBands)
        kidsAgeBands = bands?.compactMap(PlanKidsAgeBand.init(rawValue:))
        walkKind = try? container.decodeIfPresent(String.self, forKey: .walkKind)
        pace = try? container.decodeIfPresent(String.self, forKey: .pace)
        dogsWelcome = try? container.decodeIfPresent(Bool.self, forKey: .dogsWelcome)
    }
}

/// `PlanCard`: what anyone allowed to see the plan gets. Area only.
public struct PlanCardDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: PlanKind
    public let title: String
    public let about: String?
    /// Null for a playdate unless the viewer is in or hosting.
    public let startsAt: String?
    public let endsAt: String?
    public let dayPart: PlanDayPart
    public let timezone: String?
    public let area: PlanAreaDTO
    public let distanceBand: PlanDistanceBand?
    public let placeKind: PlanPlaceKind?
    public let host: PlanHostDTO
    public let spots: Int
    public let goingCount: Int
    public let spotsLeft: Int
    public let isFull: Bool
    public let waitlistCount: Int?
    public let details: PlanDetailsDTO?
    /// `host_approves` or `automatic`, for this viewer right now.
    public let howPeopleGetIn: String?
    public let joinRequirement: PlanJoinRequirement?
    public let state: PlanState
    public let viewer: PlanViewerDTO?
    public let shareUrl: String?
    /// Host only: requests waiting for an answer.
    public let requestsCount: Int?
    /// Host only: the plan's automatic rules.
    public let autoRules: [PlanAutoRule]?
    /// The local date ("2026-10-17"), present even when the time is hidden.
    public let startsOn: String?
    /// When asking closes; nil when the time is hidden.
    public let askingClosesAt: String?
    /// The viewer's own request, any status.
    public let myRequest: PlanMyRequestDTO?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, about, timezone, area, host, spots, details, state, viewer
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case dayPart = "day_part"
        case distanceBand = "distance_band"
        case placeKind = "place_kind"
        case goingCount = "going_count"
        case spotsLeft = "spots_left"
        case isFull = "is_full"
        case waitlistCount = "waitlist_count"
        case howPeopleGetIn = "how_people_get_in"
        case joinRequirement = "join_requirement"
        case shareUrl = "share_url"
        case requestsCount = "requests_count"
        case autoRules = "auto_rules"
        case startsOn = "starts_on"
        case askingClosesAt = "asking_closes_at"
        case myRequest = "my_request"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        kind = try container.decode(PlanKind.self, forKey: .kind)
        title = try container.decode(String.self, forKey: .title)
        about = try container.decodeIfPresent(String.self, forKey: .about)
        startsAt = try container.decodeIfPresent(String.self, forKey: .startsAt)
        endsAt = try container.decodeIfPresent(String.self, forKey: .endsAt)
        dayPart = try container.decodeIfPresent(PlanDayPart.self, forKey: .dayPart) ?? .afternoon
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        area = try container.decode(PlanAreaDTO.self, forKey: .area)
        distanceBand = try? container.decodeIfPresent(PlanDistanceBand.self, forKey: .distanceBand)
        placeKind = try? container.decodeIfPresent(PlanPlaceKind.self, forKey: .placeKind)
        host = try container.decode(PlanHostDTO.self, forKey: .host)
        spots = try container.decodeIfPresent(Int.self, forKey: .spots) ?? 0
        goingCount = try container.decodeIfPresent(Int.self, forKey: .goingCount) ?? 0
        spotsLeft = try container.decodeIfPresent(Int.self, forKey: .spotsLeft) ?? 0
        isFull = try container.decodeIfPresent(Bool.self, forKey: .isFull) ?? false
        waitlistCount = try container.decodeIfPresent(Int.self, forKey: .waitlistCount)
        details = try? container.decodeIfPresent(PlanDetailsDTO.self, forKey: .details)
        howPeopleGetIn = try container.decodeIfPresent(String.self, forKey: .howPeopleGetIn)
        joinRequirement = try? container.decodeIfPresent(PlanJoinRequirement.self, forKey: .joinRequirement)
        state = try container.decodeIfPresent(PlanState.self, forKey: .state) ?? .upcoming
        viewer = try? container.decodeIfPresent(PlanViewerDTO.self, forKey: .viewer)
        shareUrl = try container.decodeIfPresent(String.self, forKey: .shareUrl)
        requestsCount = try container.decodeIfPresent(Int.self, forKey: .requestsCount)
        let rules = try? container.decodeIfPresent([String].self, forKey: .autoRules)
        autoRules = rules?.compactMap(PlanAutoRule.init(rawValue:))
        startsOn = try container.decodeIfPresent(String.self, forKey: .startsOn)
        askingClosesAt = try container.decodeIfPresent(String.self, forKey: .askingClosesAt)
        myRequest = try? container.decodeIfPresent(PlanMyRequestDTO.self, forKey: .myRequest)
    }

    /// The exact start, parsed. Nil when hidden (a playdate before you're in).
    public var startsAtDate: Date? {
        PlanTime.parse(startsAt)
    }

    public var endsAtDate: Date? {
        PlanTime.parse(endsAt)
    }

    /// The plan's local day, at noon, for "Saturday morning" while the time is hidden.
    public var startsOnDate: Date? {
        guard let startsOn else { return startsAtDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timezone.flatMap(TimeZone.init(identifier:)) ?? .current
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: "\(startsOn) 12:00")
    }

    /// A playdate whose exact time this card carries (the viewer is in or hosting).
    var carriesPrivateTime: Bool {
        kind == .playdate && startsAt != nil
    }
}

// MARK: - Lists

/// `GET /api/plans`: the list under the map, soonest first.
public struct PlansListResponse: Decodable, Sendable, Hashable {
    public let items: [PlanCardDTO]
    public let nextCursor: String?
    /// When the page is empty: the closest town with plans 5 to 15 miles away (F4).
    public let nearestElsewhere: PlansNearestElsewhere?

    enum CodingKeys: String, CodingKey {
        case items
        case nextCursor = "next_cursor"
        case nearestElsewhere = "nearest_elsewhere"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .items)?.items ?? []
        nextCursor = try container.decodeIfPresent(String.self, forKey: .nextCursor)
        nearestElsewhere = try? container.decodeIfPresent(PlansNearestElsewhere.self, forKey: .nearestElsewhere)
    }

    var carriesPrivateTimes: Bool {
        items.contains(where: \.carriesPrivateTime)
    }
}

/// "2 plans in Washougal, 4 mi away" (whole miles, to public area points).
public struct PlansNearestElsewhere: Decodable, Sendable, Hashable {
    public let city: String
    public let count: Int
    public let miles: Int
}

/// `GET /api/plans/mine`: the viewer's own plans, for "Your plans" and Today.
public struct MyPlansResponse: Decodable, Sendable, Hashable {
    public let hosting: [PlanCardDTO]
    public let going: [PlanCardDTO]
    public let asked: [PlanCardDTO]
    public let waitlisted: [PlanCardDTO]
    /// Ended in the last 2 days, hosted or in (A5).
    public let recent: [PlanCardDTO]
    /// The viewer's own standing.
    public let viewer: MyPlansViewer?

    enum CodingKeys: String, CodingKey {
        case hosting, going, asked, waitlisted, recent, viewer
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hosting = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .hosting)?.items ?? []
        going = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .going)?.items ?? []
        asked = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .asked)?.items ?? []
        waitlisted = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .waitlisted)?.items ?? []
        recent = try container.decodeIfPresent(PlanLossyList<PlanCardDTO>.self, forKey: .recent)?.items ?? []
        viewer = try? container.decodeIfPresent(MyPlansViewer.self, forKey: .viewer)
    }

    public var isEmpty: Bool {
        hosting.isEmpty && going.isEmpty && asked.isEmpty && waitlisted.isEmpty
    }

    var carriesPrivateTimes: Bool {
        (hosting + going + asked + waitlisted + recent).contains(where: \.carriesPrivateTime)
    }
}

// MARK: - Helpers

/// Decodes an array, dropping the elements it can't read.
struct PlanLossyList<Element: Decodable & Sendable>: Decodable {
    let items: [Element]

    init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var items: [Element] = []
        while !container.isAtEnd {
            if let item = try? container.decode(Element.self) {
                items.append(item)
            } else {
                _ = try? container.decode(PlanSkippedValue.self)
            }
        }
        self.items = items
    }
}

/// Consumes one value of any shape.
private struct PlanSkippedValue: Decodable {}

/// ISO 8601 times from the Plans API, with or without fractional seconds.
enum PlanTime {
    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    static func string(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }
}
