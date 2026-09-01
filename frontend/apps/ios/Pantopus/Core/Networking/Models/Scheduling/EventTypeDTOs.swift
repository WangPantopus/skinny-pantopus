//
//  EventTypeDTOs.swift
//  Pantopus
//
//  DTOs for host event types / services — route `/api/scheduling/event-types*`
//  (and the home alias). See `reference/calendarly-backend-api.md`.
//
// swiftlint:disable file_length

import Foundation

/// A host event type / service.
public struct EventTypeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let pageId: String?
    public let ownerType: String?
    public let ownerId: String?
    public let name: String
    public let slug: String
    public let description: String?
    public let color: String?
    public let durations: [Int]
    public let defaultDuration: Int?
    /// `video` | `phone` | `in_person` | `custom` | `ask`.
    public let locationMode: String?
    public let locationDetail: String?
    /// `one_on_one` | `collective` | `round_robin` | `group`.
    public let assignmentMode: String?
    public let requiresApproval: Bool?
    /// `public` | `secret`.
    public let visibility: String?
    public let bufferBeforeMin: Int?
    public let bufferAfterMin: Int?
    public let minNoticeMin: Int?
    public let maxHorizonDays: Int?
    public let slotIntervalMin: Int?
    public let dailyCap: Int?
    public let perBookerCap: Int?
    public let seatCap: Int?
    public let priceCents: Int?
    public let currency: String?
    public let depositCents: Int?
    public let depositRefundable: Bool?
    public let cancellationWindowMin: Int?
    public let rescheduleCutoffMin: Int?
    public let noShowFeeCents: Int?
    /// `full` | `partial` | `none` | `deposit_only`.
    public let refundPolicy: String?
    public let allowInviteeCancel: Bool?
    public let allowInviteeReschedule: Bool?
    public let scheduleId: String?
    public let isActive: Bool?
    public let sortOrder: Int?
    /// Active assignee count, aggregated by `GET /event-types` for the list's
    /// "N hosts" pill. Absent on single-row responses.
    public let assigneeCount: Int?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case pageId = "page_id"
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case name
        case slug
        case description
        case color
        case durations
        case defaultDuration = "default_duration"
        case locationMode = "location_mode"
        case locationDetail = "location_detail"
        case assignmentMode = "assignment_mode"
        case requiresApproval = "requires_approval"
        case visibility
        case bufferBeforeMin = "buffer_before_min"
        case bufferAfterMin = "buffer_after_min"
        case minNoticeMin = "min_notice_min"
        case maxHorizonDays = "max_horizon_days"
        case slotIntervalMin = "slot_interval_min"
        case dailyCap = "daily_cap"
        case perBookerCap = "per_booker_cap"
        case seatCap = "seat_cap"
        case priceCents = "price_cents"
        case currency
        case depositCents = "deposit_cents"
        case depositRefundable = "deposit_refundable"
        case cancellationWindowMin = "cancellation_window_min"
        case rescheduleCutoffMin = "reschedule_cutoff_min"
        case noShowFeeCents = "no_show_fee_cents"
        case refundPolicy = "refund_policy"
        case allowInviteeCancel = "allow_invitee_cancel"
        case allowInviteeReschedule = "allow_invitee_reschedule"
        case scheduleId = "schedule_id"
        case isActive = "is_active"
        case sortOrder = "sort_order"
        case assigneeCount = "assignee_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// An event-type assignee (member subject + round-robin weighting).
public struct EventTypeAssigneeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let eventTypeId: String?
    public let subjectId: String
    /// `user` | `business_team`.
    public let subjectType: String?
    public let weight: Int?
    public let priority: Int?
    public let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case eventTypeId = "event_type_id"
        case subjectId = "subject_id"
        case subjectType = "subject_type"
        case weight
        case priority
        case isActive = "is_active"
    }
}

