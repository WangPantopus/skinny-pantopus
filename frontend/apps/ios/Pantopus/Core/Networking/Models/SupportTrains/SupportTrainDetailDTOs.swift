//
//  SupportTrainDetailDTOs.swift
//  Pantopus
//
//  Decoder shapes for `GET /api/support-trains/:id` (A10.9 Detail /
//  A13.13 Manage) plus the `POST /:id/updates` body. Split out of
//  SupportTrainsDTOs.swift to stay under SwiftLint's file_length budget;
//  see `SupportTrainsEndpoints.detail` / `.postUpdate`.
//

import Foundation

// MARK: - Detail (A10.9 Support Train Detail · A13.13 Manage)

/// `GET /api/support-trains/:id` envelope (verified against
/// `backend/routes/supportTrains.js:3444` — the handler builds this
/// response at l.3650–3782). Privacy-gated: `slots` / `my_reservations`
/// / `updates` / `organizers` come back scoped to `viewer_level`.
///
/// **Projection gaps (documented, degrade gracefully):** the detail
/// handler returns each slot's `filled_count` / `capacity` but *not* the
/// helper or dish that covered it (that lives on the organizer-only
/// `/:id/reservations` feed), and there is no recipient identity tag /
/// verified flag / contributor roster. The Detail VM therefore renders
/// covered slots without a dish author, derives the contributor strip
/// from `organizers`, and defaults the recipient identity to `.home`.
public struct SupportTrainDetailDTO: Decodable, Sendable {
    public let id: String
    public let activityId: String?
    public let title: String?
    public let story: String?
    public let status: String?
    public let publishedAt: String?
    public let sharingMode: String?
    public let supportModes: SupportTrainModesDTO?
    public let recipientSummary: String?
    public let householdSize: Int?
    public let dietaryRestrictions: [String]?
    public let dietaryPreferences: [String]?
    public let contactlessPreferred: Bool?
    public let preferredDropoffWindow: SupportTrainDropoffWindowDTO?
    public let summaryChips: [String]?
    public let slots: [SupportTrainSlotDTO]?
    public let myReservations: [SupportTrainMyReservationDTO]?
    public let updates: [SupportTrainUpdateDTO]?
    public let organizers: [SupportTrainOrganizerDTO]?
    public let viewerLevel: String?
    public let viewerSupportTrainRole: String?
    public let exactAddressShared: Bool?
    public let coarseLocation: SupportTrainCoarseLocationDTO?
    /// Exact street address — **only present when the server decides the
    /// viewer may see it** (organizer / recipient / a helper the organizer
    /// granted, `backend/routes/supportTrains.js:3704`). Never derived or
    /// cached client-side: when a reveal succeeds the screen re-fetches
    /// `GET /:id` and re-reads this field.
    public let address: SupportTrainAddressDTO?
    public let deliveryInstructions: String?
    public let specialInstructions: String?
    /// Organizer-only echo of the parent Activity's visibility
    /// (`backend/routes/supportTrains.js:3699`).
    public let activityVisibility: String?

    enum CodingKeys: String, CodingKey {
        case id, title, story, status, slots, updates, organizers
        case activityId = "activity_id"
        case publishedAt = "published_at"
        case sharingMode = "sharing_mode"
        case supportModes = "support_modes"
        case recipientSummary = "recipient_summary"
        case householdSize = "household_size"
        case dietaryRestrictions = "dietary_restrictions"
        case dietaryPreferences = "dietary_preferences"
        case contactlessPreferred = "contactless_preferred"
        case preferredDropoffWindow = "preferred_dropoff_window"
        case summaryChips = "summary_chips"
        case myReservations = "my_reservations"
        case viewerLevel = "viewer_level"
        case viewerSupportTrainRole = "viewer_support_train_role"
        case exactAddressShared = "exact_address_shared"
        case coarseLocation = "coarse_location"
        case address
        case deliveryInstructions = "delivery_instructions"
        case specialInstructions = "special_instructions"
        case activityVisibility = "activity_visibility"
    }

    /// `primary` / `co_organizer` / `recipient_delegate` hold organizer
    /// powers; the backend gates every management route on exactly this
    /// set (`backend/middleware/supportTrainPermissions.js:51`).
    public var viewerIsOrganizer: Bool {
        viewerLevel == "organizer"
    }

    /// Only the primary organizer may unpublish / archive / delete the
    /// train or edit the co-organizer roster.
    public var viewerIsPrimaryOrganizer: Bool {
        viewerSupportTrainRole == "primary"
    }
}

/// Exact delivery address (`backend/routes/supportTrains.js:3727`).
public struct SupportTrainAddressDTO: Decodable, Sendable, Hashable {
    public let address: String?
    public let unitNumber: String?
    public let city: String?
    public let state: String?
    public let zipCode: String?

    public init(
        address: String?,
        unitNumber: String?,
        city: String?,
        state: String?,
        zipCode: String?
    ) {
        self.address = address
        self.unitNumber = unitNumber
        self.city = city
        self.state = state
        self.zipCode = zipCode
    }

