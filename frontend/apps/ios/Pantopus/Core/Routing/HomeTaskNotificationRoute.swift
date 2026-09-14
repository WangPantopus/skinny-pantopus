import Foundation

/// Only exact task metadata selects a task; legacy links retain their old path.
enum HomeTaskNotificationRoute {
    static func isTask(_ type: String?) -> Bool {
        ["task_assigned", "task_completed"].contains(type?.lowercased() ?? "")
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
            homeId: userInfo["home_id"] as? String ?? metadata?["home_id"] as? String,
            taskId: userInfo["task_id"] as? String ?? metadata?["task_id"] as? String
        )
    }
}

/// Notification metadata is heterogeneous. Unrelated or malformed fields must
/// not make the entire notification list fail to decode.
public struct HomeTaskNotificationMetadata: Decodable, Sendable, Hashable {
    public let homeId: String?
    public let taskId: String?
    private enum CodingKeys: String, CodingKey { case homeId = "home_id", taskId = "task_id" }

    public init(from decoder: any Decoder) throws {
        let fields = try? decoder.container(keyedBy: CodingKeys.self)
        homeId = try? fields?.decode(String.self, forKey: .homeId)
        taskId = try? fields?.decode(String.self, forKey: .taskId)
    }
}