/// An intake question attached to an event type.
public struct EventTypeQuestionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let eventTypeId: String?
    public let label: String
    /// `text` | `textarea` | `select` | `multiselect` | `checkbox` | `phone`.
    public let fieldType: String?
    public let options: [String]?
    public let required: Bool?
    public let sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case eventTypeId = "event_type_id"
        case label
        case fieldType = "field_type"
        case options
        case required
        case sortOrder = "sort_order"
    }
}

/// `GET /event-types` → `{ eventTypes }`.
public struct EventTypesResponse: Decodable, Sendable, Hashable {
    public let eventTypes: [EventTypeDTO]
}

/// `POST /event-types`, `PUT /event-types/:id` → `{ eventType }`.
public struct EventTypeResponse: Decodable, Sendable, Hashable {
    public let eventType: EventTypeDTO
}

/// `GET /event-types/:id` → event type + assignees + questions.
public struct EventTypeDetailResponse: Decodable, Sendable, Hashable {
    public let eventType: EventTypeDTO
    public let assignees: [EventTypeAssigneeDTO]?
    public let questions: [EventTypeQuestionDTO]?
}

/// Body for `POST /event-types`. Owner fields are spliced in by the endpoint
/// builder via `OwnerScopedBody`. Mirrors `eventTypeSchema`.
public struct CreateEventTypeRequest: Encodable, Sendable {
    public var name: String
    public var slug: String
    public var description: String?
    public var color: String?
    public var durations: [Int]?
    public var defaultDuration: Int?
    public var locationMode: String?
    public var locationDetail: String?
    public var assignmentMode: String?
    public var requiresApproval: Bool?
    public var visibility: String?
    public var bufferBeforeMin: Int?
    public var bufferAfterMin: Int?
    public var minNoticeMin: Int?
    public var maxHorizonDays: Int?
    public var slotIntervalMin: Int?
    public var dailyCap: Int?
    public var perBookerCap: Int?
    public var seatCap: Int?
    public var priceCents: Int?
    public var currency: String?
    public var depositCents: Int?
    public var depositRefundable: Bool?
    public var cancellationWindowMin: Int?
    public var rescheduleCutoffMin: Int?
    public var noShowFeeCents: Int?
    public var refundPolicy: String?
    public var allowInviteeCancel: Bool?
    public var allowInviteeReschedule: Bool?
    public var scheduleId: String?

    enum CodingKeys: String, CodingKey {
        case name
        case slug
        case description
        case color
        case durations
        case defaultDuration = "default_duration"
        case locationMode = "location_mode"
        case locationDetail = "location_detail"
        case assignmentMode = "assignment_mode"
        case requiresApproval = "requires_approval"
        case visibility
        case bufferBeforeMin = "buffer_before_min"
        case bufferAfterMin = "buffer_after_min"
        case minNoticeMin = "min_notice_min"
        case maxHorizonDays = "max_horizon_days"
        case slotIntervalMin = "slot_interval_min"
        case dailyCap = "daily_cap"
        case perBookerCap = "per_booker_cap"
        case seatCap = "seat_cap"
        case priceCents = "price_cents"
        case currency
        case depositCents = "deposit_cents"
        case depositRefundable = "deposit_refundable"
        case cancellationWindowMin = "cancellation_window_min"
        case rescheduleCutoffMin = "reschedule_cutoff_min"
        case noShowFeeCents = "no_show_fee_cents"
        case refundPolicy = "refund_policy"
        case allowInviteeCancel = "allow_invitee_cancel"
        case allowInviteeReschedule = "allow_invitee_reschedule"
        case scheduleId = "schedule_id"
    }

