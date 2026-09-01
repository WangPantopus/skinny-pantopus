//
//  ListingComposeSteps.swift
//  Pantopus
//
//  Step identifiers + persistable form state for the Snap & Sell wizard.
//  Used both by `ListingComposeWizardViewModel` and the SceneStorage-
//  backed restoration glue in `ListingComposeWizardView`.
//

import Foundation

/// Whether the wizard is creating a new listing or editing an existing
/// one. `.edit` carries the listing id (POST → PATCH switch) and an
/// optional `jumpToStep` that lets entry points like "Edit price" land
/// on the price step instead of step one.
public enum ListingComposeMode: Sendable, Hashable {
    case create
    case edit(listingId: String, jumpToStep: ListingComposeStep?)

    /// Convenience: the listing id when editing, else nil.
    public var editingListingId: String? {
        if case let .edit(listingId, _) = self { return listingId }
        return nil
    }

    public var isEdit: Bool {
        if case .edit = self { return true }
        return false
    }
}

/// The six pre-success steps of the Snap & Sell wizard, in order.
public enum ListingComposeStep: Int, CaseIterable, Sendable {
    case photos = 0
    case titleCategory
    case conditionDescription
    case price
    case location
    case review
    case success

    /// Total number of "step N of M" steps shown in the readout. Excludes
    /// the success terminal.
    public static let progressTotal: Int = 6

    /// One-indexed position used in the "N of M" top-bar readout, or
    /// `nil` for the success terminal.
    public var stepNumber: Int? {
        switch self {
        case .photos: 1
        case .titleCategory: 2
        case .conditionDescription: 3
        case .price: 4
        case .location: 5
        case .review: 6
        case .success: nil
        }
    }
}

/// A12.9 — create-mode entry path. Snap starts in the camera
/// viewfinder; manual preserves the original photo-grid wizard.
public enum ListingComposeEntryMode: String, CaseIterable, Codable, Sendable, Hashable {
    case snap
    case manual
}

/// Category selectable in step 2. Mirrors the five Marketplace chips and
/// resolves onto backend `layer` + the wanted/free flags.
public enum ListingComposeCategory: String, CaseIterable, Codable, Sendable, Hashable {
    case goods
    case rentals
    case vehicles
    case free
    case wanted

    public var label: String {
        switch self {
        case .goods: "Goods"
        case .rentals: "Rentals"
        case .vehicles: "Vehicles"
        case .free: "Free"
        case .wanted: "Wanted"
        }
    }

    public var subtitle: String {
        switch self {
        case .goods: "Sell something you own."
        case .rentals: "Rent something out by the day or week."
        case .vehicles: "Cars, bikes, scooters, trailers."
        case .free: "Give something away to a neighbor."
        case .wanted: "Ask the neighborhood for something."
        }
    }

    /// Backend `layer` (`goods` / `rentals` / `vehicles`). Free + Wanted
    /// both map to `goods` and are differentiated by `is_free` / `is_wanted`.
    public var layer: String {
        switch self {
        case .goods, .free, .wanted: "goods"
        case .rentals: "rentals"
        case .vehicles: "vehicles"
        }
    }

    /// Backend `listing_type` (`backend/constants/marketplace.js:27`).
    /// Drives expiration windows + browse filters.
    public var listingType: String {
        switch self {
        case .goods: "sell_item"
        case .rentals: "rent_sublet"
        case .vehicles: "vehicle_sale"
        case .free: "free_item"
        case .wanted: "wanted_request"
        }
    }

    /// Fallback backend `category` when no AI-derived product category
    /// is available. `category` is a required enum on
    /// `POST /api/listings` (`backend/constants/marketplace.js:6`).
    public var fallbackBackendCategory: String {
        switch self {
        case .vehicles: "vehicles"
        case .free: "free_stuff"
        case .goods, .rentals, .wanted: "other"
        }
    }

    public var isFreeDefault: Bool {
        self == .free
    }

    public var isWanted: Bool {
        self == .wanted
    }

    /// Wanted requests skip the condition step (you're asking, not
    /// offering). All other categories collect condition.
    public var requiresCondition: Bool {
        switch self {
        case .goods, .vehicles, .free, .rentals: true
        case .wanted: false
        }
    }
}

/// Condition selectable in step 3.
public enum ListingComposeCondition: String, CaseIterable, Codable, Sendable, Hashable {
    case new
    case likeNew = "like_new"
    case good
    case fair
    case forParts = "for_parts"

