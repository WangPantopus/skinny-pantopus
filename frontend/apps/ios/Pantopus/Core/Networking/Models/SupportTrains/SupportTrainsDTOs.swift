//
//  SupportTrainsDTOs.swift
//  Pantopus
//
//  T6.6c (P26.5) — Decoder shapes for the Support Trains list feeds
//  (My trains / Nearby) + the organizer-only reservations feed
//  (Review-signups).
//
//  Backend ground-truth verified against
//  `backend/routes/supportTrains.js` at the line ranges noted on each
//  endpoint helper in `SupportTrainsEndpoints.swift`. The shapes below
//  only model the columns the current `/me/support-trains` (l.475–565),
//  `/nearby` (l.570+) and `/:id/reservations` (l.3306+) handlers
//  actually project — additional UI fields (slot progress, drop window,
//  diet flags, conflict markers, recipient display name) are documented
//  inline as **follow-up backend prep** so the next change is additive.
//

import Foundation

// MARK: - List feeds

/// `GET /api/support-trains/me/support-trains` envelope.
public struct SupportTrainsListResponse: Decodable, Sendable {
    public let supportTrains: [SupportTrainListItemDTO]
    public let total: Int?
    public let limit: Int?
    public let offset: Int?

    enum CodingKeys: String, CodingKey {
        case supportTrains = "support_trains"
        case total, limit, offset
    }
}

/// `GET /api/support-trains/nearby` envelope. The nearby RPC
/// (`list_support_trains_nearby`) returns a richer payload (includes
/// recipient + distance); the My-trains feed projects a smaller subset.
/// We decode through a shared shape and let the optional fields stay
/// `nil` for the lighter feed.
public struct SupportTrainsNearbyResponse: Decodable, Sendable {
    public let supportTrains: [SupportTrainListItemDTO]

    enum CodingKeys: String, CodingKey {
        case supportTrains = "support_trains"
    }
}

/// One Support Train row, as rendered in My-trains / Nearby.
///
/// Backend wire shape (verified at `supportTrains.js:534–558`):
/// ```json
/// {
///   "id": "...", "title": "...", "status": "...",
///   "published_at": "...", "created_at": "...",
///   "my_role": "organizer" | "co_organizer" | "helper"
/// }
/// ```
///
/// Every additional field below is **populated by the Nearby RPC only**
/// (`list_support_trains_nearby` returns recipient + slot aggregates
/// + distance). Both feeds decode through this single shape — fields
/// missing from the My-trains shape stay `nil` and the VM degrades
/// gracefully. A follow-up backend prep adds `slots_filled`,
/// `slots_total`, `support_train_type`, `starts_on`, `ends_on`, and
/// `recipient_name` to the My-trains projection so both feeds light up
/// equally; until then the My-trains row renders title + status + role
/// chip + a generic archetype tile.
public struct SupportTrainListItemDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let title: String?
    public let status: String?
    public let publishedAt: String?
    public let createdAt: String?
    /// `organizer` / `co_organizer` / `helper` — present on the
    /// My-trains feed only.
    public let myRole: String?

    // ── Nearby-RPC fields (follow-up backend-prep extends My-trains) ──
    /// `meal_support` / `ride_support` / `childcare` / `pet_care` /
    /// `errand_support` / `visit_support`. Nil until the My-trains
    /// projection adds it.
    public let supportTrainType: String?
    public let startsOn: String?
    public let endsOn: String?
    public let slotsFilled: Int?
    public let slotsTotal: Int?
    /// Metres — nearby feed only.
    public let distanceMeters: Double?
    public let recipientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, status
        case publishedAt = "published_at"
        case createdAt = "created_at"
        case myRole = "my_role"
        case supportTrainType = "support_train_type"
        case startsOn = "starts_on"
        case endsOn = "ends_on"
        case slotsFilled = "slots_filled"
        case slotsTotal = "slots_total"
        case distanceMeters = "distance_meters"
        case recipientName = "recipient_name"
    }
}

// MARK: - Reservations feed (Review-signups)

/// `GET /api/support-trains/:id/reservations` envelope.
public struct SupportTrainReservationsResponse: Decodable, Sendable {
    public let reservations: [SupportTrainReservationDTO]

    enum CodingKeys: String, CodingKey {
        case reservations
    }
}

