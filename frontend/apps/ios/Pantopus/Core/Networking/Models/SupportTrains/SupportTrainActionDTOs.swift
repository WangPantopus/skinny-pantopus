//
//  SupportTrainActionDTOs.swift
//  Pantopus
//
//  S1 — request bodies + response shapes for the Support Train write
//  routes wired in `SupportTrainActionsEndpoints.swift`. Every shape was
//  read out of the Joi schema / `res.json(...)` of the matching handler in
//  `backend/routes/supportTrains.js`.
//

import Foundation

// MARK: - Reserve

/// `POST /:id/slots/:slotId/reserve` body — `reserveSchema`
/// (`backend/routes/supportTrains.js:2237`). `contribution_mode` is the
/// only required field; the rest are optional helper detail.
public struct ReserveSlotBody: Encodable, Sendable {
    /// `cook` | `takeout` | `groceries`.
    public let contributionMode: String
    public let dishTitle: String?
    public let restaurantName: String?
    /// ISO-8601 timestamp (`Joi.string().isoDate()`).
    public let estimatedArrivalAt: String?
    public let noteToRecipient: String?
    public let privateNoteToOrganizer: String?

    public init(
        contributionMode: String,
        dishTitle: String? = nil,
        restaurantName: String? = nil,
        estimatedArrivalAt: String? = nil,
        noteToRecipient: String? = nil,
        privateNoteToOrganizer: String? = nil
    ) {
        self.contributionMode = contributionMode
        self.dishTitle = dishTitle
        self.restaurantName = restaurantName
        self.estimatedArrivalAt = estimatedArrivalAt
        self.noteToRecipient = noteToRecipient
        self.privateNoteToOrganizer = privateNoteToOrganizer
    }

    enum CodingKeys: String, CodingKey {
        case contributionMode = "contribution_mode"
        case dishTitle = "dish_title"
        case restaurantName = "restaurant_name"
        case estimatedArrivalAt = "estimated_arrival_at"
        case noteToRecipient = "note_to_recipient"
        case privateNoteToOrganizer = "private_note_to_organizer"
    }
}

/// The three contribution lanes a helper can pick, gated by the train's
/// `support_modes` block. Values match `reserveSchema`'s enum exactly.
public enum SupportTrainContributionMode: String, Sendable, CaseIterable, Hashable {
    case cook
    case takeout
    case groceries

    public var label: String {
        switch self {
        case .cook: "Home-cooked meal"
        case .takeout: "Takeout / delivery"
        case .groceries: "Groceries"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .cook: .utensils
        case .takeout: .truck
        case .groceries: .shoppingBag
        }
    }
}

/// `POST /:id/reservations/:reservationId/cancel` body —
/// `cancelReservationSchema` (`backend/routes/supportTrains.js:2246`).
/// Send `helper_reason` when the helper leaves their own slot and
/// `organizer_reason` when an organizer reopens it.
public struct CancelReservationBody: Encodable, Sendable {
    public let helperReason: String?
    public let organizerReason: String?

    public init(helperReason: String? = nil, organizerReason: String? = nil) {
        self.helperReason = helperReason
        self.organizerReason = organizerReason
    }

    enum CodingKeys: String, CodingKey {
        case helperReason = "helper_reason"
        case organizerReason = "organizer_reason"
    }
}

/// `POST /:id/reservations/:reservationId/reveal-address` response
/// (`backend/routes/supportTrains.js:2893` guest branch / l.2949 helper
/// branch). The address itself is **never** in this payload — the client
/// re-fetches `GET /:id`, which re-runs the privacy gate server-side.
public struct RevealSupportTrainAddressResponse: Decodable, Sendable {
    public let shared: Bool
    public let alreadyShared: Bool?
    public let reservationId: String?
    public let helperUserId: String?
    public let guestEmail: String?

    enum CodingKeys: String, CodingKey {
        case shared
        case alreadyShared = "already_shared"
        case reservationId = "reservation_id"
        case helperUserId = "helper_user_id"
        case guestEmail = "guest_email"
    }
}

// MARK: - Lifecycle

/// `{ id, status }` — the shape every lifecycle route responds with
/// (pause l.1468, resume l.1502, unpublish l.1435, complete l.1535,
/// archive l.1568).
public struct SupportTrainStatusResponse: Decodable, Sendable {
    public let id: String
    public let status: String?
}

/// `DELETE /:id` response (`backend/routes/supportTrains.js:3983`).
public struct SupportTrainDeleteResponse: Decodable, Sendable {
    public let id: String
    public let deleted: Bool?
}

// MARK: - Organizers