    public var label: String {
        switch self {
        case .new: "New"
        case .likeNew: "Like new"
        case .good: "Good"
        case .fair: "Fair"
        case .forParts: "For parts"
        }
    }

    public var subtitle: String {
        switch self {
        case .new: "Unused, in original packaging."
        case .likeNew: "Barely used, no visible wear."
        case .good: "Lightly used, minor wear."
        case .fair: "Used, with visible wear."
        case .forParts: "Not working — usable for parts."
        }
    }
}

/// Pricing kind in step 4.
public enum ListingComposePriceKind: String, CaseIterable, Codable, Sendable, Hashable {
    /// Free — no price field shown.
    case free
    /// Single fixed asking price.
    case fixed
    /// Asking price, open to offers.
    case negotiable

    public var label: String {
        switch self {
        case .free: "Free"
        case .fixed: "Fixed price"
        case .negotiable: "Open to offers"
        }
    }

    public var subtitle: String {
        switch self {
        case .free: "No price — first to claim."
        case .fixed: "Buyers see one price."
        case .negotiable: "Asking price, buyers can offer."
        }
    }
}

/// Pickup vs delivery preference in step 4.
public enum ListingComposeFulfillment: String, CaseIterable, Codable, Sendable, Hashable {
    case pickup
    case delivery

    public var label: String {
        switch self {
        case .pickup: "Pickup"
        case .delivery: "Delivery"
        }
    }

    public var subtitle: String {
        switch self {
        case .pickup: "Buyer comes to you."
        case .delivery: "You drop off within the neighborhood."
        }
    }

    /// Maps onto the backend `meetup_preference` enum
    /// (`porch_pickup` / `public_meetup` / `flexible`). Delivery is not
    /// a meetup preference — it rides on `deliveryAvailable`.
    public var meetupPreference: String {
        switch self {
        case .pickup: "public_meetup"
        case .delivery: "flexible"
        }
    }
}

/// Location kind in step 5.
public enum ListingComposeLocationKind: String, CaseIterable, Codable, Sendable, Hashable {
    /// Use the seller's saved primary-home address.
    case savedAddress = "saved_address"
    /// Pick a public meet-point (no street address revealed).
    case meetPoint = "meet_point"

    public var label: String {
        switch self {
        case .savedAddress: "Use my saved address"
        case .meetPoint: "Pick a meet point"
        }
    }

    public var subtitle: String {
        switch self {
        case .savedAddress: "We'll share it after a buyer commits."
        case .meetPoint: "Park, plaza, or storefront within walking distance."
        }
    }
}

/// One photo in the wizard's photo grid. The id is stable so
/// drag-reorder and remove operations can identify rows.
public struct ListingComposePhoto: Codable, Sendable, Equatable, Identifiable, Hashable {
    public let id: UUID
    /// Hosted URL for already-uploaded photos (edit-mode hydration) or
    /// a local capture token (e.g. "snap_angle_1"). Only remote URLs
    /// are sent in `mediaUrls` — local photos upload as multipart
    /// after the listing is created.
    public var token: String
    /// JPEG bytes for locally captured / picked photos. Deliberately
    /// excluded from Codable so multi-MB images never land in
    /// `@SceneStorage`; photos that lose their bytes across process
    /// death are dropped on restore.
    public var localImageData: Data?

    public init(id: UUID = UUID(), token: String, localImageData: Data? = nil) {
        self.id = id
        self.token = token
        self.localImageData = localImageData
    }

    /// True when the token is a hosted URL the backend already knows.
    public var isRemote: Bool {
        token.hasPrefix("http://") || token.hasPrefix("https://")
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case token
    }
}

/// Comp-range price suggestion from the Snap & Sell vision draft
/// (`backend/services/marketplace/priceIntelligenceService.js:42`).
/// Persisted with the form so the review surface survives restore.
public struct ListingComposePriceSuggestion: Codable, Sendable, Equatable, Hashable {
    public let low: Double
    public let median: Double
    public let high: Double
    public let basis: String?
    public let comparableCount: Int?

    public init(low: Double, median: Double, high: Double, basis: String?, comparableCount: Int?) {
        self.low = low
        self.median = median
        self.high = high
        self.basis = basis
        self.comparableCount = comparableCount
    }
}

