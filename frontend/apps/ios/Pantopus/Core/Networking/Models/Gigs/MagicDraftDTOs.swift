//
//  MagicDraftDTOs.swift
//  Pantopus
//
//  Request/response shapes for `POST /api/gigs/magic-draft`
//  (`backend/routes/magicTask.js:335`) — the "one sentence to structured
//  task" parser behind the Post-a-Task wizard's Magic describe step.
//  The draft payload is decoded tolerantly: every field is optional so
//  module-suggestion keys we don't model yet are simply ignored.
//

import Foundation

// swiftlint:disable file_length

/// Body for `POST /api/gigs/magic-draft`. `text` is the user's
/// plain-English describe input (3–2000 chars, validated server-side);
/// `context` carries optional hints the parser can fold in.
public struct MagicDraftRequestBody: Encodable, Sendable {
    public let text: String
    public let context: MagicDraftContext?
    public let attachmentUrls: [String]?

    public init(
        text: String,
        context: MagicDraftContext? = nil,
        attachmentUrls: [String]? = nil
    ) {
        self.text = text
        self.context = context
        self.attachmentUrls = attachmentUrls
    }
}

/// Optional parse hints — caller location, a budget the user already
/// typed, and the chosen location mode.
public struct MagicDraftContext: Encodable, Sendable {
    public let latitude: Double?
    public let longitude: Double?
    public let budget: Double?
    public let locationMode: String?

    public init(
        latitude: Double? = nil,
        longitude: Double? = nil,
        budget: Double? = nil,
        locationMode: String? = nil
    ) {
        self.latitude = latitude
        self.longitude = longitude
        self.budget = budget
        self.locationMode = locationMode
    }
}

/// Envelope from `POST /api/gigs/magic-draft`. `_fallback` rides along
/// when the backend's AI path failed and it served the deterministic
/// parse instead.
public struct MagicDraftResponse: Decodable, Sendable {
    public let draft: MagicDraftDTO
    public let confidence: Double?
    public let fieldConfidence: [String: Double]?
    public let clarifyingQuestion: String?
    public let source: String?
    public let elapsed: Int?
    public let isFallback: Bool?

    enum CodingKeys: String, CodingKey {
        case draft, confidence, fieldConfidence, clarifyingQuestion, source, elapsed
        case isFallback = "_fallback"
    }
}

/// The structured draft. Field names are snake_case on the wire;
/// `category` is one of the backend's `VALID_CATEGORIES` (may be
/// "Other"). Codable (not just Decodable) so the wizard can echo the
/// raw draft back as `ai_draft_json` on `POST /api/gigs/magic-post`.
public struct MagicDraftDTO: Codable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let category: String?
    public let taskArchetype: String?
    /// "offers" | "fixed" | "hourly"
    public let payType: String?
    public let budgetFixed: Double?
    public let hourlyRate: Double?
    public let estimatedHours: Double?
    public let budgetRange: MagicDraftBudgetRange?
    /// "asap" | "today" | "scheduled" | "flexible"
    public let scheduleType: String?
    public let locationMode: String?
    public let privacyLevel: String?
    public let tags: [String]?
    public let isUrgent: Bool?
    public let attachmentsSuggested: Bool?
    // A12.8 — archetype module objects, decoded tolerantly when the
    // parser carried them (inner keys are camelCase on the wire —
    // `backend/utils/moduleSchemas.js`).
    public let careDetails: GigCareDetails?
    public let logisticsDetails: GigLogisticsDetails?
    public let remoteDetails: GigRemoteDetails?
    public let urgentDetails: GigUrgentDetails?
    public let eventDetails: GigEventDetails?
    public let items: [GigTaskItemDraft]?
    // delivery_errand / pro_service_quote suggestions ride flat on the
    // draft (`magicTaskService.js:460-480` normalises the AI's
    // `pickup_location_text` into `pickup_address`), so the Fill-gaps
    // step can prefill the Delivery / Professional modules.
    public let pickupAddress: String?
    public let pickupNotes: String?
    public let dropoffAddress: String?
    public let dropoffNotes: String?
    public let deliveryProofRequired: Bool?
    public let requiresLicense: Bool?
    public let licenseType: String?
    public let requiresInsurance: Bool?
    public let scopeDescription: String?
    public let depositRequired: Bool?
    public let depositAmount: Double?

    enum CodingKeys: String, CodingKey {
        case title, description, category, tags, items
        case taskArchetype = "task_archetype"
        case payType = "pay_type"
        case budgetFixed = "budget_fixed"
        case hourlyRate = "hourly_rate"
        case estimatedHours = "estimated_hours"
        case budgetRange = "budget_range"
        case scheduleType = "schedule_type"
        case locationMode = "location_mode"
        case privacyLevel = "privacy_level"
        case isUrgent = "is_urgent"
        case attachmentsSuggested = "attachments_suggested"
        case careDetails = "care_details"
        case logisticsDetails = "logistics_details"
        case remoteDetails = "remote_details"
        case urgentDetails = "urgent_details"
        case eventDetails = "event_details"
        case pickupAddress = "pickup_address"
        case pickupNotes = "pickup_notes"
        case dropoffAddress = "dropoff_address"
        case dropoffNotes = "dropoff_notes"
        case deliveryProofRequired = "delivery_proof_required"
        case requiresLicense = "requires_license"
        case licenseType = "license_type"
        case requiresInsurance = "requires_insurance"
        case scopeDescription = "scope_description"
        case depositRequired = "deposit_required"
        case depositAmount = "deposit_amount"
    }
}

