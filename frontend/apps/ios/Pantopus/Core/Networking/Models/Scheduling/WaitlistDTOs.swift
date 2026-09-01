//
//  WaitlistDTOs.swift
//  Pantopus
//
//  DTOs for host waitlist management — routes
//  `/api/scheduling/event-types/:id/waitlist` (list) and `/api/scheduling/
//  waitlist/:id/promote`. The public join surface lives in PublicBookingDTOs.
//  See `reference/calendarly-backend-api.md`.
//

import Foundation

/// A waitlist entry for an event type.
public struct WaitlistEntryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let eventTypeId: String?
    public let inviteeName: String?
    public let inviteeEmail: String?
    public let inviteeUserId: String?
    /// `waiting` | `promoted`.
    public let status: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case eventTypeId = "event_type_id"
        case inviteeName = "invitee_name"
        case inviteeEmail = "invitee_email"
        case inviteeUserId = "invitee_user_id"
        case status
        case createdAt = "created_at"
    }
}

/// `GET /event-types/:id/waitlist` → `{ waitlist }`.
public struct WaitlistResponse: Decodable, Sendable, Hashable {
    public let waitlist: [WaitlistEntryDTO]
}