    public init(
        name: String,
        slug: String,
        description: String? = nil,
        color: String? = nil,
        durations: [Int]? = nil,
        defaultDuration: Int? = nil,
        locationMode: String? = nil,
        locationDetail: String? = nil,
        assignmentMode: String? = nil,
        requiresApproval: Bool? = nil,
        visibility: String? = nil,
        bufferBeforeMin: Int? = nil,
        bufferAfterMin: Int? = nil,
        minNoticeMin: Int? = nil,
        maxHorizonDays: Int? = nil,
        slotIntervalMin: Int? = nil,
        dailyCap: Int? = nil,
        perBookerCap: Int? = nil,
        seatCap: Int? = nil,
        priceCents: Int? = nil,
        currency: String? = nil,
        depositCents: Int? = nil,
        depositRefundable: Bool? = nil,
        cancellationWindowMin: Int? = nil,
        rescheduleCutoffMin: Int? = nil,
        noShowFeeCents: Int? = nil,
        refundPolicy: String? = nil,
        allowInviteeCancel: Bool? = nil,
        allowInviteeReschedule: Bool? = nil,
        scheduleId: String? = nil
    ) {
        self.name = name
        self.slug = slug
        self.description = description
        self.color = color
        self.durations = durations
        self.defaultDuration = defaultDuration
        self.locationMode = locationMode
        self.locationDetail = locationDetail
        self.assignmentMode = assignmentMode
        self.requiresApproval = requiresApproval
        self.visibility = visibility
        self.bufferBeforeMin = bufferBeforeMin
        self.bufferAfterMin = bufferAfterMin
        self.minNoticeMin = minNoticeMin
        self.maxHorizonDays = maxHorizonDays
        self.slotIntervalMin = slotIntervalMin
        self.dailyCap = dailyCap
        self.perBookerCap = perBookerCap
        self.seatCap = seatCap
        self.priceCents = priceCents
        self.currency = currency
        self.depositCents = depositCents
        self.depositRefundable = depositRefundable
        self.cancellationWindowMin = cancellationWindowMin
        self.rescheduleCutoffMin = rescheduleCutoffMin
        self.noShowFeeCents = noShowFeeCents
        self.refundPolicy = refundPolicy
        self.allowInviteeCancel = allowInviteeCancel
        self.allowInviteeReschedule = allowInviteeReschedule
        self.scheduleId = scheduleId
    }
}

