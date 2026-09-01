//
//  BlockFounderDTOs.swift
//  Pantopus
//
//  Block Founders (Wave 3) — the growth mechanic, three moves deep:
//
//    RANK    a permanent, scarce founding position per geohash-6 cell,
//            assigned first-come on a verified home's first read.
//    METERS  per-section unlock progress. Two different readings by
//            design: `real_rent` counts RENT REPORTS (the only meter a
//            resident moves by asking a neighbor), the others count
//            VERIFIED HOMES.
//    INVITES real postcards to nearby addresses — template-only content
//            the sender never writes, sender anonymized to their street,
//            3/week, and a permanent opt-out on every card.
//
//  Both authed routes are hard T4-gated server-side.
//

import Foundation

/// One unlock meter's progress. `current` is clamped to `needed`
/// server-side, so a full bar is always exactly a full bar.
public struct BlockMeter: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// Server-rendered, e.g. "Real rents on your block".
    public let label: String
    public let current: Int
    public let needed: Int
    public let unlocked: Bool
}

/// The founders panel for a verified occupant.
///
/// Everything past `available` is optional because the unavailable
/// shape is `{ available: false, reason: "NO_COORDINATES" }` — a home
/// we cannot place on a block has no rank, no meters, and no budget.
public struct BlockStatus: Decodable, Sendable, Hashable {
    public let available: Bool
    /// Machine reason when `available` is false, e.g. `NO_COORDINATES`.
    public let reason: String?
    /// 1-based founding order; nil while rank assignment is unavailable.
    public let rank: Int?
    public let establishedAt: String?
    /// Raw verified-homes count — T4 insiders only, by server contract.
    public let verifiedCount: Int?
    /// Rent reports in the cell — the `real_rent` meter's reading.
    public let rentReports: Int?
    public let meters: [BlockMeter]?
    public let invitesRemaining: Int?
    public let invitesWeeklyCap: Int?

    private enum CodingKeys: String, CodingKey {
        case available, reason, rank, meters
        case establishedAt = "established_at"
        case verifiedCount = "verified_count"
        case rentReports = "rent_reports"
        case invitesRemaining = "invites_remaining"
        case invitesWeeklyCap = "invites_weekly_cap"
    }

    public init(
        available: Bool,
        reason: String? = nil,
        rank: Int? = nil,
        establishedAt: String? = nil,
        verifiedCount: Int? = nil,
        rentReports: Int? = nil,
        meters: [BlockMeter]? = nil,
        invitesRemaining: Int? = nil,
        invitesWeeklyCap: Int? = nil
    ) {
        self.available = available
        self.reason = reason
        self.rank = rank
        self.establishedAt = establishedAt
        self.verifiedCount = verifiedCount
        self.rentReports = rentReports
        self.meters = meters
        self.invitesRemaining = invitesRemaining
        self.invitesWeeklyCap = invitesWeeklyCap
    }

    /// The budget after a send is the one the send itself returned — no
    /// refetch, so a momentary read failure can never collapse the panel
    /// the resident is standing in right after their card went out.
    public func withInvitesRemaining(_ remaining: Int) -> BlockStatus {
        BlockStatus(
            available: available,
            reason: reason,
            rank: rank,
            establishedAt: establishedAt,
            verifiedCount: verifiedCount,
            rentReports: rentReports,
            meters: meters,
            invitesRemaining: remaining,
            invitesWeeklyCap: invitesWeeklyCap
        )
    }
}

public struct BlockStatusResponse: Decodable, Sendable {
    public let block: BlockStatus
}

/// The address a card is mailed to. The sender chooses the address and
/// nothing else — the card's words are Pantopus's template.
public struct BlockInviteRecipient: Encodable, Sendable, Hashable {
    public let line1: String
    public let city: String
    /// Two-letter state code; the server rejects anything else.
    public let state: String
    public let zip: String

    public init(line1: String, city: String, state: String, zip: String) {
        self.line1 = line1
        self.city = city
        self.state = state
        self.zip = zip
    }
}

/// `POST` body — the recipient is the whole request.
public struct SendBlockInviteRequest: Encodable, Sendable {
    public let recipient: BlockInviteRecipient

    public init(recipient: BlockInviteRecipient) {
        self.recipient = recipient
    }
}

public struct BlockInviteResult: Decodable, Sendable, Hashable {
    public let sent: Bool
    public let invitesRemaining: Int

    private enum CodingKeys: String, CodingKey {
        case sent
        case invitesRemaining = "invites_remaining"
    }
}
