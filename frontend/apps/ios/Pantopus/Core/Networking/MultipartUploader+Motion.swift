//
//  MultipartUploader+Motion.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece C (CONTRACT 10b): a Live Photo's motion, sent by its author after the Moment's
//  photo is up, only while the switch is on for them. `POST /api/reinvented/moments/:id/motion`, multipart: the clip
//  (`file`, video/quicktime, at most 4 s and 15 MB) and one or two JPEG frames from it (`frames`). Route
//  `backend/routes/reinvented.js:451`.
//

import Foundation

extension MultipartUploader {
    /// A Moment's motion clip and its frames. Answers the server's status and body; the caller says what a refusal means.
    @MainActor
    func uploadMomentMotion(
        momentId: String,
        clip: MultipartFile,
        frames: [MultipartFile]
    ) async throws -> (status: Int, body: Data) {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let id = momentId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? momentId
        let url = apiBaseURL.appendingPathComponent("/api/reinvented/moments/\(id)/motion")
        let body = Self.buildBody(boundary: boundary, files: [clip] + frames)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        return (http.statusCode, data)
    }
}
