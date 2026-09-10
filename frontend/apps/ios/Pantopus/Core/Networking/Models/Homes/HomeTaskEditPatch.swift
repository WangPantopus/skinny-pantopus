import Foundation

/// Dictionary presence distinguishes an untouched value from an intentional null.
struct HomeTaskEditPatch: Encodable, Equatable {
    let values: [String: String?]

    func encode(to encoder: any Encoder) throws {
        var fields = encoder.singleValueContainer()
        try fields.encode(values)
    }

    func matches(_ task: HomeTaskDTO) -> Bool {
        values.allSatisfy { key, value in
            switch key {
            case "title": return task.title == value
            case "task_type": return task.taskType == value
            case "description": return task.description == value
            case "assigned_to": return task.assignedTo == value
            case "recurrence_rule": return task.recurrenceRule == value
            case "due_at":
                if value == nil { return task.dueAt == nil }
                guard let expected = Self.date(value), let actual = Self.date(task.dueAt) else { return false }
                return expected == actual
            default: return false
            }
        }
    }

    private static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = format.date(from: value) { return date }
        format.formatOptions = [.withInternetDateTime]
        if let date = format.date(from: value) { return date }
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .iso8601)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = TimeZone(secondsFromGMT: 0)
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: value)
    }
}