/// Suggested `{ min, max }` budget band for open-to-bids drafts.
public struct MagicDraftBudgetRange: Codable, Sendable, Hashable {
    public let min: Double
    public let max: Double

    public init(min: Double, max: Double) {
        self.min = min
        self.max = max
    }
}

// MARK: - A12.8 archetype module objects

/// `care_details` (`backend/utils/moduleSchemas.js`). Inner keys are
/// camelCase on the wire — no CodingKeys needed.
public struct GigCareDetails: Codable, Sendable, Hashable, Equatable {
    public var careType: String?
    public var agesOrDetails: String?
    public var count: Int?
    public var specialNeeds: String?
    public var languagePreference: String?
    public var emergencyNotes: String?

    public init(
        careType: String? = nil,
        agesOrDetails: String? = nil,
        count: Int? = nil,
        specialNeeds: String? = nil,
        languagePreference: String? = nil,
        emergencyNotes: String? = nil
    ) {
        self.careType = careType
        self.agesOrDetails = agesOrDetails
        self.count = count
        self.specialNeeds = specialNeeds
        self.languagePreference = languagePreference
        self.emergencyNotes = emergencyNotes
    }
}

/// `logistics_details` (`backend/utils/moduleSchemas.js`).
public struct GigLogisticsDetails: Codable, Sendable, Hashable, Equatable {
    public var workerCount: Int?
    public var vehicleNeeded: Bool?
    public var vehicleType: String?
    public var toolsNeeded: [String]?
    public var accessInstructions: String?
    public var petsOnProperty: Bool?
    /// "none" | "few_steps" | "multiple_flights"
    public var stairsInfo: String?
    public var heavyLifting: Bool?

    public init(
        workerCount: Int? = nil,
        vehicleNeeded: Bool? = nil,
        vehicleType: String? = nil,
        toolsNeeded: [String]? = nil,
        accessInstructions: String? = nil,
        petsOnProperty: Bool? = nil,
        stairsInfo: String? = nil,
        heavyLifting: Bool? = nil
    ) {
        self.workerCount = workerCount
        self.vehicleNeeded = vehicleNeeded
        self.vehicleType = vehicleType
        self.toolsNeeded = toolsNeeded
        self.accessInstructions = accessInstructions
        self.petsOnProperty = petsOnProperty
        self.stairsInfo = stairsInfo
        self.heavyLifting = heavyLifting
    }
}

/// `remote_details` (`backend/utils/moduleSchemas.js`).
public struct GigRemoteDetails: Codable, Sendable, Hashable, Equatable {
    /// "document" | "design" | "code" | "video" | "other"
    public var deliverableType: String?
    public var fileFormat: String?
    public var revisionCount: Int?
    public var timezone: String?
    public var meetingRequired: Bool?
    public var dueDate: String?

    public init(
        deliverableType: String? = nil,
        fileFormat: String? = nil,
        revisionCount: Int? = nil,
        timezone: String? = nil,
        meetingRequired: Bool? = nil,
        dueDate: String? = nil
    ) {
        self.deliverableType = deliverableType
        self.fileFormat = fileFormat
        self.revisionCount = revisionCount
        self.timezone = timezone
        self.meetingRequired = meetingRequired
        self.dueDate = dueDate
    }
}

