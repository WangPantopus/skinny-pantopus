//
//  MultipartUploader.swift
//  Pantopus
//
//  Single-file multipart/form-data upload helper. Builds the body
//  manually (no extra dependencies) and posts via `URLSession.upload`.
//  Used by P20 to push claim-ownership evidence to
//  `POST /api/files/upload` (`backend/routes/files.js:781`) before
//  registering the resulting URL via the evidence endpoint.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Logging

/// One file part inside a multipart body.
public struct MultipartFile: Sendable {
    public let fieldName: String
    public let filename: String
    public let mimeType: String
    public let data: Data

    public init(fieldName: String, filename: String, mimeType: String, data: Data) {
        self.fieldName = fieldName
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }
}

/// Posts `multipart/form-data` to `POST /api/files/upload`. Lives
/// outside `APIClient` because the client is JSON-first; multipart
/// requires a different body assembly path.
public final class MultipartUploader: @unchecked Sendable {
    /// Singleton wired in tests via the same `URLSession` injection
    /// pattern as `APIClient`.
    public static let shared = MultipartUploader()

    private let session: URLSession
    private let environment: AppEnvironment
    private let logger = Logger(label: "app.pantopus.ios.MultipartUploader")

    init(
        environment: AppEnvironment = .current,
        session: URLSession? = nil
    ) {
        self.environment = environment
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 60
            config.timeoutIntervalForResource = 120
            self.session = URLSession(configuration: config)
        }
    }

    /// Send a multipart POST, transparently refreshing the access token and
    /// replaying once on a 401 (mirrors `APIClient`). Returns the raw body +
    /// HTTP response so each caller keeps its own status-code mapping. If a
    /// 401 survives the refresh, the user is signed out before returning so
    /// the caller's `case 401` maps to `.unauthorized` uniformly.
    private func performUpload(
        to url: URL,
        boundary: String,
        body: Data
    ) async throws -> (Data, HTTPURLResponse) {
        func makeRequest(token: String?) -> URLRequest {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            if let token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            return request
        }

        let token = await AuthManager.shared.accessToken
        var (data, response) = try await session.upload(for: makeRequest(token: token), from: body)
        guard var http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        if http.statusCode == 401 {
            switch await AuthManager.shared.refreshIfPossible() {
            case .rotated:
                let refreshed = await AuthManager.shared.accessToken
                (data, response) = try await session.upload(for: makeRequest(token: refreshed), from: body)
                guard let retryHTTP = response as? HTTPURLResponse else { throw APIError.invalidResponse }
                http = retryHTTP
                // If the replay still 401s, the just-rotated token is rejected.
                if http.statusCode == 401 {
                    await AuthManager.shared.handleUnauthorized()
                }
            case .authRejected:
                await AuthManager.shared.handleUnauthorized()
            case .transient:
                // Network/server blip during refresh — don't sign out. Surface a
                // transport error (parity with APIClient) instead of a
                // misleading "session expired" 401, so the caller can retry.
                throw APIError.transport(underlying: URLError(.networkConnectionLost))
            }
        }
        return (data, http)
    }

    /// Upload a single file to `POST /api/files/upload`. Optional form
    /// fields are sent alongside the file. Token is read from
    /// `AuthManager.shared`; if nil, the request goes out without an
    /// `Authorization` header so the server's 401 path can handle it
    /// uniformly with the rest of the client.
    public func uploadFile(
        _ file: MultipartFile,
        formFields: [String: String] = [:]
    ) async throws -> FileUploadResponse {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/files/upload")
        let body = Self.buildBody(boundary: boundary, file: file, fields: formFields)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                let decoder = JSONDecoder()
                return try decoder.decode(FileUploadResponse.self, from: data)
            } catch {
                logger.error("Multipart upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "File is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Unsupported file type.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload one or more files to `POST /api/upload/post-media/:postId`.
    /// Each part uses the field name `files`, matching the web client.
    public func uploadPostMedia(
        postId: String,
        files: [MultipartFile]
    ) async throws -> PostMediaUploadResponse {
        guard !files.isEmpty else {
            throw APIError.clientError(status: 400, message: "No files provided")
        }
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/upload/post-media/\(postId)")
        let body = Self.buildBody(boundary: boundary, files: files)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                let decoder = JSONDecoder()
                return try decoder.decode(PostMediaUploadResponse.self, from: data)
            } catch {
                logger.error("Post media upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "File is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Unsupported file type.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload listing photos to `POST /api/upload/listing-media/:listingId`
    /// (`backend/routes/upload.js:1049`). Each part uses the field name
    /// `files`, matching the backend multer route. Owner-only — the
    /// route verifies the listing belongs to the caller.
    public func uploadListingMedia(
        listingId: String,
        files: [MultipartFile]
    ) async throws -> ListingMediaUploadResponse {
        guard !files.isEmpty else {
            throw APIError.clientError(status: 400, message: "No files provided")
        }
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/upload/listing-media/\(listingId)")
        let body = Self.buildBody(boundary: boundary, files: files)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(ListingMediaUploadResponse.self, from: data)
            } catch {
                logger.error("Listing media upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "File is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Unsupported file type.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload chat attachments to `POST /api/upload/chat-media/:roomId`.
    /// Each part uses the field name `files`, matching the backend multer route.
    public func uploadChatMedia(
        roomId: String,
        files: [MultipartFile]
    ) async throws -> ChatMediaUploadResponse {
        guard !files.isEmpty else {
            throw APIError.clientError(status: 400, message: "No files provided")
        }
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/upload/chat-media/\(roomId)")
        let body = Self.buildBody(boundary: boundary, files: files)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                let decoder = JSONDecoder()
                return try decoder.decode(ChatMediaUploadResponse.self, from: data)
            } catch {
                logger.error("Chat media upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "File is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Unsupported file type.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Transcribe a recorded audio note via `POST /api/ai/transcribe`
    /// (multipart, field name `audio`, ≤25MB — Whisper's cap). Route
    /// `backend/routes/ai.js:387`.
    public func transcribeAudio(_ file: MultipartFile) async throws -> AITranscriptionResponse {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/ai/transcribe")
        let body = Self.buildBody(boundary: boundary, file: file)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(AITranscriptionResponse.self, from: data)
            } catch {
                logger.error("Transcription decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "Audio file exceeds the 25MB limit.")
        case 400..<500:
            throw APIError.clientError(status: http.statusCode, message: String(data: data, encoding: .utf8))
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Replace the signed-in user's avatar via
    /// `POST /api/upload/profile-picture` (`backend/routes/upload.js:236`).
    /// Single file, field name `file`; the server resizes to 800×800 webp,
    /// writes `User.profile_picture_url`, and echoes the new URL back.
    /// Mirrors RN `api.upload.uploadProfilePicture`.
    public func uploadProfilePicture(_ file: MultipartFile) async throws -> ProfilePictureUploadResponse {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/upload/profile-picture")
        let body = Self.buildBody(boundary: boundary, file: file)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(ProfilePictureUploadResponse.self, from: data)
            } catch {
                logger.error("Profile picture upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "That photo is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Profile picture must be an image.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Add one portfolio item via `POST /api/files/portfolio`
    /// (`backend/routes/files.js:362`). Single file, field name `file`;
    /// `category` / `title` / `description` ride alongside as form fields
    /// and land in `File.file_context` + `File.metadata`. Mirrors RN's
    /// `api.files.uploadPortfolio`
    /// (`packages/api/src/endpoints/files.ts:29`).
    public func uploadPortfolio(
        file: MultipartFile,
        title: String,
        description: String?,
        category: String?
    ) async throws -> PortfolioUploadResponse {
        var fields: [String: String] = ["title": title]
        if let description, !description.isEmpty { fields["description"] = description }
        if let category, !category.isEmpty { fields["category"] = category }
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/files/portfolio")
        let body = Self.buildBody(boundary: boundary, file: file, fields: fields)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(PortfolioUploadResponse.self, from: data)
            } catch {
                logger.error("Portfolio upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 413:
            throw APIError.clientError(status: 413, message: "That file is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "That file type isn't supported.")
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload a Beacon avatar or banner via
    /// `POST /api/upload/persona-media/:personaId?type=avatar|banner`
    /// (`backend/routes/upload.js:312`). Single file, field name `file`,
    /// images only — the route resizes (800×800 for avatars, 1600×600 for
    /// banners), writes `avatar_url` / `banner_url` on the persona row and
    /// echoes the new URL. Owner-only: 403 when the Beacon isn't yours.
    /// Mirrors RN `api.upload.uploadPersonaMedia`.
    public func uploadPersonaMedia(
        personaId: String,
        kind: PersonaMediaKind,
        file: MultipartFile
    ) async throws -> PersonaMediaUploadResponse {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        var components = URLComponents(
            url: environment.apiBaseURL.appendingPathComponent("/api/upload/persona-media/\(personaId)"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "type", value: kind.rawValue)]
        guard let url = components?.url else { throw APIError.invalidResponse }
        // The route also accepts `type` as a form field; send both so a
        // proxy that strips the query string still resolves the slot.
        let body = Self.buildBody(boundary: boundary, file: file, fields: ["type": kind.rawValue])
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(PersonaMediaUploadResponse.self, from: data)
            } catch {
                logger.error("Beacon media upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.clientError(status: 403, message: "You do not have permission to edit this Beacon.")
        case 413:
            throw APIError.clientError(status: 413, message: "That image is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Beacon media must be an image.")
        case 400..<500:
            throw APIError.clientError(status: http.statusCode, message: String(data: data, encoding: .utf8))
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload a business logo or banner via
    /// `POST /api/upload/business-media/:businessId?type=logo|banner`
    /// (`backend/routes/upload.js:1679`). Single file, field name `file`,
    /// images only — the route resizes (800×800 for logos, 1600×900 for
    /// banners), writes `BusinessProfile.logo_file_id` / `banner_file_id`
    /// plus the mirrored `User.profile_picture_url` / `cover_photo_url`,
    /// and echoes the new URL. Requires the `profile.edit` permission on
    /// the business (403 otherwise).
    /// Mirrors RN `api.upload.uploadBusinessMedia`
    /// (`packages/api/src/endpoints/upload.ts:498`).
    public func uploadBusinessMedia(
        businessId: String,
        kind: BusinessMediaKind,
        file: MultipartFile
    ) async throws -> BusinessMediaUploadResponse {
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        var components = URLComponents(
            url: environment.apiBaseURL.appendingPathComponent("/api/upload/business-media/\(businessId)"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "type", value: kind.rawValue)]
        guard let url = components?.url else { throw APIError.invalidResponse }
        // The route reads `type` from the query string or the form body —
        // send both so a proxy that strips the query still resolves the slot.
        let body = Self.buildBody(boundary: boundary, file: file, fields: ["type": kind.rawValue])
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            do {
                return try JSONDecoder().decode(BusinessMediaUploadResponse.self, from: data)
            } catch {
                logger.error("Business media upload decode failed: \(error)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.clientError(status: 403, message: "You do not have permission to edit this business profile.")
        case 413:
            throw APIError.clientError(status: 413, message: "That image is too large.")
        case 415:
            throw APIError.clientError(status: 415, message: "Business media must be an image.")
        case 400..<500:
            throw APIError.clientError(status: http.statusCode, message: String(data: data, encoding: .utf8))
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Upload images to `POST /api/upload/ai-media` for AI vision prompts.
    public func uploadAIMedia(files: [MultipartFile]) async throws -> AIMediaUploadResponse {
        guard !files.isEmpty else {
            throw APIError.clientError(status: 400, message: "No files provided")
        }
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let url = environment.apiBaseURL.appendingPathComponent("/api/upload/ai-media")
        let body = Self.buildBody(boundary: boundary, files: files)
        let (data, http) = try await performUpload(to: url, boundary: boundary, body: body)
        switch http.statusCode {
        case 200..<300:
            return try JSONDecoder().decode(AIMediaUploadResponse.self, from: data)
        case 401:
            throw APIError.unauthorized
        case 400..<500:
            throw APIError.clientError(status: http.statusCode, message: String(data: data, encoding: .utf8))
        default:
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Assemble a `multipart/form-data` body. Internal so tests can
    /// assert the exact byte layout without making a network call.
    static func buildBody(
        boundary: String,
        file: MultipartFile,
        fields: [String: String] = [:]
    ) -> Data {
        buildBody(boundary: boundary, files: [file], fields: fields)
    }

    static func buildBody(
        boundary: String,
        files: [MultipartFile],
        fields: [String: String] = [:]
    ) -> Data {
        var body = Data()
        for (name, value) in fields.sorted(by: { $0.key < $1.key }) {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
            body.append(Data("\(value)\r\n".utf8))
        }
        for file in files {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(
                Data("Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.filename)\"\r\n".utf8)
            )
            body.append(Data("Content-Type: \(file.mimeType)\r\n\r\n".utf8))
            body.append(file.data)
            body.append(Data("\r\n".utf8))
        }
        body.append(Data("--\(boundary)--\r\n".utf8))
        return body
    }
}
