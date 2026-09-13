import Foundation

public enum HomeTaskRecurrenceFrequency: String, Codable, Sendable, CaseIterable {
    case daily = "DAILY"
    case weekly = "WEEKLY"
    case monthly = "MONTHLY"

    var period: String {
        switch self {
        case .daily: "day"
        case .weekly: "week"
        case .monthly: "month"
        }
    }
}

enum HomeTaskRecurrenceDate {
    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    static func label(_ value: String, timezone: String) -> String {
        guard let date = parse(value), let zone = TimeZone(identifier: timezone) else { return "Date unavailable" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.timeZone = zone
        return formatter.string(from: date)
    }
}

public struct HomeTaskAutomaticRecurrence: Decodable, Sendable, Hashable {
    public let state: String
    public let frequency: HomeTaskRecurrenceFrequency
    public let interval: Int
    public let timezone: String
    public let nextDueAt: String?

    private enum CodingKeys: String, CodingKey {
        case state, frequency, interval, timezone
        case nextDueAt = "next_due_at"
    }

    var valid: Bool {
        ["active", "paused", "needs_review"].contains(state) && (1...365).contains(interval)
            && TimeZone(identifier: timezone) != nil
            && (state == "active" ? HomeTaskRecurrenceDate.parse(nextDueAt) != nil : nextDueAt == nil)
    }

    var label: String {
        switch state {
        case "active": "Repeats every \(interval) \(frequency.period)\(interval == 1 ? "" : "s")"
        case "paused": "Repeats paused"
        default: "Repeats need review"
        }
    }
}

struct HomeTaskRecurrenceConfiguration: Decodable, Equatable {
    let id: String
    let revision: Int
    let state: String
    let reason: String?
    let frequency: HomeTaskRecurrenceFrequency
    let interval: Int
    let timezone: String
    let anchorAt: String
    let nextDueAt: String?
    let lastDueAt: String?
    let lastTaskId: String?
    let generatedCount: Int

    private enum CodingKeys: String, CodingKey {
        case id, revision, state, reason, frequency, interval, timezone
        case anchorAt = "anchor_at", nextDueAt = "next_due_at", lastDueAt = "last_due_at"
        case lastTaskId = "last_task_id", generatedCount = "generated_count"
    }

    var valid: Bool {
        UUID(uuidString: id) != nil && revision > 0 && revision <= 999_999_999_999_999
            && ["active", "paused", "needs_review"].contains(state)
            && (1...365).contains(interval) && TimeZone(identifier: timezone) != nil
            && HomeTaskRecurrenceDate.parse(anchorAt) != nil && generatedCount >= 0
            && (state == "active" ? HomeTaskRecurrenceDate.parse(nextDueAt) != nil : nextDueAt == nil)
            && (lastDueAt == nil || HomeTaskRecurrenceDate.parse(lastDueAt) != nil)
            && (lastTaskId == nil || lastTaskId.flatMap(UUID.init(uuidString:)) != nil)
    }
}

struct HomeTaskRecurrenceState: Decodable {
    let ok: Bool
    let homeId: String
    let taskId: String
    let canManage: Bool
    let taskUpdatedAt: String
    let revision: Int
    let configuration: HomeTaskRecurrenceConfiguration?
    let taskSession: HomeTaskSession

    private enum CodingKeys: String, CodingKey {
        case ok, revision, configuration
        case homeId = "home_id", taskId = "task_id", canManage = "can_manage"
        case taskUpdatedAt = "task_updated_at", taskSession = "task_session"
    }

    func matches(home: String, task: String) -> Bool {
        ok && homeId == home && taskId == task && HomeTaskRecurrenceDate.parse(taskUpdatedAt) != nil
            && revision >= 0 && revision <= 999_999_999_999_999
            && (configuration.map { $0.valid && $0.revision == revision } ?? (revision == 0))
    }
}

struct HomeTaskRecurrenceResponse: Decodable {
    let state: HomeTaskRecurrenceState
    let receipt: HomeTaskRecurrenceReceipt
    let replayed: Bool

    private enum CodingKeys: CodingKey { case receipt, replayed }

    init(from decoder: any Decoder) throws {
        state = try HomeTaskRecurrenceState(from: decoder)
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        receipt = try fields.decode(HomeTaskRecurrenceReceipt.self, forKey: .receipt)
        replayed = try fields.decode(Bool.self, forKey: .replayed)
    }
}
