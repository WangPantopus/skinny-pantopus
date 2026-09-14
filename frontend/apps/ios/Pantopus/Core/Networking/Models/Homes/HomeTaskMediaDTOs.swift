import Foundation

struct HomeTaskMediaDTO: Decodable, Hashable, Identifiable {
    let id: String
    let homeId: String
    let taskId: String
    let uploadedBy: String?
    let fileName: String
    let mimeType: String?
    let fileSize: Int
    let state: String
    let available: Bool
    let cleanupPending: Bool?
    private enum CodingKeys: String, CodingKey {
        case id, state, available
        case homeId = "home_id", taskId = "task_id", uploadedBy = "uploaded_by"
        case fileName = "file_name", mimeType = "mime_type", fileSize = "file_size", cleanupPending = "cleanup_pending"
    }

    func matches(home: String, task: String) -> Bool {
        UUID(uuidString: id) != nil && homeId == home && taskId == task && !fileName.isEmpty && fileSize >= 0
            && ["reserved", "ready", "retired", "legacy"].contains(state)
            && (!available || (state == "ready" && fileSize > 0 && fileSize <= CLAIM_FILE_MAX_BYTES
                    && PrivateClaimEvidenceClient.allowedMIMEs.contains(mimeType ?? "")))
    }

    func sameFile(as other: HomeTaskMediaDTO) -> Bool {
        id == other.id && homeId == other.homeId && taskId == other.taskId && uploadedBy == other.uploadedBy
            && fileName == other.fileName && mimeType == other.mimeType && fileSize == other.fileSize
    }
}

struct HomeTaskMediaList: Decodable {
    let media: [HomeTaskMediaDTO]
    let canUpload: Bool
    private enum CodingKeys: String, CodingKey { case media, canUpload = "can_upload" }
}

struct HomeTaskMediaUpload: Decodable { let media: [HomeTaskMediaDTO] }
struct HomeTaskMediaRemoval: Decodable { let media: HomeTaskMediaDTO }

struct PendingHomeTaskUpload: Equatable {
    let id: String
    let file: ClaimPickedFile
    var serverFilename: String {
        let suffix: String = switch file.mimeType {
        case "application/pdf": "pdf"
        case "text/plain": "txt"
        case "image/jpeg": "jpg"
        case "image/png": "png"
        case "image/webp": "webp"
        case "image/heic": "heic"
        case "image/heif": "heif"
        default: "bin"
        }
        return "task-attachment-\(id).\(suffix)"
    }
}