/// Body for `PUT /event-types/:id` — partial update; every field optional.
/// Reuses `CreateEventTypeRequest`'s `CodingKeys` shape but only encodes
/// present keys.
public struct UpdateEventTypeRequest: Encodable, Sendable {
    public var name: String?
    public var slug: String?
    public var description: String?
    public var color: String?
    public var durations: [Int]?
    public var defaultDuration: Int?
    public var locationMode: String?
    public var locationDetail: String?
    public var assignmentMode: String?
    public var requiresApproval: Bool?
    public var visibility: String?
    public var bufferBeforeMin: Int?
    public var bufferAfterMin: Int?
    public var minNoticeMin: Int?
    public var maxHorizonDays: Int?
    public var slotIntervalMin: Int?
    public var dailyCap: Int?
    public var perBookerCap: Int?
    public var seatCap: Int?
    public var priceCents: Int?
    public var currency: String?
    public var depositCents: Int?
    public var depositRefundable: Bool?
    public var cancellationWindowMin: Int?
    public var rescheduleCutoffMin: Int?
    public var noShowFeeCents: Int?
    public var refundPolicy: String?
    public var allowInviteeCancel: Bool?
    public var allowInviteeReschedule: Bool?
    public var scheduleId: String?
    public var isActive: Bool?
    /// B1 reorder mode persists catalog position here (backend accepts sort_order
    /// on PUT /event-types/:id; the list endpoint already orders by it).
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case slug
        case description
        case color
        case durations
        case defaultDuration = "default_duration"
        case locationMode = "location_mode"
        case locationDetail = "location_detail"
        case assignmentMode = "assignment_mode"
        case requiresApproval = "requires_approval"
        case visibility
        case bufferBeforeMin = "buffer_before_min"
        case bufferAfterMin = "buffer_after_min"
        case minNoticeMin = "min_notice_min"
        case maxHorizonDays = "max_horizon_days"
        case slotIntervalMin = "slot_interval_min"
        case dailyCap = "daily_cap"
        case perBookerCap = "per_booker_cap"
        case seatCap = "seat_cap"
        case priceCents = "price_cents"
        case currency
        case depositCents = "deposit_cents"
        case depositRefundable = "deposit_refundable"
        case cancellationWindowMin = "cancellation_window_min"
        case rescheduleCutoffMin = "reschedule_cutoff_min"
        case noShowFeeCents = "no_show_fee_cents"
        case refundPolicy = "refund_policy"
        case allowInviteeCancel = "allow_invitee_cancel"
        case allowInviteeReschedule = "allow_invitee_reschedule"
        case scheduleId = "schedule_id"
        case isActive = "is_active"
        case sortOrder = "sort_order"
    }

    public init(
        name: String? = nil,
        slug: String? = nil,
        description: String? = nil,
        color: String? = nil,
        durations: [Int]? = nil,
        defaultDuration: Int? = nil,
        locationMode: String? = nil,
        locationDetail: String? = nil,
        assignmentMode: String? = nil,
        requiresApproval: Bool? = nil,
        visibility: String? = nil,
        bufferBeforeMin: Int? = nil,
        bufferAfterMin: Int? = nil,
        minNoticeMin: Int? = nil,
        maxHorizonDays: Int? = nil,
        slotIntervalMin: Int? = nil,
        dailyCap: Int? = nil,
        perBookerCap: Int? = nil,
        seatCap: Int? = nil,
        priceCents: Int? = nil,
        currency: String? = nil,
        depositCents: Int? = nil,
        depositRefundable: Bool? = nil,
        cancellationWindowMin: Int? = nil,
        rescheduleCutoffMin: Int? = nil,
        noShowFeeCents: Int? = nil,
        refundPolicy: String? = nil,
        allowInviteeCancel: Bool? = nil,
        allowInviteeReschedule: Bool? = nil,
        scheduleId: String? = nil,
        isActive: Bool? = nil,
        sortOrder: Int? = nil
    ) {
        self.name = name
        self.slug = slug
        self.description = description
        self.color = color
        self.durations = durations
        self.defaultDuration = defaultDuration
        self.locationMode = locationMode
        self.locationDetail = locationDetail
        self.assignmentMode = assignmentMode
        self.requiresApproval = requiresApproval
        self.visibility = visibility
        self.bufferBeforeMin = bufferBeforeMin
        self.bufferAfterMin = bufferAfterMin
        self.minNoticeMin = minNoticeMin
        self.maxHorizonDays = maxHorizonDays
        self.slotIntervalMin = slotIntervalMin
        self.dailyCap = dailyCap
        self.perBookerCap = perBookerCap
        self.seatCap = seatCap
        self.priceCents = priceCents
        self.currency = currency
        self.depositCents = depositCents
        self.depositRefundable = depositRefundable
        self.cancellationWindowMin = cancellationWindowMin
        self.rescheduleCutoffMin = rescheduleCutoffMin
        self.noShowFeeCents = noShowFeeCents
        self.refundPolicy = refundPolicy
        self.allowInviteeCancel = allowInviteeCancel
        self.allowInviteeReschedule = allowInviteeReschedule
        self.scheduleId = scheduleId
        self.isActive = isActive
        self.sortOrder = sortOrder
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(slug, forKey: .slug)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(color, forKey: .color)
        try c.encodeIfPresent(durations, forKey: .durations)
        try c.encodeIfPresent(defaultDuration, forKey: .defaultDuration)
        try c.encodeIfPresent(locationMode, forKey: .locationMode)
        try c.encodeIfPresent(locationDetail, forKey: .locationDetail)
        try c.encodeIfPresent(assignmentMode, forKey: .assignmentMode)
        try c.encodeIfPresent(requiresApproval, forKey: .requiresApproval)
        try c.encodeIfPresent(visibility, forKey: .visibility)
        try c.encodeIfPresent(bufferBeforeMin, forKey: .bufferBeforeMin)
        try c.encodeIfPresent(bufferAfterMin, forKey: .bufferAfterMin)
        try c.encodeIfPresent(minNoticeMin, forKey: .minNoticeMin)
        try c.encodeIfPresent(maxHorizonDays, forKey: .maxHorizonDays)
        try c.encodeIfPresent(slotIntervalMin, forKey: .slotIntervalMin)
        try c.encodeIfPresent(dailyCap, forKey: .dailyCap)
        try c.encodeIfPresent(perBookerCap, forKey: .perBookerCap)
        try c.encodeIfPresent(seatCap, forKey: .seatCap)
        try c.encodeIfPresent(priceCents, forKey: .priceCents)
        try c.encodeIfPresent(currency, forKey: .currency)
        try c.encodeIfPresent(depositCents, forKey: .depositCents)
        try c.encodeIfPresent(depositRefundable, forKey: .depositRefundable)
        try c.encodeIfPresent(cancellationWindowMin, forKey: .cancellationWindowMin)
        try c.encodeIfPresent(rescheduleCutoffMin, forKey: .rescheduleCutoffMin)
        try c.encodeIfPresent(noShowFeeCents, forKey: .noShowFeeCents)
        try c.encodeIfPresent(refundPolicy, forKey: .refundPolicy)
        try c.encodeIfPresent(allowInviteeCancel, forKey: .allowInviteeCancel)
        try c.encodeIfPresent(allowInviteeReschedule, forKey: .allowInviteeReschedule)
        try c.encodeIfPresent(scheduleId, forKey: .scheduleId)
        try c.encodeIfPresent(isActive, forKey: .isActive)
        try c.encodeIfPresent(sortOrder, forKey: .sortOrder)
    }
}