/// `urgent_details` (`backend/utils/moduleSchemas.js`).
public struct GigUrgentDetails: Codable, Sendable, Hashable, Equatable {
    public var startsAsap: Bool?
    public var responseWindowMinutes: Int?
    public var arrivalNeededBy: String?
    public var shareLocationDuringTask: Bool?
    public var liveStatusEnabled: Bool?
    public var roadsideVehicleNotes: String?
    public var pickupDropoffMode: String?

    public init(
        startsAsap: Bool? = nil,
        responseWindowMinutes: Int? = nil,
        arrivalNeededBy: String? = nil,
        shareLocationDuringTask: Bool? = nil,
        liveStatusEnabled: Bool? = nil,
        roadsideVehicleNotes: String? = nil,
        pickupDropoffMode: String? = nil
    ) {
        self.startsAsap = startsAsap
        self.responseWindowMinutes = responseWindowMinutes
        self.arrivalNeededBy = arrivalNeededBy
        self.shareLocationDuringTask = shareLocationDuringTask
        self.liveStatusEnabled = liveStatusEnabled
        self.roadsideVehicleNotes = roadsideVehicleNotes
        self.pickupDropoffMode = pickupDropoffMode
    }
}

/// `event_details` (`backend/utils/moduleSchemas.js`).
public struct GigEventDetails: Codable, Sendable, Hashable, Equatable {
    /// "party" | "wedding" | "corporate" | "community" | "other"
    public var eventType: String?
    public var guestCount: Int?
    public var shiftStart: String?
    public var shiftEnd: String?
    public var dressCode: String?
    /// "setup" | "serving" | "bartending" | "cleanup" | "general"
    public var roleType: String?
    public var venueDetails: String?

    public init(
        eventType: String? = nil,
        guestCount: Int? = nil,
        shiftStart: String? = nil,
        shiftEnd: String? = nil,
        dressCode: String? = nil,
        roleType: String? = nil,
        venueDetails: String? = nil
    ) {
        self.eventType = eventType
        self.guestCount = guestCount
        self.shiftStart = shiftStart
        self.shiftEnd = shiftEnd
        self.dressCode = dressCode
        self.roleType = roleType
        self.venueDetails = venueDetails
    }
}

/// One delivery/errand shopping item (`draft.items[]`). `name` is
/// required by the post schema; empty names are filtered at send time.
public struct GigTaskItemDraft: Codable, Sendable, Hashable, Equatable, Identifiable {
    public var name: String?
    public var notes: String?
    public var budgetCap: Double?
    public var preferredStore: String?

    public var id: String {
        "\(name ?? "")|\(notes ?? "")"
    }

    public init(
        name: String? = nil,
        notes: String? = nil,
        budgetCap: Double? = nil,
        preferredStore: String? = nil
    ) {
        self.name = name
        self.notes = notes
        self.budgetCap = budgetCap
        self.preferredStore = preferredStore
    }
}

// MARK: - Magic post (POST /api/gigs/magic-post)

/// Body for `POST /api/gigs/magic-post` (`backend/routes/magicTask.js:397`).
public struct MagicPostBody: Encodable, Sendable {
    public let text: String
    public let draft: MagicPostDraft
    public let location: CreateGigLocation?
    public let beneficiaryUserId: String?
    /// "magic" | "classic"
    public let sourceFlow: String
    /// "instant_accept" | "curated_offers" | "quotes"
    public let engagementMode: String?
    /// "in_person" | "drop_off" | "remote" | "hybrid"
    public let taskFormat: String?
    public let aiConfidence: Double?
    public let aiDraftJson: MagicDraftDTO?

    public init(
        text: String,
        draft: MagicPostDraft,
        location: CreateGigLocation?,
        beneficiaryUserId: String? = nil,
        sourceFlow: String,
        engagementMode: String?,
        taskFormat: String? = nil,
        aiConfidence: Double? = nil,
        aiDraftJson: MagicDraftDTO? = nil
    ) {
        self.text = text
        self.draft = draft
        self.location = location
        self.beneficiaryUserId = beneficiaryUserId
        self.sourceFlow = sourceFlow
        self.engagementMode = engagementMode
        self.taskFormat = taskFormat
        self.aiConfidence = aiConfidence
        self.aiDraftJson = aiDraftJson
    }

