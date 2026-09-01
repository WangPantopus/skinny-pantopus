//
//  FindATimeDTOs.swift
//  Pantopus
//
//  DTOs for cross-member scheduling — `find-a-time` (home), `whos-free` (home),
//  and `team-availability` (business). All return tz-aware slots (with
//  `eligibleHosts`) or per-member free grids. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// `POST /find-a-time` → common free slots across members (each slot carries
/// the `eligibleHosts` for it). Reuses `SlotDTO`.
public struct FindATimeResponse: Decodable, Sendable, Hashable {
    public let slots: [SlotDTO]
}

/// Body for `POST /find-a-time`. `member_ids` is a JSON ARRAY (≥1, required).
/// Owner fields (home) are spliced in by the endpoint builder via
/// `OwnerScopedBody` — empty for `.home` since the owner is implied by the path.
public struct FindATimeRequest: Encodable, Sendable {
    public let memberIds: [String]
    /// `collective` | `round_robin` (default `collective` server-side).
    public var mode: String?
    public var durationMin: Int?
    public let from: String
    public let to: String
    public var slotIntervalMin: Int?
    public var timezone: String?

    enum CodingKeys: String, CodingKey {
        case memberIds = "member_ids"
        case mode
        case durationMin = "duration_min"
        case from
        case to
        case slotIntervalMin = "slot_interval_min"
        case timezone
    }

    public init(
        memberIds: [String],
        from: String,
        to: String,
        mode: String? = nil,
        durationMin: Int? = nil,
        slotIntervalMin: Int? = nil,
        timezone: String? = nil
    ) {
        self.memberIds = memberIds
        self.from = from
        self.to = to
        self.mode = mode
        self.durationMin = durationMin
        self.slotIntervalMin = slotIntervalMin
        self.timezone = timezone
    }
}

/// `GET /whos-free` (home) and `GET /team-availability` (business) → per-member
/// free grids: `members` ids + `freeByMember` keyed by member id.
public struct MemberFreeResponse: Decodable, Sendable, Hashable {
    public let members: [String]
    public let freeByMember: [String: [SlotDTO]]
}
