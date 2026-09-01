//
//  GigComposeSteps.swift
//  Pantopus
//
//  Step identifiers + form-state value types for the Post-a-Task wizard
//  (A12.8 describe-first restructure). Four pre-success steps + a
//  terminal success step. The form state is a `Codable`/`Equatable`
//  snapshot so the wizard can survive process death via `@SceneStorage`
//  (same pattern as `AddHomeFormState`).
//

import Foundation

// swiftlint:disable file_length

/// One-of-nine category the user can pick in step 1. Mirrors the chip
/// palette in `gigs-frames.jsx` CATS plus an `other` bucket the
/// composer surfaces but the feed filter does not (we route `other` to
/// the backend's free-form `category` field).
public enum GigComposeCategory: String, CaseIterable, Sendable, Codable, Hashable {
    case handyman
    case cleaning
    case moving
    case petcare
    case childcare
    case tutoring
    case delivery
    case tech
    case other

    public var label: String {
        switch self {
        case .handyman: "Handyman"
        case .cleaning: "Cleaning"
        case .moving: "Moving"
        case .petcare: "Pet care"
        case .childcare: "Child care"
        case .tutoring: "Tutoring"
        case .delivery: "Delivery"
        case .tech: "Tech"
        case .other: "Other"
        }
    }

    /// The backend's `VALID_CATEGORIES` spelling
    /// (`backend/services/magicTaskService.js`) forwarded as
    /// `draft.category` on `POST /api/gigs/magic-post`.
    public var backendLabel: String {
        switch self {
        case .handyman: "Handyman"
        case .cleaning: "Cleaning"
        case .moving: "Moving"
        case .petcare: "Pet Care"
        case .childcare: "Child Care"
        case .tutoring: "Tutoring"
        case .delivery: "Delivery"
        case .tech: "Tech Support"
        case .other: "Other"
        }
    }

    /// Maps a `GigsCategory.rawValue` (or any unrecognised string) into
    /// the compose enum. Used so the Hub's category-specific entry
    /// preselects the right tile.
    public static func from(rawKey: String?) -> GigComposeCategory? {
        guard let raw = rawKey?.lowercased(), !raw.isEmpty, raw != "all" else { return nil }
        return GigComposeCategory.allCases.first { $0.rawValue == raw }
    }

    /// Maps a Magic Task backend category ("Handyman", "Pet Care",
    /// "Tech Support", …, see `backend/services/magicTaskService.js`
    /// `VALID_CATEGORIES`) onto the compose enum. Unknown non-empty
    /// values land on `.other` (the composer's catch-all bucket);
    /// nil/empty returns nil so the keyword fallback can take over.
    public static func from(backendCategory raw: String?) -> GigComposeCategory? {
        guard let raw, !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let key = raw.lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")
        switch key {
        case "handyman": return .handyman
        case "cleaning": return .cleaning
        case "moving": return .moving
        case "petcare": return .petcare
        case "childcare": return .childcare
        case "tutoring": return .tutoring
        case "delivery", "errands", "grocerypickup": return .delivery
        case "tech", "techsupport": return .tech
        default: return .other
        }
    }
}

/// B.3 (A12.8) — entry mode for step 1. `.magic` is the default
/// AI-assisted describe path; `.manual` is the category-grid fallback
/// reachable via the "Pick a category instead" link.
public enum ComposeMode: String, CaseIterable, Sendable, Codable, Hashable {
    case magic
    case manual
}

/// A12.8 — step-1 engagement tiles (One-time / Recurring / Open-ended).
/// SCHEDULE-ish display selector — it mirrors into `scheduleType`; the
/// backend `engagement_mode` is modeled separately (`GigEngagementMode`).
public enum GigComposeEngagementMode: String, CaseIterable, Sendable, Codable, Hashable {
    case oneTime
    case recurring
    case openEnded
}

/// Backend `engagement_mode` for `POST /api/gigs/magic-post`
/// (`backend/routes/magicTask.js:397`). Defaults via
/// `GigComposeViewModel.inferEngagementMode(...)`; user-overridable on
/// the Budget & mode step.
public enum GigEngagementMode: String, CaseIterable, Sendable, Codable, Hashable {
    case instantAccept = "instant_accept"
    case curatedOffers = "curated_offers"
    case quotes

