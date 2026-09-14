import Foundation

public struct HomeTaskCapabilities: Decodable, Sendable, Hashable {
    public let canEdit: Bool?
    public let canComplete: Bool?
    public let canDelete: Bool?
    public let canUpload: Bool?

    private enum CodingKeys: String, CodingKey {
        case canEdit = "can_edit"
        case canComplete = "can_complete"
        case canDelete = "can_delete"
        case canUpload = "can_upload"
    }
}

public struct HomeTaskCollectionCapabilities: Decodable, Sendable {
    public let canCreate: Bool

    private enum CodingKeys: String, CodingKey {
        case canCreate = "can_create"
    }
}

public struct HomeTaskSession: Decodable, Sendable, Equatable {
    public let actorId: String
    public let homeId: String
    public let sessionScope: String

    private enum CodingKeys: String, CodingKey {
        case actorId = "actor_id"
        case homeId = "home_id"
        case sessionScope = "session_scope"
    }

    func matches(homeId: String, actorId: String) -> Bool {
        self.homeId == homeId && self.actorId == actorId && sessionScope.count == 64
            && sessionScope.allSatisfy { "0123456789abcdef".contains($0) }
    }
}