/// One helper reservation row, as rendered on Review-signups.
///
/// Backend wire shape (verified at `supportTrains.js:3349–3357`):
/// ```json
/// {
///   "id": "...", "slot_id": "...", "user_id": "...",
///   "guest_name": null, "guest_email": null,
///   "status": "pending" | "confirmed" | "canceled",
///   "contribution_mode": "meal" | "restaurant" | "...",
///   "dish_title": "Veggie chili...", "restaurant_name": null,
///   "estimated_arrival_at": "2025-10-22T18:00:00Z",
///   "note_to_recipient": "I'll knock when I'm there",
///   "private_note_to_organizer": "Vegetarian only",
///   "created_at": "...", "updated_at": "...", "canceled_at": null,
///   "User": { "id": "...", "username": "lena", "name": "Lena Park",
///             "profile_picture_url": "..." }
/// }
/// ```
///
/// Diet flag / conflict marker / explicit edited-at / helper
/// relationship — the four UI conveniences in the design — are **not**
/// projected by the current handler. A follow-up backend prep adds:
///   - `edited_at` (or we derive client-side via `updatedAt != createdAt`)
///   - `conflict_with` (denormalised from `support_train_slot_availability`)
///   - `User.is_verified` + `User.relationship_to_recipient`
///   - `diet_flag` / `diet_ok` (joined from `SupportTrainRecipientProfile`)
///
/// Until then the row falls back gracefully: relationship chip hides,
/// diet flag is omitted, conflict strip never fires, "Edited" is
/// computed client-side from `updatedAt != createdAt`.
public struct SupportTrainReservationDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let slotId: String?
    public let userId: String?
    public let guestName: String?
    public let status: String?
    public let contributionMode: String?
    /// Dish title (meal trains) — what the helper is bringing.
    public let dishTitle: String?
    public let restaurantName: String?
    /// ISO-8601 timestamp; the design's "Drop 6:00–6:30 pm" is derived
    /// from this on the client.
    public let estimatedArrivalAt: String?
    /// The reservation note shown to the recipient (the design's
    /// "italic body" line).
    public let noteToRecipient: String?
    /// The organizer-only sidebar note. Renders as a small subtitle
    /// under the public note when set.
    public let privateNoteToOrganizer: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let canceledAt: String?
    /// Email-only (guest) signup address — organizers email the exact
    /// address to this address instead of granting in-app access.
    public let guestEmail: String?
    /// True once the organizer has shared the exact address with this
    /// helper (`SupportTrainAddressGrant`) or emailed the guest
    /// (`backend/routes/supportTrains.js:3415`).
    public let exactAddressShared: Bool?
    /// The handler responds with a lowercase `user` object
    /// (`backend/routes/supportTrains.js:3418`); the capitalised `User`
    /// Supabase alias is still accepted so older fixtures decode.
    public let helper: SupportTrainHelperDTO?

    /// Memberwise init for optimistic patches. Declared in the struct
    /// body (not an extension) so the auto-synthesised memberwise init
    /// is suppressed — otherwise the two collide.
    public init(
        id: String,
        slotId: String?,
        userId: String?,
        guestName: String?,
        status: String?,
        contributionMode: String?,
        dishTitle: String?,
        restaurantName: String?,
        estimatedArrivalAt: String?,
        noteToRecipient: String?,
        privateNoteToOrganizer: String?,
        createdAt: String?,
        updatedAt: String?,
        canceledAt: String?,
        helper: SupportTrainHelperDTO?,
        guestEmail: String? = nil,
        exactAddressShared: Bool? = nil
    ) {
        self.id = id
        self.slotId = slotId
        self.userId = userId
        self.guestName = guestName
        self.status = status
        self.contributionMode = contributionMode
        self.dishTitle = dishTitle
        self.restaurantName = restaurantName
        self.estimatedArrivalAt = estimatedArrivalAt
        self.noteToRecipient = noteToRecipient
        self.privateNoteToOrganizer = privateNoteToOrganizer
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.canceledAt = canceledAt
        self.helper = helper
        self.guestEmail = guestEmail
        self.exactAddressShared = exactAddressShared
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        slotId = try container.decodeIfPresent(String.self, forKey: .slotId)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        guestName = try container.decodeIfPresent(String.self, forKey: .guestName)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        contributionMode = try container.decodeIfPresent(String.self, forKey: .contributionMode)
        dishTitle = try container.decodeIfPresent(String.self, forKey: .dishTitle)
        restaurantName = try container.decodeIfPresent(String.self, forKey: .restaurantName)
        estimatedArrivalAt = try container.decodeIfPresent(String.self, forKey: .estimatedArrivalAt)
        noteToRecipient = try container.decodeIfPresent(String.self, forKey: .noteToRecipient)
        privateNoteToOrganizer = try container.decodeIfPresent(
            String.self,
            forKey: .privateNoteToOrganizer
        )
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        canceledAt = try container.decodeIfPresent(String.self, forKey: .canceledAt)
        guestEmail = try container.decodeIfPresent(String.self, forKey: .guestEmail)
        exactAddressShared = try container.decodeIfPresent(Bool.self, forKey: .exactAddressShared)
        let lowercase = try container.decodeIfPresent(SupportTrainHelperDTO.self, forKey: .helper)
        helper = try lowercase
            ?? container.decodeIfPresent(SupportTrainHelperDTO.self, forKey: .legacyHelper)
    }

    enum CodingKeys: String, CodingKey {
        case id, status
        case slotId = "slot_id"
        case userId = "user_id"
        case guestName = "guest_name"
        case guestEmail = "guest_email"
        case contributionMode = "contribution_mode"
        case dishTitle = "dish_title"
        case restaurantName = "restaurant_name"
        case estimatedArrivalAt = "estimated_arrival_at"
        case noteToRecipient = "note_to_recipient"
        case privateNoteToOrganizer = "private_note_to_organizer"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case canceledAt = "canceled_at"
        case exactAddressShared = "exact_address_shared"
        case helper = "user"
        case legacyHelper = "User"
    }

    /// Guest (email-only) signups have no linked account — organizers
    /// email them the address instead of granting in-app access.
    public var isGuestSignup: Bool {
        userId == nil && (guestName != nil || guestEmail != nil)
    }

    /// Returns `true` when `updatedAt > createdAt` — used by the VM to
    /// project the "Edited" chip without a backend column.
    public var wasEdited: Bool {
        guard let updated = updatedAt, let created = createdAt else { return false }
        return updated != created
    }

    /// Best-effort display name. Falls back through `helper.name` →
    /// `helper.username` → `guest_name` → "Helper".
    public var displayName: String {
        helper?.name ?? helper?.username ?? guestName ?? "Helper"
    }
}