    public var label: String {
        switch self {
        case .instantAccept: "Instant accept"
        case .curatedOffers: "Curated offers"
        case .quotes: "Quotes"
        }
    }

    public var subcopy: String {
        switch self {
        case .instantAccept: "First helper takes it"
        case .curatedOffers: "Pick from ranked offers"
        case .quotes: "Pros send estimates"
        }
    }
}

/// Budget-type radio in step 3.
public enum GigComposeBudgetType: String, CaseIterable, Sendable, Codable, Hashable {
    case fixed
    case hourly
    case offers

    /// User-facing label rendered in the radio row.
    public var label: String {
        switch self {
        case .fixed: "Fixed price"
        case .hourly: "Hourly"
        case .offers: "Open to bids"
        }
    }

    /// Wire value forwarded as `pay_type` to `POST /api/gigs`.
    public var wireValue: String {
        rawValue
    }
}

/// Schedule-type radio in step 4.
public enum GigComposeScheduleType: String, CaseIterable, Sendable, Codable, Hashable {
    case oneTime
    case recurring
    case flexible

    public var label: String {
        switch self {
        case .oneTime: "One-time"
        case .recurring: "Recurring"
        case .flexible: "Flexible"
        }
    }

    /// Wire value forwarded as `schedule_type` to `POST /api/gigs`.
    /// "Recurring" maps to `flexible` until the backend gains a true
    /// recurring schedule_type — the spec surfaces it in the UI but the
    /// API doesn't model it yet.
    public var wireValue: String {
        switch self {
        case .oneTime: "scheduled"
        case .recurring: "flexible"
        case .flexible: "flexible"
        }
    }
}

/// Location-mode radio in step 5.
public enum GigComposeLocationMode: String, CaseIterable, Sendable, Codable, Hashable {
    case yourAddress
    case aPlace
    case virtual

    public var label: String {
        switch self {
        case .yourAddress: "Your address"
        case .aPlace: "A place"
        case .virtual: "Virtual"
        }
    }

    /// Subcopy under the radio label.
    public var subcopy: String {
        switch self {
        case .yourAddress: "Helpers come to the address on your account."
        case .aPlace: "Helpers come to a different address you'll enter."
        case .virtual: "Done over phone, video, or messages — no on-site visit."
        }
    }

    /// Wire value forwarded as `location.mode` to `POST /api/gigs`.
    public var wireMode: String {
        switch self {
        case .yourAddress: "home"
        case .aPlace: "address"
        case .virtual: "custom"
        }
    }
}

/// E.1 — cancellation-policy tier surfaced by the composer's policy picker
/// sheet. The mid tier is labelled **Moderate** in the design but maps to
/// the backend's `standard` value (`backend/routes/gigs.js:438`).
public enum GigCancellationPolicy: String, CaseIterable, Sendable, Codable, Hashable {
    case flexible
    case moderate
    case strict

    /// User-facing card title.
    public var label: String {
        switch self {
        case .flexible: "Flexible"
        case .moderate: "Moderate"
        case .strict: "Strict"
        }
    }

    /// Refund-rule subcopy rendered under the title.
    public var detail: String {
        switch self {
        case .flexible: "Full refund up to 24 hours before the start time."
        case .moderate: "50% refund up to 48 hours before. No refund after."
        case .strict: "No refund within 7 days of the start time."
        }
    }

    /// Wire value forwarded as `cancellation_policy`. The design's
    /// "Moderate" tier maps onto the backend's `standard` enum member.
    public var wireValue: String {
        switch self {
        case .flexible: "flexible"
        case .moderate: "standard"
        case .strict: "strict"
        }
    }
}

/// Plain-old-data address fields collected in step 5 when the user
/// picks `aPlace`. Mirrors `AddHomeAddressFields`.
public struct GigComposePlaceAddress: Codable, Sendable, Equatable {
    public var line1: String
    public var city: String
    public var state: String
    public var zip: String

    public init(
        line1: String = "",
        city: String = "",
        state: String = "",
        zip: String = ""
    ) {
        self.line1 = line1
        self.city = city
        self.state = state
        self.zip = zip
    }

