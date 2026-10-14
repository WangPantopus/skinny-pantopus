//
//  PlanPinDTOs.swift
//  Pantopus
//
//  Nearby Plans: the `plans` layer of `GET /api/posts/map` (brief section 5).
//

import Foundation

// MARK: - Map pins

/// One pin from the `plans` layer of `GET /api/posts/map`. The area point
/// for everyone; the exact point for the host and people who are in.
public struct PlanPinDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: PlanKind
    public let latitude: Double
    public let longitude: Double
    public let precision: String?
    public let startsAt: String?
    /// The plan's local day ("2026-10-17"), also while a playdate's time is hidden.
    public let startsOn: String?
    public let dayPart: PlanDayPart
    public let title: String
    public let goingCount: Int
    public let spotsLeft: Int
    public let isFull: Bool
    public let state: PlanState
    public let viewerRole: String?
    public let viewerRequestStatus: PlanRequestStatus?
    public let endsAt: String?
    public let timezone: String?
    public let areaLabel: String?
    public let distanceBand: PlanDistanceBand?

    enum CodingKeys: String, CodingKey {
        case id, kind, latitude, longitude, precision, title, state
        case layerType = "layer_type"
        case startsAt = "starts_at"
        case startsOn = "starts_on"
        case dayPart = "day_part"
        case goingCount = "going_count"
        case spotsLeft = "spots_left"
        case isFull = "is_full"
        case viewerRole = "viewer_role"
        case viewerRequestStatus = "viewer_request_status"
        case endsAt = "ends_at"
        case timezone
        case areaLabel = "area_label"
        case distanceBand = "distance_band"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let layer = try container.decodeIfPresent(String.self, forKey: .layerType)
        guard layer == nil || layer == "plan" else {
            throw DecodingError.dataCorruptedError(forKey: .layerType, in: container, debugDescription: "Not a plan pin")
        }
        id = try container.decode(String.self, forKey: .id)
        kind = try container.decode(PlanKind.self, forKey: .kind)
        latitude = try container.decode(Double.self, forKey: .latitude)
        longitude = try container.decode(Double.self, forKey: .longitude)
        precision = try container.decodeIfPresent(String.self, forKey: .precision)
        startsAt = try container.decodeIfPresent(String.self, forKey: .startsAt)
        startsOn = try container.decodeIfPresent(String.self, forKey: .startsOn)
        dayPart = try container.decodeIfPresent(PlanDayPart.self, forKey: .dayPart) ?? .afternoon
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        goingCount = try container.decodeIfPresent(Int.self, forKey: .goingCount) ?? 0
        spotsLeft = try container.decodeIfPresent(Int.self, forKey: .spotsLeft) ?? 0
        isFull = try container.decodeIfPresent(Bool.self, forKey: .isFull) ?? false
        state = try container.decodeIfPresent(PlanState.self, forKey: .state) ?? .upcoming
        viewerRole = try container.decodeIfPresent(String.self, forKey: .viewerRole)
        viewerRequestStatus = try? container.decodeIfPresent(PlanRequestStatus.self, forKey: .viewerRequestStatus)
        endsAt = try container.decodeIfPresent(String.self, forKey: .endsAt)
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        areaLabel = try container.decodeIfPresent(String.self, forKey: .areaLabel)
        distanceBand = try? container.decodeIfPresent(PlanDistanceBand.self, forKey: .distanceBand)
    }

    public var startsAtDate: Date? {
        PlanTime.parse(startsAt)
    }

    /// The plan's local day, at noon, for "Saturday morning" while the time is hidden (as the card's).
    public var startsOnDate: Date? {
        guard let startsOn else { return startsAtDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timezone.flatMap(TimeZone.init(identifier:)) ?? .current
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: "\(startsOn) 12:00")
    }

    public var isHosting: Bool {
        viewerRole == "host"
    }

    public var isIn: Bool {
        viewerRequestStatus == .accepted
    }

    /// The pin sits on the plan's exact point (the viewer hosts it or is in).
    var isExactPoint: Bool {
        precision == "exact" || isHosting || isIn
    }
}

/// The `plans` layer reply: `{ markers: [...] }`. Rows of other layers, or
/// rows this build can't read, are dropped.
public struct PlanPinsResponse: Decodable, Sendable, Hashable {
    public let markers: [PlanPinDTO]

    enum CodingKeys: String, CodingKey {
        case markers
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        markers = try container.decodeIfPresent(LossyList<PlanPinDTO>.self, forKey: .markers)?.items ?? []
    }

    /// A reply with an exact point is never saved on the phone or shown from a
    /// copy before a re-check, so a removed guest never sees the place again.
    var carriesExactPoints: Bool {
        markers.contains(where: \.isExactPoint)
    }
}
