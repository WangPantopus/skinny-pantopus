//
//  PaymentsSchedulingDTOs.swift
//  Pantopus
//
//  DTOs for scheduling payments status + connected calendars — routes
//  `/api/scheduling/payments/status` and `/api/scheduling/connected-calendars*`.
//  Connect is deferred (501 → "coming soon"); reads return empty. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// `GET /payments/status` → Stripe Connect status for the owner. Homes are
/// `applicable:false` (payments are per-user).
public struct PaymentsStatusDTO: Decodable, Sendable, Hashable {
    public let applicable: Bool
    public let connected: Bool
    public let chargesEnabled: Bool?
    public let payoutsEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case applicable
        case connected
        case chargesEnabled = "charges_enabled"
        case payoutsEnabled = "payouts_enabled"
    }
}

/// A connected external calendar (read-only in v1; OAuth sync deferred).
public struct ConnectedCalendarDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let provider: String?
    public let externalAccount: String?
    public let checkConflicts: Bool?
    public let writeTarget: Bool?
    public let status: String?
    public let lastSyncedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case provider
        case externalAccount = "external_account"
        case checkConflicts = "check_conflicts"
        case writeTarget = "write_target"
        case status
        case lastSyncedAt = "last_synced_at"
    }
}

/// `GET /connected-calendars` → `{ calendars }` (empty in v1).
public struct ConnectedCalendarsResponse: Decodable, Sendable, Hashable {
    public let calendars: [ConnectedCalendarDTO]
}