    /// True when every required component carries a non-whitespace value.
    public var isComplete: Bool {
        !line1.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !state.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !zip.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// The four pre-success steps of the A12.8 wizard, in order:
/// Describe (magic default / manual picker) → Fill gaps → Budget & mode
/// → Review & post, plus the terminal success step.
public enum GigComposeStep: Int, CaseIterable, Sendable {
    case describe = 0
    case fillGaps
    case budget
    case review
    case success

    /// Total number of "step N of M" steps shown in the readout. Excludes
    /// the success terminal.
    public static let progressTotal: Int = 4

    /// One-indexed position used in the "N of M" top-bar readout.
    public var stepNumber: Int? {
        switch self {
        case .describe: 1
        case .fillGaps: 2
        case .budget: 3
        case .review: 4
        case .success: nil
        }
    }
}

/// Validation constants enforced at the UI layer. The backend also
/// validates (`backend/routes/gigs.js:425`); these mirror the prompt's
/// stricter UI rules.
public enum GigComposeLimits {
    public static let titleMin: Int = 5
    public static let titleMax: Int = 100
    public static let descriptionMin: Int = 20
    public static let descriptionMax: Int = 2000
    public static let maxPhotos: Int = 6
    /// E.1 — gig tag cap. Mirrors `tags` `.max(5)` in `createGigSchema`.
    public static let maxTags: Int = 5
    /// B.3 — Magic Task describe textarea cap (matches A12.8 "184 / 500").
    public static let describeMax: Int = 500
}

/// P6c — one row of the composer's identity picker: post as yourself or
/// on behalf of a business you hold a seat on. `beneficiaryUserId` is
/// nil for the personal identity; for a business it is the business's
/// own user id (`business_user_id` on the my-businesses membership row),
/// forwarded as magic-post's `beneficiary_user_id`.
public struct GigComposeIdentityOption: Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let beneficiaryUserId: String?
    /// Menu label — "Personal · You" or the business name.
    public let label: String

    public init(id: String, beneficiaryUserId: String?, label: String) {
        self.id = id
        self.beneficiaryUserId = beneficiaryUserId
        self.label = label
    }

    /// The default post-as-yourself identity.
    public static let personal = GigComposeIdentityOption(
        id: "personal",
        beneficiaryUserId: nil,
        label: "Personal · You"
    )
}

/// Delivery/errand route fields. Unlike the archetype JSONB modules
/// these ride as **flat snake_case columns** on the gig
/// (`pickup_address`, `pickup_notes`, `dropoff_address`,
/// `dropoff_notes`, `delivery_proof_required` — see
/// `backend/routes/gigs.js:481-486` for the column contract and
/// `GigDTO.pickupAddress` for the read side).
public struct GigDeliveryDetails: Codable, Sendable, Hashable, Equatable {
    public var pickupAddress: String?
    public var pickupNotes: String?
    public var dropoffAddress: String?
    public var dropoffNotes: String?
    public var proofRequired: Bool?

    public init(
        pickupAddress: String? = nil,
        pickupNotes: String? = nil,
        dropoffAddress: String? = nil,
        dropoffNotes: String? = nil,
        proofRequired: Bool? = nil
    ) {
        self.pickupAddress = pickupAddress
        self.pickupNotes = pickupNotes
        self.dropoffAddress = dropoffAddress
        self.dropoffNotes = dropoffNotes
        self.proofRequired = proofRequired
    }

    /// True once the user typed or toggled anything here.
    public var hasAnyData: Bool {
        !(pickupAddress ?? "").isEmpty
            || !(pickupNotes ?? "").isEmpty
            || !(dropoffAddress ?? "").isEmpty
            || !(dropoffNotes ?? "").isEmpty
            || proofRequired == true
    }
}

/// Pro-service quote requirements — flat columns again
/// (`requires_license`, `license_type`, `requires_insurance`,
/// `scope_description`, `deposit_required`, `deposit_amount`;
/// `backend/routes/gigs.js:499-505`). `depositAmount` is held as text
/// like the budget fields and parsed at send time.
public struct GigProServiceDetails: Codable, Sendable, Hashable, Equatable {
    public var requiresLicense: Bool?
    public var licenseType: String?
    public var requiresInsurance: Bool?
    public var scopeDescription: String?
    public var depositRequired: Bool?
    public var depositAmount: String?