    enum CodingKeys: String, CodingKey {
        case address, city, state
        case unitNumber = "unit_number"
        case zipCode = "zip_code"
    }

    /// Single-line label used by the "Open in Maps" affordance. Mirrors
    /// RN's `exactAddressLabel` (`src/app/support-trains/[id].tsx:413`).
    public var singleLineLabel: String {
        let first = [address, unitNumber].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let second = [city, state, zipCode].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        return [first, second].filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

/// `support_modes` block — which contribution lanes the train accepts.
public struct SupportTrainModesDTO: Decodable, Sendable {
    public let homeCookedMeals: Bool?
    public let takeout: Bool?
    public let groceries: Bool?
    public let giftFunds: Bool?

    enum CodingKeys: String, CodingKey {
        case homeCookedMeals = "home_cooked_meals"
        case takeout, groceries
        case giftFunds = "gift_funds"
    }
}

/// `preferred_dropoff_window` — `HH:MM` strings or nil.
public struct SupportTrainDropoffWindowDTO: Decodable, Sendable {
    public let startTime: String?
    public let endTime: String?

    enum CodingKeys: String, CodingKey {
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

/// One slot in the detail / manage payload.
public struct SupportTrainSlotDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let slotDate: String?
    public let slotLabel: String?
    public let supportMode: String?
    public let startTime: String?
    public let endTime: String?
    public let status: String?
    public let filledCount: Int?
    public let capacity: Int?

    enum CodingKeys: String, CodingKey {
        case id, status, capacity
        case slotDate = "slot_date"
        case slotLabel = "slot_label"
        case supportMode = "support_mode"
        case startTime = "start_time"
        case endTime = "end_time"
        case filledCount = "filled_count"
    }

    /// A slot is "covered" once its filled count meets its capacity (or the
    /// backend has flipped its status to `full`).
    public var isCovered: Bool {
        if status == "full" { return true }
        guard let capacity, capacity > 0 else { return false }
        return (filledCount ?? 0) >= capacity
    }
}

/// The viewer's own reservation rows (drives the "Your commitment"
/// section + `.mine` calendar cell).
public struct SupportTrainMyReservationDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let slotId: String?
    public let status: String?
    public let contributionMode: String?
    public let dishTitle: String?
    public let restaurantName: String?
    public let estimatedArrivalAt: String?
    public let noteToRecipient: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case slotId = "slot_id"
        case contributionMode = "contribution_mode"
        case dishTitle = "dish_title"
        case restaurantName = "restaurant_name"
        case estimatedArrivalAt = "estimated_arrival_at"
        case noteToRecipient = "note_to_recipient"
        case createdAt = "created_at"
    }
}

/// One broadcast update row (also the `POST /:id/updates` response shape).
public struct SupportTrainUpdateDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let authorUserId: String?
    public let body: String?
    public let mediaUrls: [String]?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body
        case authorUserId = "author_user_id"
        case mediaUrls = "media_urls"
        case createdAt = "created_at"
    }
}

/// One organizer row (primary / co_organizer / recipient_delegate).
///
/// The detail handler re-shapes Supabase's `User:user_id` alias into a
/// lowercase `user` object before responding
/// (`backend/routes/supportTrains.js:3611`), so `user` is the wire key.
/// The capitalised `User` alias is still accepted for older fixtures.
public struct SupportTrainOrganizerDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let role: String?
    public let user: SupportTrainHelperDTO?

    public init(id: String, role: String?, user: SupportTrainHelperDTO?) {
        self.id = id
        self.role = role
        self.user = user
    }

    enum CodingKeys: String, CodingKey {
        case id, role, user
        case legacyUser = "User"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        role = try container.decodeIfPresent(String.self, forKey: .role)
        let lowercase = try container.decodeIfPresent(SupportTrainHelperDTO.self, forKey: .user)
        user = try lowercase
            ?? container.decodeIfPresent(SupportTrainHelperDTO.self, forKey: .legacyUser)
    }

    /// `primary` organizers cannot be removed from the roster
    /// (`backend/routes/supportTrains.js:1102`).
    public var isPrimary: Bool {
        role == "primary"
    }

    public var displayName: String {
        user?.name ?? user?.username ?? "Organizer"
    }
}

/// Coarse (city/state) location surfaced to all viewers.
public struct SupportTrainCoarseLocationDTO: Decodable, Sendable, Hashable {
    public let city: String?
    public let state: String?
    public let zipCode: String?
    public let latitude: Double?
    public let longitude: Double?

    enum CodingKeys: String, CodingKey {
        case city, state, latitude, longitude
        case zipCode = "zip_code"
    }
}

/// `POST /api/support-trains/:id/updates` body. `media_urls` is omitted
/// when nil. Backend caps `body` at 5000 chars (`createUpdateSchema`).
public struct SupportTrainUpdateBody: Encodable, Sendable {
    public let body: String
    public let mediaUrls: [String]?

    public init(body: String, mediaUrls: [String]? = nil) {
        self.body = body
        self.mediaUrls = mediaUrls
    }

    enum CodingKeys: String, CodingKey {
        case body
        case mediaUrls = "media_urls"
    }
}
