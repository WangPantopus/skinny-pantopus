//
//  MailDayDTOs.swift
//  Pantopus
//
//  P3F / A13.16 — wire DTOs for the My Mail Day triage backend
//  (`backend/routes/mailDay.js`). These are distinct from the feature's
//  render models in `Features/Mailbox/MailDay/MailDayContent.swift`; the
//  view-model maps DTO → render model.
//

import Foundation

/// `GET /api/mailbox/v2/mailday/today` — the full day frame.
public struct MailDayTodayResponse: Decodable, Sendable, Hashable {
    public let dateLabel: String
    public let streakDays: Int
    public let lastScanLabel: String
    public let unreviewed: [MailDayUnreviewedDTO]
    public let reviewed: [MailDayReviewedDTO]
    public let yesterdayRecap: MailDayRecapDTO?
    public let setupNudges: [MailDayNudgeDTO]

    private enum CodingKeys: String, CodingKey {
        case dateLabel = "date_label"
        case streakDays = "streak_days"
        case lastScanLabel = "last_scan_label"
        case unreviewed
        case reviewed
        case yesterdayRecap = "yesterday_recap"
        case setupNudges = "setup_nudges"
    }
}

public struct MailDayUnreviewedDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: String
    public let label: String
    public let sender: String
    public let suggestedName: String
    public let suggestedAvatar: String
    public let confidencePercent: Int
    public let secondaryLabel: String

    private enum CodingKeys: String, CodingKey {
        case id, kind, label, sender
        case suggestedName = "suggested_name"
        case suggestedAvatar = "suggested_avatar"
        case confidencePercent = "confidence_percent"
        case secondaryLabel = "secondary_label"
    }
}

public struct MailDayReviewedDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: String
    public let label: String
    public let action: String
    public let routedTo: String?
    public let routedTint: String?
    public let whenLabel: String
    public let undoCountdown: Int?

    private enum CodingKeys: String, CodingKey {
        case id, kind, label, action
        case routedTo = "routed_to"
        case routedTint = "routed_tint"
        case whenLabel = "when_label"
        case undoCountdown = "undo_countdown"
    }
}

public struct MailDayRecapDTO: Decodable, Sendable, Hashable {
    public let dateLabel: String
    public let pieces: Int
    public let closedAtLabel: String
    public let segments: [MailDayRecapSegmentDTO]

    private enum CodingKeys: String, CodingKey {
        case dateLabel = "date_label"
        case pieces
        case closedAtLabel = "closed_at_label"
        case segments
    }
}

public struct MailDayRecapSegmentDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let percent: Double
    public let label: String
    public let tint: String
}

public struct MailDayNudgeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let subtitle: String
}

/// `POST /api/mailbox/v2/mailday/items/:itemId/route|junk|return` — `{ item }`.
public struct MailDayActionResponse: Decodable, Sendable, Hashable {
    public let item: MailDayReviewedDTO
}

/// `POST /api/mailbox/v2/mailday/finish`.
public struct MailDayFinishResponse: Decodable, Sendable, Hashable {
    public let streakDays: Int
    public let pieces: Int
    public let routedCount: Int
    public let junkedCount: Int
    public let returnedCount: Int

    private enum CodingKeys: String, CodingKey {
        case streakDays = "streak_days"
        case pieces
        case routedCount = "routed_count"
        case junkedCount = "junked_count"
        case returnedCount = "returned_count"
    }
}