    public init(
        requiresLicense: Bool? = nil,
        licenseType: String? = nil,
        requiresInsurance: Bool? = nil,
        scopeDescription: String? = nil,
        depositRequired: Bool? = nil,
        depositAmount: String? = nil
    ) {
        self.requiresLicense = requiresLicense
        self.licenseType = licenseType
        self.requiresInsurance = requiresInsurance
        self.scopeDescription = scopeDescription
        self.depositRequired = depositRequired
        self.depositAmount = depositAmount
    }

    /// A deposit toggle with no (positive) amount blocks the step —
    /// mirrors RN's "amount required when the deposit toggle is on".
    public var isDepositAmountMissing: Bool {
        guard depositRequired == true else { return false }
        return (Double(depositAmount ?? "") ?? 0) <= 0
    }

    public var hasAnyData: Bool {
        requiresLicense == true
            || !(licenseType ?? "").isEmpty
            || requiresInsurance == true
            || !(scopeDescription ?? "").isEmpty
            || depositRequired == true
            || !(depositAmount ?? "").isEmpty
    }
}

/// Snapshot of all wizard form state. Encoded into `@SceneStorage` so
/// the in-progress wizard survives process death and config changes.
public struct GigComposeFormState: Codable, Sendable, Equatable {
    public var step: Int
    /// B.3 — step-1 entry mode (Magic describe vs manual picker).
    public var composeMode: ComposeMode
    /// B.3 — plain-English Magic Task input.
    public var describeText: String
    /// B.3 — archetype parsed from `describeText` (debounced). Mirrored
    /// into `category` so downstream steps + submission use it.
    public var detectedArchetype: GigComposeCategory?
    public var category: GigComposeCategory?
    public var title: String
    public var description: String
    public var photoIds: [String]
    public var budgetType: GigComposeBudgetType?
    public var budgetMin: String
    public var budgetMax: String
    public var scheduleType: GigComposeScheduleType?
    /// ISO-8601 date string for the one-time `scheduleType` selection.
    /// Stored as a string so the form survives JSON round-trips.
    public var scheduledStartISO: String?
    public var locationMode: GigComposeLocationMode?
    public var placeAddress: GigComposePlaceAddress
    /// E.1 — optional hard deadline (`deadline`), ISO-8601. nil ⇒ flexible
    /// (no deadline sent).
    public var deadlineISO: String?
    /// E.1 — cancellation policy (`cancellation_policy`). nil ⇒ backend
    /// default (`standard`).
    public var cancellationPolicy: GigCancellationPolicy?
    /// E.1 — boost flag (`is_urgent`).
    public var isUrgent: Bool
    /// E.1 — freeform tags (`tags`), stored without the leading `#`.
    public var tags: [String]
    /// A12.8 — step-1 engagement tile (One-time / Recurring / Open-ended).
    public var engagementTile: GigComposeEngagementMode
    /// A12.8 — explicit backend `engagement_mode` override picked on the
    /// Budget & mode step. nil ⇒ inferred from archetype + schedule.
    public var engagementOverride: GigEngagementMode?
    /// A12.8 — optional effort estimate ("~2 hours"), wire
    /// `estimated_hours`. Stored as text like the budget fields.
    public var estimatedHours: String
    /// A12.8 — backend task archetype ("home_service", "care_task", …)
    /// parsed from the magic draft; drives which module field group the
    /// Fill-gaps step renders.
    public var taskArchetype: String?
    /// A12.8 — delivery/errand shopping items (`items`).
    public var items: [GigTaskItemDraft]
    /// A12.8 — archetype module field groups (wire `care_details` etc.).
    public var careDetails: GigCareDetails?
    public var logisticsDetails: GigLogisticsDetails?
    public var remoteDetails: GigRemoteDetails?
    public var urgentDetails: GigUrgentDetails?
    public var eventDetails: GigEventDetails?
    /// delivery_errand route (flat `pickup_*` / `dropoff_*` columns).
    /// Optional so older `@SceneStorage` snapshots stay decodable.
    public var deliveryDetails: GigDeliveryDetails?
    /// pro_service_quote requirements (flat `requires_*` columns).
    public var proServiceDetails: GigProServiceDetails?
    /// P6c — persona switching. nil posts as yourself; a business user id
    /// rides magic-post's `beneficiary_user_id`. Optional fields keep old
    /// `@SceneStorage` snapshots decodable.
    public var beneficiaryUserId: String?
    /// Display name backing the identity chip ("ACME PLUMBING").
    public var beneficiaryName: String?

