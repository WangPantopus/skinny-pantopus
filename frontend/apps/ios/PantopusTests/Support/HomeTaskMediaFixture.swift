import Foundation
import XCTest
@testable import Pantopus

@MainActor
struct HomeTaskMediaFixture {
    let home = "52000000-0000-4000-8000-000000000001"
    let task = "52000000-0000-4000-8000-000000000002"
    let actor = "52000000-0000-4000-8000-000000000003"
    let upload = "52000000-0000-4000-8000-000000000004"
    let scope = String(repeating: "a", count: 64)
    let fileText = "exact private attachment"
    var file: ClaimPickedFile {
        .init(filename: "private-original.txt", mimeType: "text/plain", data: Data(fileText.utf8))
    }

    var pending: PendingHomeTaskUpload {
        .init(id: upload, file: file)
    }

    var path: String {
        "/api/upload/home-task-media/\(home)/\(task)"
    }

    var taskPath: String {
        "/api/homes/\(home)/tasks/\(task)"
    }

    func client(identity: @escaping () -> String? = { "opening" }) -> HomeTaskMediaClient {
        let api = APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        return HomeTaskMediaClient(
            homeId: home,
            taskId: task,
            api: api,
            uploader: MultipartUploader(session: SequencedURLProtocol.makeSession()),
            access: HomeTaskAccess(homeId: home, api: api, actorId: actor, identity: identity)
        )
    }

    func json(_ value: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value), let result = String(data: data, encoding: .utf8) else {
            XCTFail("Invalid attachment fixture")
            return "{}"
        }
        return result
    }

    func taskResponse(canUpload: Bool = true, session: String? = nil) -> String {
        json([
            "task": [
                "id": task,
                "home_id": home,
                "task_type": "chore",
                "title": "Private task",
                "status": "open",
                "capabilities": ["can_upload": canUpload]
            ],
            "task_session": ["home_id": home, "actor_id": actor, "session_scope": session ?? scope]
        ])
    }

    func record(_ changes: [String: Any] = [:], pending: PendingHomeTaskUpload? = nil) -> [String: Any] {
        let pending = pending ?? self.pending
        return [
            "id": pending.id,
            "home_id": home,
            "task_id": task,
            "uploaded_by": actor,
            "file_name": pending.serverFilename,
            "mime_type": pending.file.mimeType,
            "file_size": pending.file.data.count,
            "state": "ready",
            "available": true,
            "cleanup_pending": false
        ].merging(changes) { _, value in value }
    }

    func decoded(_ changes: [String: Any] = [:], pending: PendingHomeTaskUpload? = nil) throws -> HomeTaskMediaDTO {
        try JSONDecoder().decode(HomeTaskMediaDTO.self, from: Data(json(record(changes, pending: pending)).utf8))
    }

    func list(canUpload: Bool = true, records: [[String: Any]]? = nil) -> String {
        json(["can_upload": canUpload, "media": records ?? [record()]])
    }

    func routes(canUpload: Bool = true, records: [[String: Any]]? = nil) {
        SequencedURLProtocol.routeResponses = [
            taskPath: Array(repeating: .status(200, body: taskResponse(canUpload: canUpload)), count: 60),
            path: Array(repeating: .status(200, body: list(canUpload: canUpload, records: records)), count: 30),
            "\(path)/\(upload)/download": [
                .status(200, body: fileText, headers: ["Content-Type": file.mimeType])
            ]
        ]
    }

    func waitForRequest(_ predicate: (URLRequest) -> Bool) async throws {
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.contains(where: predicate) { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTFail("Expected attachment request did not begin")
    }

    func body(_ request: URLRequest) throws -> String {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
        }
        return try XCTUnwrap(String(data: data, encoding: .utf8))
    }
}