/// Body for `PUT /event-types/:id/assignees` → replaces the whole set.
public struct AssigneesRequest: Encodable, Sendable {
    public let assignees: [Assignee]

    public struct Assignee: Encodable, Sendable, Hashable {
        public let subjectId: String
        public var subjectType: String?
        public var weight: Int?
        public var priority: Int?
        public var isActive: Bool?

        enum CodingKeys: String, CodingKey {
            case subjectId = "subject_id"
            case subjectType = "subject_type"
            case weight
            case priority
            case isActive = "is_active"
        }

        public init(
            subjectId: String,
            subjectType: String? = nil,
            weight: Int? = nil,
            priority: Int? = nil,
            isActive: Bool? = nil
        ) {
            self.subjectId = subjectId
            self.subjectType = subjectType
            self.weight = weight
            self.priority = priority
            self.isActive = isActive
        }
    }

    public init(assignees: [Assignee]) {
        self.assignees = assignees
    }
}

/// `PUT /event-types/:id/assignees` → `{ assignees }`.
public struct AssigneesResponse: Decodable, Sendable, Hashable {
    public let assignees: [EventTypeAssigneeDTO]
}

/// Body for `PUT /event-types/:id/questions` → replaces the whole set.
public struct QuestionsRequest: Encodable, Sendable {
    public let questions: [Question]

    public struct Question: Encodable, Sendable, Hashable {
        public let label: String
        public var fieldType: String?
        public var options: [String]?
        public var required: Bool?
        public var sortOrder: Int?

        enum CodingKeys: String, CodingKey {
            case label
            case fieldType = "field_type"
            case options
            case required
            case sortOrder = "sort_order"
        }

        public init(
            label: String,
            fieldType: String? = nil,
            options: [String]? = nil,
            required: Bool? = nil,
            sortOrder: Int? = nil
        ) {
            self.label = label
            self.fieldType = fieldType
            self.options = options
            self.required = required
            self.sortOrder = sortOrder
        }
    }

    public init(questions: [Question]) {
        self.questions = questions
    }
}

/// `PUT /event-types/:id/questions` → `{ questions }`.
public struct QuestionsResponse: Decodable, Sendable, Hashable {
    public let questions: [EventTypeQuestionDTO]
}