    public init(
        step: Int = GigComposeStep.describe.rawValue,
        composeMode: ComposeMode = .magic,
        describeText: String = "",
        detectedArchetype: GigComposeCategory? = nil,
        category: GigComposeCategory? = nil,
        title: String = "",
        description: String = "",
        photoIds: [String] = [],
        budgetType: GigComposeBudgetType? = nil,
        budgetMin: String = "",
        budgetMax: String = "",
        scheduleType: GigComposeScheduleType? = nil,
        scheduledStartISO: String? = nil,
        locationMode: GigComposeLocationMode? = nil,
        placeAddress: GigComposePlaceAddress = .init(),
        deadlineISO: String? = nil,
        cancellationPolicy: GigCancellationPolicy? = nil,
        isUrgent: Bool = false,
        tags: [String] = [],
        engagementTile: GigComposeEngagementMode = .oneTime,
        engagementOverride: GigEngagementMode? = nil,
        estimatedHours: String = "",
        taskArchetype: String? = nil,
        items: [GigTaskItemDraft] = [],
        careDetails: GigCareDetails? = nil,
        logisticsDetails: GigLogisticsDetails? = nil,
        remoteDetails: GigRemoteDetails? = nil,
        urgentDetails: GigUrgentDetails? = nil,
        eventDetails: GigEventDetails? = nil,
        deliveryDetails: GigDeliveryDetails? = nil,
        proServiceDetails: GigProServiceDetails? = nil,
        beneficiaryUserId: String? = nil,
        beneficiaryName: String? = nil
    ) {
        self.step = step
        self.composeMode = composeMode
        self.describeText = describeText
        self.detectedArchetype = detectedArchetype
        self.category = category
        self.title = title
        self.description = description
        self.photoIds = photoIds
        self.budgetType = budgetType
        self.budgetMin = budgetMin
        self.budgetMax = budgetMax
        self.scheduleType = scheduleType
        self.scheduledStartISO = scheduledStartISO
        self.locationMode = locationMode
        self.placeAddress = placeAddress
        self.deadlineISO = deadlineISO
        self.cancellationPolicy = cancellationPolicy
        self.isUrgent = isUrgent
        self.tags = tags
        self.engagementTile = engagementTile
        self.engagementOverride = engagementOverride
        self.estimatedHours = estimatedHours
        self.taskArchetype = taskArchetype
        self.items = items
        self.careDetails = careDetails
        self.logisticsDetails = logisticsDetails
        self.remoteDetails = remoteDetails
        self.urgentDetails = urgentDetails
        self.eventDetails = eventDetails
        self.deliveryDetails = deliveryDetails
        self.proServiceDetails = proServiceDetails
        self.beneficiaryUserId = beneficiaryUserId
        self.beneficiaryName = beneficiaryName
    }

    public static let empty = GigComposeFormState()

    /// True when any user-visible field carries data — drives the
    /// discard-confirm gate.
    public var hasAnyData: Bool {
        !describeText.isEmpty
            || category != nil
            || !title.isEmpty
            || !description.isEmpty
            || !photoIds.isEmpty
            || budgetType != nil
            || !budgetMin.isEmpty
            || !budgetMax.isEmpty
            || scheduleType != nil
            || scheduledStartISO != nil
            || locationMode != nil
            || placeAddress.isComplete
            || !placeAddress.line1.isEmpty
            || deadlineISO != nil
            || cancellationPolicy != nil
            || isUrgent
            || !tags.isEmpty
            || !estimatedHours.isEmpty
            || !items.isEmpty
            || deliveryDetails?.hasAnyData == true
            || proServiceDetails?.hasAnyData == true
    }
}
