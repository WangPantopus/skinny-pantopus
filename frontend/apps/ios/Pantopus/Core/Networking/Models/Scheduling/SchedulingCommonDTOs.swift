//
//  SchedulingCommonDTOs.swift
//  Pantopus
//
//  Primitives shared across the Calendarly DTO files: the tz-aware booking
//  slot and the `{ ok: true }` envelope. Defined once here so the public
//  booking flow, host reschedule, and find-a-time surfaces all decode the same
//  slot shape. Every DTO uses explicit `CodingKeys` only where the JSON key
//  differs from the property (APIClient does NOT apply convertFromSnakeCase).
//

import Foundation

/// One bookable slot. Public booking slots are `{ start, end, startLocal }`;
/// host reschedule / find-a-time / who's-free slots add `eligibleHosts` (the
/// member ids that can take this slot). Keys are camelCase in the JSON.
public struct SlotDTO: Decodable, Sendable, Hashable {
    /// ISO-8601 UTC start.
    public let start: String
    /// ISO-8601 UTC end.
    public let end: String
    /// Local ISO rendered in the requested `tz`. Always present on slot reads.
    public let startLocal: String?
    /// Member ids eligible for this slot — host/find-a-time reads only; absent
    /// (nil) on the public invitee slot reads.
    public let eligibleHosts: [String]?

    public init(
        start: String,
        end: String,
        startLocal: String? = nil,
        eligibleHosts: [String]? = nil
    ) {
        self.start = start
        self.end = end
        self.startLocal = startLocal
        self.eligibleHosts = eligibleHosts
    }
}

/// Envelope for the many scheduling endpoints that return `{ ok: true }`.
public struct SchedulingOkResponse: Decodable, Sendable, Hashable {
    public let ok: Bool

    public init(ok: Bool) {
        self.ok = ok
    }
}

/// Envelope for `{ slots: [SlotDTO] }` reads (host available-slots,
/// manage-token available-slots, find-a-time).
public struct SlotsResponse: Decodable, Sendable, Hashable {
    public let slots: [SlotDTO]

    public init(slots: [SlotDTO]) {
        self.slots = slots
    }
}
