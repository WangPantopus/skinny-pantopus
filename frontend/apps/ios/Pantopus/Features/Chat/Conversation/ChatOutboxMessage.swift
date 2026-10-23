import Foundation

/// A send keeps its original id and payload until the server confirms it.
/// Attachments name encrypted files; their bytes are never put in the JSON envelope.
struct ChatOutboxMessage: Codable, Identifiable {
    enum Destination: String, Codable { case person, room }
    enum Status: String, Codable { case queued, retrying, failed, refused }

    let id: String
    let destination: Destination
    let targetId: String
    let businessUserId: String?
    var roomId: String?
    let text: String
    let messageType: String?
    let metadata: [String: JSONValue]?
    let replyToId: String?
    let replyRoomId: String?
    let topicId: String?
    let createdAt: String
    let queuedAt: Date
    let attachments: [ChatOutboxAttachment]
    var fileIds: [String]?
    var status: Status = .queued
    var attempts = 0
    var retryAt: Date?
    var failure: String?
}

struct ChatOutboxAttachment: Codable, Identifiable {
    let id: String
    let filename: String
    let mimeType: String
    let isImage: Bool
    let size: Int
    let liveVideoSize: Int?

    var file: String {
        ScreenStoreDisk.hashed(id) + ".sealed"
    }

    var liveVideoFile: String {
        ScreenStoreDisk.hashed(id) + "-live.sealed"
    }

    init(_ attachment: ChatQueuedAttachment) {
        id = attachment.id
        filename = attachment.filename
        mimeType = attachment.mimeType
        isImage = attachment.kind == .image
        size = attachment.data?.count ?? 0
        liveVideoSize = attachment.liveVideo?.count
    }
}

enum ChatLocalStorageError: LocalizedError {
    case quota
    case damagedAttachment
    case unavailable

    var errorDescription: String? {
        switch self {
        case .quota: "Unsent messages are using 100 MB. Let queued uploads finish, then try again."
        case .damagedAttachment: "That queued file could not be restored. Attach it again to send it."
        case .unavailable: "Couldn't save this message on your device. Reopen the app and try again."
        }
    }
}