/// Persistable form state for the wizard.
public struct ListingComposeFormState: Codable, Sendable, Equatable {
    public var step: Int
    public var entryMode: ListingComposeEntryMode
    public var photos: [ListingComposePhoto]
    public var title: String
    public var category: ListingComposeCategory?
    public var condition: ListingComposeCondition?
    public var bodyText: String
    public var priceKind: ListingComposePriceKind?
    public var priceAmount: String
    public var fulfillment: ListingComposeFulfillment
    public var deliveryEnabled: Bool
    public var locationKind: ListingComposeLocationKind?
    public var locationLabel: String
    /// Backend product category (`furniture`, `electronics`, …) —
    /// AI-derived for snap drafts, hydrated from the listing in edit
    /// mode. Falls back to `category.fallbackBackendCategory` at submit.
    public var backendCategory: String?
    /// Comp-range suggestion returned with the AI vision draft.
    public var priceSuggestion: ListingComposePriceSuggestion?

    public init(
        step: Int = ListingComposeStep.photos.rawValue,
        entryMode: ListingComposeEntryMode = .snap,
        photos: [ListingComposePhoto] = [],
        title: String = "",
        category: ListingComposeCategory? = nil,
        condition: ListingComposeCondition? = nil,
        bodyText: String = "",
        priceKind: ListingComposePriceKind? = nil,
        priceAmount: String = "",
        fulfillment: ListingComposeFulfillment = .pickup,
        deliveryEnabled: Bool = false,
        locationKind: ListingComposeLocationKind? = nil,
        locationLabel: String = "",
        backendCategory: String? = nil,
        priceSuggestion: ListingComposePriceSuggestion? = nil
    ) {
        self.step = step
        self.entryMode = entryMode
        self.photos = photos
        self.title = title
        self.category = category
        self.condition = condition
        self.bodyText = bodyText
        self.priceKind = priceKind
        self.priceAmount = priceAmount
        self.fulfillment = fulfillment
        self.deliveryEnabled = deliveryEnabled
        self.locationKind = locationKind
        self.locationLabel = locationLabel
        self.backendCategory = backendCategory
        self.priceSuggestion = priceSuggestion
    }

    private enum CodingKeys: String, CodingKey {
        case step
        case entryMode
        case photos
        case title
        case category
        case condition
        case bodyText
        case priceKind
        case priceAmount
        case fulfillment
        case deliveryEnabled
        case locationKind
        case locationLabel
        case backendCategory
        case priceSuggestion
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        step = try container.decodeIfPresent(Int.self, forKey: .step) ?? ListingComposeStep.photos.rawValue
        entryMode = try container.decodeIfPresent(ListingComposeEntryMode.self, forKey: .entryMode) ?? .snap
        photos = try container.decodeIfPresent([ListingComposePhoto].self, forKey: .photos) ?? []
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        category = try container.decodeIfPresent(ListingComposeCategory.self, forKey: .category)
        condition = try container.decodeIfPresent(ListingComposeCondition.self, forKey: .condition)
        bodyText = try container.decodeIfPresent(String.self, forKey: .bodyText) ?? ""
        priceKind = try container.decodeIfPresent(ListingComposePriceKind.self, forKey: .priceKind)
        priceAmount = try container.decodeIfPresent(String.self, forKey: .priceAmount) ?? ""
        fulfillment = try container.decodeIfPresent(ListingComposeFulfillment.self, forKey: .fulfillment) ?? .pickup
        deliveryEnabled = try container.decodeIfPresent(Bool.self, forKey: .deliveryEnabled) ?? false
        locationKind = try container.decodeIfPresent(ListingComposeLocationKind.self, forKey: .locationKind)
        locationLabel = try container.decodeIfPresent(String.self, forKey: .locationLabel) ?? ""
        backendCategory = try container.decodeIfPresent(String.self, forKey: .backendCategory)
        priceSuggestion = try container.decodeIfPresent(ListingComposePriceSuggestion.self, forKey: .priceSuggestion)
    }

    public static let empty = ListingComposeFormState()

    /// Max photos in the grid.
    public static let maxPhotos: Int = 8

    /// A12.9 camera coaching target before the user reviews suggestions.
    public static let targetCaptureAngles: Int = 4

    /// Max images sent to `POST /api/ai/draft/listing-vision`
    /// (`backend/routes/ai.js:74` caps the array at 5).
    public static let maxVisionImages: Int = 5

    /// Min / max bounds enforced on step transitions.
    public static let titleMinLength = 5
    public static let titleMaxLength = 80
    public static let descriptionMinLength = 20
    public static let descriptionMaxLength = 2000
}