/// `POST /:id/organizers` body — `addOrganizerSchema`
/// (`backend/routes/supportTrains.js:1044`). `user_id` must be a UUID and
/// `role` one of `co_organizer` / `recipient_delegate`.
public struct AddSupportTrainOrganizerBody: Encodable, Sendable {
    public let userId: String
    public let role: String

    public init(userId: String, role: String = "co_organizer") {
        self.userId = userId
        self.role = role
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case role
    }
}

/// `GET /:id/organizers` envelope (`backend/routes/supportTrains.js:1169`).
/// Note the nested user arrives as lowercase `user` here (the handler
/// re-shapes Supabase's `User:user_id` alias at l.1159).
public struct SupportTrainOrganizersResponse: Decodable, Sendable {
    public let organizers: [SupportTrainOrganizerRowDTO]
}

/// One row of `GET /:id/organizers`.
public struct SupportTrainOrganizerRowDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let userId: String?
    public let role: String?
    public let createdAt: String?
    public let user: SupportTrainHelperDTO?

    public init(
        id: String,
        userId: String?,
        role: String?,
        createdAt: String? = nil,
        user: SupportTrainHelperDTO?
    ) {
        self.id = id
        self.userId = userId
        self.role = role
        self.createdAt = createdAt
        self.user = user
    }

    enum CodingKeys: String, CodingKey {
        case id, role, user
        case userId = "user_id"
        case createdAt = "created_at"
    }

    /// Best-effort display name for the roster row.
    public var displayName: String {
        user?.name ?? user?.username ?? "Organizer"
    }

    public var isPrimary: Bool {
        role == "primary"
    }
}

// MARK: - Slots

/// `PATCH /:id/slots/:slotId` body — `updateSlotSchema`
/// (`backend/routes/supportTrains.js:1425`). Every field is optional and
/// the object must carry at least one (`.min(1)`); omitted fields are
/// left untouched by the handler.
public struct UpdateSupportTrainSlotBody: Encodable, Sendable {
    public let slotLabel: String?
    public let supportMode: String?
    public let slotDate: String?
    public let startTime: String?
    public let endTime: String?
    public let capacity: Int?
    /// `open` | `canceled` — `canceled` is how the organizer removes a date.
    public let status: String?

    public init(
        slotLabel: String? = nil,
        supportMode: String? = nil,
        slotDate: String? = nil,
        startTime: String? = nil,
        endTime: String? = nil,
        capacity: Int? = nil,
        status: String? = nil
    ) {
        self.slotLabel = slotLabel
        self.supportMode = supportMode
        self.slotDate = slotDate
        self.startTime = startTime
        self.endTime = endTime
        self.capacity = capacity
        self.status = status
    }

    enum CodingKeys: String, CodingKey {
        case slotLabel = "slot_label"
        case supportMode = "support_mode"
        case slotDate = "slot_date"
        case startTime = "start_time"
        case endTime = "end_time"
        case capacity, status
    }
}

// MARK: - Nudges

/// `POST /:id/nudges/draft` response (`backend/routes/supportTrains.js:2191`).
public struct SupportTrainNudgeDraftResponse: Decodable, Sendable {
    public let message: String?
}

/// `POST /:id/nudges/send` body — `nudgeSendSchema`
/// (`backend/routes/supportTrains.js:2134`), 1–1000 chars.
public struct SupportTrainNudgeBody: Encodable, Sendable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: - Gift fund

/// `GET /:id/fund` response (`backend/routes/supportTrains.js:1971`).
/// Amounts are in **cents**.
public struct SupportTrainFundDTO: Decodable, Sendable, Hashable {
    public let enabled: Bool?
    public let currency: String?
    public let goalAmount: Int?
    public let totalAmount: Int?
    public let contributionCount: Int?

    public init(
        enabled: Bool?,
        currency: String?,
        goalAmount: Int?,
        totalAmount: Int?,
        contributionCount: Int?
    ) {
        self.enabled = enabled
        self.currency = currency
        self.goalAmount = goalAmount
        self.totalAmount = totalAmount
        self.contributionCount = contributionCount
    }

    enum CodingKeys: String, CodingKey {
        case enabled, currency
        case goalAmount = "goal_amount"
        case totalAmount = "total_amount"
        case contributionCount = "contribution_count"
    }
}

/// `POST /:id/fund/enable` body — `enableFundSchema`
/// (`backend/routes/supportTrains.js:1686`). `goal_amount` is in cents
/// (1…100000) and omitted entirely when nil.
public struct EnableSupportTrainFundBody: Encodable, Sendable {
    public let goalAmount: Int?

    public init(goalAmount: Int? = nil) {
        self.goalAmount = goalAmount
    }

    enum CodingKeys: String, CodingKey {
        case goalAmount = "goal_amount"
    }
}
