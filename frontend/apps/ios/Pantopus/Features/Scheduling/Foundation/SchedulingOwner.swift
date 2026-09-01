//
//  SchedulingOwner.swift
//  Pantopus
//
//  Calendarly is ONE owner-polymorphic engine. Every host scheduling route is
//  scoped by an owner. This enum + its helpers encode the single owner-context
//  contract from `reference/calendarly-backend-api.md` — feature streams never
//  hand-roll `owner_type` / `owner_id`; they pass a `SchedulingOwner` to the
//  endpoint builders, which inject the right path/query/body via this type.
//
//    • Personal  → `/api/scheduling/*`, omit owner fields (backend defaults to
//                  `owner_type:'user'` = the signed-in user).
//    • Business  → `/api/scheduling/*` + `owner_type:'business'` + `owner_id`
//                  (query param on GET, body field on writes).
//    • Home      → the `/api/homes/:homeId/scheduling/*` alias; the owner is
//                  implied by the path, so owner fields are NOT sent.
//

import Foundation

/// The owner whose schedule a Calendarly screen is acting on. Drives the API
/// path prefix (`pathPrefix`), GET owner query (`queryItems`), and write-body
/// owner fields (`ownerBody`).
public enum SchedulingOwner: Hashable, Sendable {
    /// The signed-in user (personal pillar). Owner fields omitted.
    case personal
    /// A business the signed-in user manages. `owner_type:'business'` +
    /// `owner_id` are sent on query (GET) / body (writes).
    case business(id: String)
    /// A home the signed-in user belongs to. Owner is implied by `:homeId` in
    /// the path; owner fields are NOT sent.
    case home(homeId: String)

    /// Base path for the host scheduling router. Home uses the per-home alias;
    /// personal/business use the shared `/api/scheduling` mount.
    public var pathPrefix: String {
        switch self {
        case .personal, .business: "/api/scheduling"
        case let .home(homeId): "/api/homes/\(homeId)/scheduling"
        }
    }

    /// Owner-identifying query items for GET reads. Empty for `.personal`
    /// (defaults to the signed-in user) and `.home` (implied by the path).
    public var queryItems: [String: String] {
        switch self {
        case let .business(id): ["owner_type": "business", "owner_id": id]
        case .personal, .home: [:]
        }
    }

    /// Owner-identifying fields to embed in a write body. Business only —
    /// `.personal`/`.home` omit them so the backend resolves the owner from the
    /// token / path. Spliced into the payload by `OwnerScopedBody`.
    public var ownerBody: [String: String] {
        switch self {
        case let .business(id): ["owner_type": "business", "owner_id": id]
        case .personal, .home: [:]
        }
    }

    /// Merge this owner's GET query items with endpoint-specific filters.
    /// Endpoint-specific keys win on the (unexpected) event of a collision.
    public func query(merging extra: [String: String] = [:]) -> [String: String] {
        queryItems.merging(extra) { _, new in new }
    }

    /// Whether the owner participates in Stripe payouts — per-user only.
    /// Homes are not applicable (`GET /payments/status` → `applicable:false`).
    public var supportsPayments: Bool {
        switch self {
        case .personal, .business: true
        case .home: false
        }
    }
}

// MARK: - Owner-scoped write bodies

/// Wraps a typed write payload and folds the owner's `owner_type`/`owner_id`
/// fields (business only) into the TOP LEVEL of the encoded JSON object — so a
/// `POST`/`PUT` body carries both the payload keys and the owner context in one
/// flat object, exactly as the backend expects. Endpoint builders construct
/// this; feature streams just pass the typed payload + owner.
///
/// Encoding strategy: the payload encodes into a keyed container first, then we
/// open a second keyed container (same underlying JSON object) and splice the
/// owner keys in. JSONEncoder shares storage across keyed containers, so the
/// result is a single merged object.
public struct OwnerScopedBody<Payload: Encodable & Sendable>: Encodable, Sendable {
    public let owner: SchedulingOwner
    public let payload: Payload

    public init(owner: SchedulingOwner, payload: Payload) {
        self.owner = owner
        self.payload = payload
    }

    private enum OwnerCodingKeys: String, CodingKey {
        case ownerType = "owner_type"
        case ownerId = "owner_id"
    }

    public func encode(to encoder: any Encoder) throws {
        try payload.encode(to: encoder)
        // Only the business owner contributes `owner_type`/`owner_id`; personal
        // defaults to the signed-in user and home is implied by the path.
        guard case let .business(id) = owner else { return }
        var container = encoder.container(keyedBy: OwnerCodingKeys.self)
        try container.encode("business", forKey: .ownerType)
        try container.encode(id, forKey: .ownerId)
    }
}
