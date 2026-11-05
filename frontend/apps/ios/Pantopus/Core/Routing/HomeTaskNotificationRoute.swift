import Foundation

/// Only exact task metadata selects a task; legacy links retain their old path.
enum HomeTaskNotificationRoute {
    static func isTask(_ type: String?) -> Bool {
        ["task_assigned", "task_completed", "task_due"].contains(type?.lowercased() ?? "")
    }

    static func path(type: String?, homeId: String?, taskId: String?) -> String? {
        guard isTask(type), let homeId, let taskId,
              UUID(uuidString: homeId) != nil, UUID(uuidString: taskId) != nil else { return nil }
        return "/app/homes/\(homeId.lowercased())/tasks/\(taskId.lowercased())"
    }

    nonisolated static func pushPath(_ userInfo: [AnyHashable: Any]) -> String? {
        let metadata = userInfo["metadata"] as? [String: Any]
        return path(
            type: userInfo["type"] as? String,
            homeId: userInfo["homeId"] as? String ?? userInfo["home_id"] as? String ?? metadata?["home_id"] as? String,
            taskId: userInfo["taskId"] as? String ?? userInfo["task_id"] as? String ?? metadata?["task_id"] as? String
        )
    }
}

/// A Crew Day notice (launch cut #13) carries its web path as `link`; one
/// that arrives without a link opens by its metadata: the household's
/// booking, else the crew's day. Operator notices stay on the web.
enum CrewDayNotificationRoute {
    static func path(type: String?, link: String?, bookingId: String?, crewDayId: String?) -> String? {
        let type = type?.lowercased() ?? ""
        guard type.hasPrefix("crew_day"), link?.isEmpty ?? true else { return nil }
        if householdTypes.contains(type), let bookingId, UUID(uuidString: bookingId) != nil {
            return "/app/crew-days/bookings/\(bookingId.lowercased())"
        }
        if crewTypes.contains(type), let crewDayId, UUID(uuidString: crewDayId) != nil {
            return "/app/businesses/crew/crew-days/\(crewDayId.lowercased())"
        }
        return type == "crew_day_request_answered" ? "/app/crew-days" : nil
    }

    nonisolated static func pushPath(_ userInfo: [AnyHashable: Any]) -> String? {
        let metadata = userInfo["metadata"] as? [String: Any]
        return path(
            type: userInfo["type"] as? String,
            link: userInfo["link"] as? String,
            bookingId: userInfo["booking_id"] as? String ?? metadata?["booking_id"] as? String,
            crewDayId: userInfo["crew_day_id"] as? String ?? metadata?["crew_day_id"] as? String
        )
    }

    /// Notices about the household's own booking (02-contract.md §6).
    private static let householdTypes: Set<String> = [
        "crew_day_booked", "crew_day_price_offered", "crew_day_reminder", "crew_day_on_the_way",
        "crew_day_eta_changed", "crew_day_cant_get_in", "crew_day_done", "crew_day_charged",
        "crew_day_charge_failed", "crew_day_new_dates", "crew_day_cancelled", "crew_day_problem_update",
        "crew_day_invite"
    ]

    /// Notices to the crew about its day.
    private static let crewTypes: Set<String> = [
        "crew_day_approved", "crew_day_declined", "crew_day_new_booking", "crew_day_price_needed",
        "crew_day_booking_cancelled", "crew_day_release_asked", "crew_day_gate_ready", "crew_day_problem",
        "crew_day_dates_answered"
    ]
}

/// Notification metadata is heterogeneous. Unrelated or malformed fields must
/// not make the entire notification list fail to decode.
public struct HomeTaskNotificationMetadata: Decodable, Sendable, Hashable {
    public let homeId: String?
    public let taskId: String?
    /// A brief's or nudge's assistant conversation (AI assistant phase 2 §3.2).
    public let conversationId: String?
    /// A Crew Day notice's booking and day (launch cut #13).
    public let bookingId: String?
    public let crewDayId: String?
    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id", taskId = "task_id", conversationId = "conversation_id"
        case bookingId = "booking_id", crewDayId = "crew_day_id"
    }

    public init(from decoder: any Decoder) throws {
        let fields = try? decoder.container(keyedBy: CodingKeys.self)
        homeId = try? fields?.decode(String.self, forKey: .homeId)
        taskId = try? fields?.decode(String.self, forKey: .taskId)
        conversationId = try? fields?.decode(String.self, forKey: .conversationId)
        bookingId = try? fields?.decode(String.self, forKey: .bookingId)
        crewDayId = try? fields?.decode(String.self, forKey: .crewDayId)
    }
}