// MARK: - Create / launch (P2.6 — Start-a-Support-Train wizard)

/// `POST /api/support-trains/` body. The backend's
/// `createSupportTrainSchema` accepts a free-form `draft_payload` JSONB
/// blob for fields that aren't first-class columns (e.g. recipient
/// profile context); we only ride the `story` slot so the reason copy
/// survives the round-trip onto the published-train detail screen.
public struct CreateSupportTrainBody: Encodable, Sendable {
    public let draftPayload: DraftPayload
    public let title: String
    public let recipientUserId: String?
    public let sharingMode: String
    public let enableHomeCookedMeals: Bool
    public let enableTakeout: Bool
    public let enableGroceries: Bool
    public let enableGiftFunds: Bool
    public let timezone: String

    public init(
        draftPayload: DraftPayload,
        title: String,
        recipientUserId: String?,
        sharingMode: String,
        enableHomeCookedMeals: Bool = true,
        enableTakeout: Bool = true,
        enableGroceries: Bool = true,
        enableGiftFunds: Bool = false,
        timezone: String = TimeZone.current.identifier
    ) {
        self.draftPayload = draftPayload
        self.title = title
        self.recipientUserId = recipientUserId
        self.sharingMode = sharingMode
        self.enableHomeCookedMeals = enableHomeCookedMeals
        self.enableTakeout = enableTakeout
        self.enableGroceries = enableGroceries
        self.enableGiftFunds = enableGiftFunds
        self.timezone = timezone
    }

    enum CodingKeys: String, CodingKey {
        case draftPayload = "draft_payload"
        case title
        case recipientUserId = "recipient_user_id"
        case sharingMode = "sharing_mode"
        case enableHomeCookedMeals = "enable_home_cooked_meals"
        case enableTakeout = "enable_takeout"
        case enableGroceries = "enable_groceries"
        case enableGiftFunds = "enable_gift_funds"
        case timezone
    }

    public struct DraftPayload: Encodable, Sendable {
        public let story: String?

        public init(story: String?) {
            self.story = story
        }
    }
}

/// `POST /api/support-trains/` response envelope. Only the `id`
/// matters for the wizard launch flow — the host pushes the new
/// train's review-signups screen immediately after publish.
public struct CreateSupportTrainResponse: Decodable, Sendable {
    public let id: String

    public init(id: String) {
        self.id = id
    }
}

/// `POST /api/support-trains/:id/slots` body. Backend validation lives
/// at `customSlotSchema` (`supportTrains.js:404`).
public struct AddSupportTrainSlotBody: Encodable, Sendable {
    public let slotDate: String
    public let slotLabel: String
    public let supportMode: String
    public let startTime: String?
    public let endTime: String?
    public let capacity: Int

    public init(
        slotDate: String,
        slotLabel: String,
        supportMode: String,
        startTime: String?,
        endTime: String?,
        capacity: Int = 1
    ) {
        self.slotDate = slotDate
        self.slotLabel = slotLabel
        self.supportMode = supportMode
        self.startTime = startTime
        self.endTime = endTime
        self.capacity = capacity
    }

    enum CodingKeys: String, CodingKey {
        case slotDate = "slot_date"
        case slotLabel = "slot_label"
        case supportMode = "support_mode"
        case startTime = "start_time"
        case endTime = "end_time"
        case capacity
    }
}

public struct SupportTrainHelperDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    public init(
        id: String,
        username: String?,
        name: String?,
        profilePictureUrl: String?
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePictureUrl = profilePictureUrl
    }

    enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureUrl = "profile_picture_url"
    }
}