    enum CodingKeys: String, CodingKey {
        case text, draft, location
        case beneficiaryUserId = "beneficiary_user_id"
        case sourceFlow = "source_flow"
        case engagementMode = "engagement_mode"
        case taskFormat = "task_format"
        case aiConfidence = "ai_confidence"
        case aiDraftJson = "ai_draft_json"
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(text, forKey: .text)
        try container.encode(draft, forKey: .draft)
        try container.encodeIfPresent(location, forKey: .location)
        // Always carried — null means "post as yourself"; P6c persona
        // switching sends the business's user id here.
        try container.encode(beneficiaryUserId, forKey: .beneficiaryUserId)
        try container.encode(sourceFlow, forKey: .sourceFlow)
        try container.encodeIfPresent(engagementMode, forKey: .engagementMode)
        try container.encodeIfPresent(taskFormat, forKey: .taskFormat)
        try container.encodeIfPresent(aiConfidence, forKey: .aiConfidence)
        try container.encodeIfPresent(aiDraftJson, forKey: .aiDraftJson)
    }
}

/// `draft` object inside `MagicPostBody`. Keys are snake_case; module
/// objects keep camelCase inner keys per `moduleSchemas.js`.
public struct MagicPostDraft: Encodable, Sendable {
    public let title: String
    public let description: String
    public let category: String?
    public let tags: [String]?
    public let payType: String
    public let budgetFixed: Double?
    public let hourlyRate: Double?
    public let estimatedHours: Double?
    public let scheduleType: String
    public let timeWindowStart: String?
    public let timeWindowEnd: String?
    public let locationMode: String
    public let privacyLevel: String
    public let isUrgent: Bool
    public let attachments: [String]?
    public let items: [GigTaskItemDraft]?
    public let cancellationPolicy: String?
    public let taskArchetype: String?
    public let startsAsap: Bool?
    public let responseWindowMinutes: Int?
    public let careDetails: GigCareDetails?
    public let logisticsDetails: GigLogisticsDetails?
    public let remoteDetails: GigRemoteDetails?
    public let urgentDetails: GigUrgentDetails?
    public let eventDetails: GigEventDetails?
    // Delivery module — flat gig columns, not JSONB
    // (`backend/routes/gigs.js:481-486`).
    public let pickupAddress: String?
    public let pickupNotes: String?
    public let dropoffAddress: String?
    public let dropoffNotes: String?
    public let deliveryProofRequired: Bool?
    // Pro-service module (`backend/routes/gigs.js:499-505`).
    public let requiresLicense: Bool?
    public let licenseType: String?
    public let requiresInsurance: Bool?
    public let scopeDescription: String?
    public let depositRequired: Bool?
    public let depositAmount: Double?

    public init(
        title: String,
        description: String,
        category: String?,
        tags: [String]?,
        payType: String,
        budgetFixed: Double?,
        hourlyRate: Double?,
        estimatedHours: Double?,
        scheduleType: String,
        timeWindowStart: String?,
        timeWindowEnd: String?,
        locationMode: String,
        privacyLevel: String,
        isUrgent: Bool,
        attachments: [String]?,
        items: [GigTaskItemDraft]?,
        cancellationPolicy: String?,
        taskArchetype: String?,
        startsAsap: Bool? = nil,
        responseWindowMinutes: Int? = nil,
        careDetails: GigCareDetails? = nil,
        logisticsDetails: GigLogisticsDetails? = nil,
        remoteDetails: GigRemoteDetails? = nil,
        urgentDetails: GigUrgentDetails? = nil,
        eventDetails: GigEventDetails? = nil,
        pickupAddress: String? = nil,
        pickupNotes: String? = nil,
        dropoffAddress: String? = nil,
        dropoffNotes: String? = nil,
        deliveryProofRequired: Bool? = nil,
        requiresLicense: Bool? = nil,
        licenseType: String? = nil,
        requiresInsurance: Bool? = nil,
        scopeDescription: String? = nil,
        depositRequired: Bool? = nil,
        depositAmount: Double? = nil
    ) {
        self.title = title
        self.description = description
        self.category = category
        self.tags = tags
        self.payType = payType
        self.budgetFixed = budgetFixed
        self.hourlyRate = hourlyRate
        self.estimatedHours = estimatedHours
        self.scheduleType = scheduleType
        self.timeWindowStart = timeWindowStart
        self.timeWindowEnd = timeWindowEnd
        self.locationMode = locationMode
        self.privacyLevel = privacyLevel
        self.isUrgent = isUrgent
        self.attachments = attachments
        self.items = items
        self.cancellationPolicy = cancellationPolicy
        self.taskArchetype = taskArchetype
        self.startsAsap = startsAsap
        self.responseWindowMinutes = responseWindowMinutes
        self.careDetails = careDetails
        self.logisticsDetails = logisticsDetails
        self.remoteDetails = remoteDetails
        self.urgentDetails = urgentDetails
        self.eventDetails = eventDetails
        self.pickupAddress = pickupAddress
        self.pickupNotes = pickupNotes
        self.dropoffAddress = dropoffAddress
        self.dropoffNotes = dropoffNotes
        self.deliveryProofRequired = deliveryProofRequired
        self.requiresLicense = requiresLicense
        self.licenseType = licenseType
        self.requiresInsurance = requiresInsurance
        self.scopeDescription = scopeDescription
        self.depositRequired = depositRequired
        self.depositAmount = depositAmount
    }

