//
//  AvailabilityDTOs.swift
//  Pantopus
//
//  DTOs for availability — route `/api/scheduling/availability*`. Availability
//  is ALWAYS personal (scoped to `req.user`, no owner context). See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// A named availability schedule (one is the default).
public struct AvailabilityScheduleDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let name: String?
    public let timezone: String?
    public let isDefault: Bool?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case timezone
        case isDefault = "is_default"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// A weekly-recurring availability rule (weekday + HH:MM window).
public struct AvailabilityRuleDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let scheduleId: String?
    /// 0=Sunday … 6=Saturday (ISO).
    public let weekday: Int
    /// `HH:MM` or `HH:MM:SS`.
    public let startTime: String
    public let endTime: String

    enum CodingKeys: String, CodingKey {
        case id
        case scheduleId = "schedule_id"
        case weekday
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

/// A date-level override (a holiday all-day block or a partial-day window).
public struct AvailabilityOverrideDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let scheduleId: String?
    /// `YYYY-MM-DD`.
    public let date: String
    public let isUnavailable: Bool?
    public let startTime: String?
    public let endTime: String?

    enum CodingKeys: String, CodingKey {
        case id
        case scheduleId = "schedule_id"
        case date
        case isUnavailable = "is_unavailable"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

/// An ad-hoc blocked time range (vacation / lunch), optionally recurring.
public struct AvailabilityBlockDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let title: String?
    public let startAt: String
    public let endAt: String
    public let recurrenceRule: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title
        case startAt = "start_at"
        case endAt = "end_at"
        case recurrenceRule = "recurrence_rule"
        case createdAt = "created_at"
    }
}

/// `GET /availability` → schedules + rules + overrides.
public struct AvailabilityResponse: Decodable, Sendable, Hashable {
    public let schedules: [AvailabilityScheduleDTO]
    public let rules: [AvailabilityRuleDTO]
    public let overrides: [AvailabilityOverrideDTO]
}

/// `POST /availability`, `PUT /availability/:id` → `{ schedule }`.
public struct AvailabilityScheduleResponse: Decodable, Sendable, Hashable {
    public let schedule: AvailabilityScheduleDTO
}

/// Body for `POST /availability`.
public struct CreateScheduleRequest: Encodable, Sendable {
    public var name: String?
    public let timezone: String
    public var isDefault: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case timezone
        case isDefault = "is_default"
    }

    public init(timezone: String, name: String? = nil, isDefault: Bool? = nil) {
        self.timezone = timezone
        self.name = name
        self.isDefault = isDefault
    }
}

/// Body for `PUT /availability/:id` — partial; at least one field required.
public struct UpdateScheduleRequest: Encodable, Sendable {
    public var name: String?
    public var timezone: String?
    public var isDefault: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case timezone
        case isDefault = "is_default"
    }

    public init(name: String? = nil, timezone: String? = nil, isDefault: Bool? = nil) {
        self.name = name
        self.timezone = timezone
        self.isDefault = isDefault
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(timezone, forKey: .timezone)
        try c.encodeIfPresent(isDefault, forKey: .isDefault)
    }
}

/// Body for `PUT /availability/:id/rules` → replaces the whole rule set.
public struct RulesRequest: Encodable, Sendable {
    public let rules: [Rule]

    public struct Rule: Encodable, Sendable, Hashable {
        public let weekday: Int
        public let startTime: String
        public let endTime: String

        enum CodingKeys: String, CodingKey {
            case weekday
            case startTime = "start_time"
            case endTime = "end_time"
        }

        public init(weekday: Int, startTime: String, endTime: String) {
            self.weekday = weekday
            self.startTime = startTime
            self.endTime = endTime
        }
    }

    public init(rules: [Rule]) {
        self.rules = rules
    }
}

/// `PUT /availability/:id/rules` → `{ rules }`.
public struct RulesResponse: Decodable, Sendable, Hashable {
    public let rules: [AvailabilityRuleDTO]
}

/// Body for `PUT /availability/:id/overrides` → replaces the whole set.
public struct OverridesRequest: Encodable, Sendable {
    public let overrides: [Override]

    public struct Override: Encodable, Sendable, Hashable {
        public let date: String
        public var isUnavailable: Bool?
        public var startTime: String?
        public var endTime: String?

        enum CodingKeys: String, CodingKey {
            case date
            case isUnavailable = "is_unavailable"
            case startTime = "start_time"
            case endTime = "end_time"
        }

        public init(
            date: String,
            isUnavailable: Bool? = nil,
            startTime: String? = nil,
            endTime: String? = nil
        ) {
            self.date = date
            self.isUnavailable = isUnavailable
            self.startTime = startTime
            self.endTime = endTime
        }
    }

    public init(overrides: [Override]) {
        self.overrides = overrides
    }
}

/// `PUT /availability/:id/overrides` → `{ overrides }`.
public struct OverridesResponse: Decodable, Sendable, Hashable {
    public let overrides: [AvailabilityOverrideDTO]
}

/// Body for `POST /availability/blocks`.
public struct CreateBlockRequest: Encodable, Sendable {
    public var title: String?
    public let startAt: String
    public let endAt: String
    public var recurrenceRule: String?

    enum CodingKeys: String, CodingKey {
        case title
        case startAt = "start_at"
        case endAt = "end_at"
        case recurrenceRule = "recurrence_rule"
    }

    public init(
        startAt: String,
        endAt: String,
        title: String? = nil,
        recurrenceRule: String? = nil
    ) {
        self.startAt = startAt
        self.endAt = endAt
        self.title = title
        self.recurrenceRule = recurrenceRule
    }
}

/// `POST /availability/blocks` → `{ block }`.
public struct AvailabilityBlockResponse: Decodable, Sendable, Hashable {
    public let block: AvailabilityBlockDTO
}