    enum CodingKeys: String, CodingKey {
        case title, description, category, tags, items, attachments
        case payType = "pay_type"
        case budgetFixed = "budget_fixed"
        case hourlyRate = "hourly_rate"
        case estimatedHours = "estimated_hours"
        case scheduleType = "schedule_type"
        case timeWindowStart = "time_window_start"
        case timeWindowEnd = "time_window_end"
        case locationMode = "location_mode"
        case privacyLevel = "privacy_level"
        case isUrgent = "is_urgent"
        case cancellationPolicy = "cancellation_policy"
        case taskArchetype = "task_archetype"
        case startsAsap = "starts_asap"
        case responseWindowMinutes = "response_window_minutes"
        case careDetails = "care_details"
        case logisticsDetails = "logistics_details"
        case remoteDetails = "remote_details"
        case urgentDetails = "urgent_details"
        case eventDetails = "event_details"
        case pickupAddress = "pickup_address"
        case pickupNotes = "pickup_notes"
        case dropoffAddress = "dropoff_address"
        case dropoffNotes = "dropoff_notes"
        case deliveryProofRequired = "delivery_proof_required"
        case requiresLicense = "requires_license"
        case licenseType = "license_type"
        case requiresInsurance = "requires_insurance"
        case scopeDescription = "scope_description"
        case depositRequired = "deposit_required"
        case depositAmount = "deposit_amount"
    }
}

/// `201` envelope from `POST /api/gigs/magic-post`.
public struct MagicPostResponse: Decodable, Sendable {
    public let message: String?
    public let gig: MagicPostGigDTO
    public let nearbyHelpers: Int?
    public let notifiedCount: Int?

    enum CodingKeys: String, CodingKey {
        case message, gig
        case nearbyHelpers = "nearby_helpers"
        case notifiedCount = "notified_count"
    }
}

/// Minimal slice of the freshly-inserted gig the success step needs.
public struct MagicPostGigDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let title: String?
    public let undoWindowMs: Int?
    public let canUndo: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title
        case undoWindowMs = "undo_window_ms"
        case canUndo = "can_undo"
    }
}

/// Envelope from `POST /api/gigs/:gigId/undo`
/// (`backend/routes/magicTask.js:682`).
public struct GigUndoResponse: Decodable, Sendable {
    public let message: String?
    public let gigId: String?
}

// MARK: - Templates library (GET /api/gigs/templates/library)

/// Envelope from `GET /api/gigs/templates/library`
/// (`backend/routes/magicTask.js:326`).
public struct GigTemplateLibraryResponse: Decodable, Sendable {
    public let templates: [GigTaskTemplateDTO]
}

/// One inspiration-template chip.
public struct GigTaskTemplateDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    /// Emoji glyph rendered on the chip.
    public let icon: String?
    public let template: GigTaskTemplateSeed?
}

/// Seed payload of a template — the wizard uses `title` to seed the
/// describe field and lets the parser do the rest.
public struct GigTaskTemplateSeed: Decodable, Sendable, Hashable {
    public let title: String?
    public let category: String?
    public let tags: [String]?
    public let payType: String?
    public let scheduleType: String?

    enum CodingKeys: String, CodingKey {
        case title, category, tags
        case payType = "pay_type"
        case scheduleType = "schedule_type"
    }
}
